// Simple, clean Supabase Realtime implementation following official documentation
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { dataFreshnessManager } from './DataFreshnessManager';
import { handleError } from '@/shared/lib/errorHandler';
import { queryKeys } from '@/shared/lib/queryKeys';
import type {
  TaskUpdatePayload,
  NewTaskPayload,
  ShotGenerationChangePayload,
  VariantChangePayload,
  GenerationUpdatePayload,
  RealtimePayload,
} from '@/shared/types/realtimePayloads';

class SimpleRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private projectId: string | null = null;
  private isSubscribed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5; // Increased from 3 to handle transient issues
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Event batching to prevent cascading invalidations
  private eventBatchQueue: Map<string, unknown[]> = new Map();
  private batchTimeoutId: NodeJS.Timeout | null = null;
  private readonly BATCH_WINDOW_MS = 100; // Batch events within 100ms

  private boundAuthHealHandler: (event: CustomEvent) => void;

  constructor() {
    // Store bound handler for proper cleanup
    this.boundAuthHealHandler = this.handleAuthHeal.bind(this);
    
    // Listen for auth heal events from ReconnectScheduler
    if (typeof window !== 'undefined') {
      window.addEventListener('realtime:auth-heal', this.boundAuthHealHandler);
    }
  }

  private handleAuthHeal = (event: CustomEvent) => {
    console.log('[SimpleRealtime] 🔄 Auth heal event received:', event.detail);
    
    // If we have a project and are not currently connected, attempt to reconnect
    if (this.projectId && !this.isSubscribed && this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log('[SimpleRealtime] 🔄 Attempting reconnect due to auth heal');
      this.attemptReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[SimpleRealtime] ⏸️ Skipping auth heal reconnect - max attempts reached');
    }
  };

  private async attemptReconnect() {
    if (!this.projectId) return;

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Don't exceed max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SimpleRealtime] ❌ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    console.log('[SimpleRealtime] ⏳ Reconnecting in', delay, 'ms (attempt', this.reconnectAttempts, '/', this.maxReconnectAttempts, ')');
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        const success = await this.joinProject(this.projectId!);
        if (success) {
          console.log('[SimpleRealtime] ✅ Reconnect successful');
          this.reconnectAttempts = 0; // Reset on success
        } else {
          console.log('[SimpleRealtime] ❌ Reconnect failed, will retry');
          this.attemptReconnect();
        }
      } catch (error) {
        handleError(error, { context: 'SimpleRealtimeManager', showToast: false });
        this.attemptReconnect();
      }
    }, delay);
  }

  async joinProject(projectId: string): Promise<boolean> {
    console.log('[SimpleRealtime] 🚀 Joining project:', projectId);
    
    // Check authentication first (use getSession for local/cached check)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.error('[SimpleRealtime] ❌ No valid session, cannot join project:', {
          sessionError: sessionError?.message,
          hasSession: !!session,
          hasUser: !!session?.user,
          projectId
        });
        dataFreshnessManager.onRealtimeStatusChange('error', 'No valid session');
        return false;
      }
      
      // Explicitly set auth token for realtime before subscribing
      if (session.access_token) {
        console.log('[SimpleRealtime] 🔑 Setting realtime auth token');
        supabase.realtime.setAuth(session.access_token);
      }
      
      console.log('[SimpleRealtime] ✅ Authentication verified for user:', session.user.id);
    } catch (error) {
      handleError(error, { context: 'SimpleRealtimeManager', showToast: false });
      dataFreshnessManager.onRealtimeStatusChange('error', 'Auth check failed');
      return false;
    }
    
    // Clean up existing subscription
    if (this.channel) {
      await this.leave();
    }

    this.projectId = projectId;
    this.reconnectAttempts = 0; // Reset reconnect attempts for new project
    const topic = `task-updates:${projectId}`;

    try {
      // Create channel following Supabase documentation pattern
      this.channel = supabase.channel(topic);
      
      console.log('[SimpleRealtime] 📡 Channel created:', {
        topic,
        channelExists: !!this.channel,
        realtimeExists: !!(supabase as any)?.realtime,
        socketExists: !!(supabase as any)?.realtime?.socket,
        socketReadyState: (supabase as any)?.realtime?.socket?.readyState
      });

      // Add event handlers BEFORE subscribing
      this.channel
        .on('broadcast', { event: 'task-update' }, (payload) => {
          console.log('[SimpleRealtime] 📨 Task update received:', payload);
          // Handle the task update
          this.handleTaskUpdate(payload as unknown as TaskUpdatePayload);
        })
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
          (payload) => {
            console.log('[SimpleRealtime] 📨 New task:', payload);
            this.handleNewTask(payload as unknown as NewTaskPayload);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
          (payload) => {
            console.log('[SimpleRealtime] 📨 Task updated:', payload);
            this.handleTaskUpdate(payload as unknown as TaskUpdatePayload);
          }
        )
        // Listen to shot_generations table for positioned image changes
        // This allows timeline to reload ONLY when relevant positioned images are added/updated
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'shot_generations' },
          (payload) => {
            console.log('[SimpleRealtime] 📨 Shot generation inserted:', payload);
            this.handleShotGenerationChange(payload as unknown as ShotGenerationChangePayload, 'INSERT');
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'shot_generations' },
          (payload) => {
            console.log('[SimpleRealtime] 📨 Shot generation updated:', payload);
            this.handleShotGenerationChange(payload as unknown as ShotGenerationChangePayload, 'UPDATE');
          }
        )
        // Listen to generations table for upscale completion and other updates
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'generations', filter: `project_id=eq.${projectId}` },
          (payload) => {
            console.log('[AddFlicker] 2️⃣a REALTIME: generations UPDATE received from Supabase:', {
              generationId: (payload as unknown as GenerationUpdatePayload)?.new?.id?.substring(0, 8),
              hasNew: !!payload?.new,
              hasOld: !!payload?.old,
              timestamp: Date.now()
            });
            this.handleGenerationUpdate(payload as unknown as GenerationUpdatePayload);
          }
        )
        // Listen to generation_variants table for variant changes (segment regenerations, etc.)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'generation_variants' },
          (payload) => {
            console.log('[SimpleRealtime] 📨 Generation variant inserted:', (payload as unknown as VariantChangePayload)?.new?.id?.substring(0, 8));
            this.handleVariantChange(payload as unknown as VariantChangePayload, 'INSERT');
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'generation_variants' },
          (payload) => {
            console.log('[SimpleRealtime] 📨 Generation variant updated:', (payload as unknown as VariantChangePayload)?.new?.id?.substring(0, 8));
            this.handleVariantChange(payload as unknown as VariantChangePayload, 'UPDATE');
          }
        );

      // Subscribe with status callback
      const subscribeResult = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.error('[SimpleRealtime] ❌ Subscribe timeout');
          resolve(false);
        }, 10000);

        this.channel.subscribe((status: string) => {
          clearTimeout(timeoutId);
          console.log('[SimpleRealtime] 📞 Status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('[SimpleRealtime] ✅ Successfully subscribed');
            this.isSubscribed = true;
            this.reconnectAttempts = 0; // Reset reconnect attempts on success
            this.updateGlobalSnapshot('joined');
            
            // Report successful connection to freshness manager
            dataFreshnessManager.onRealtimeStatusChange('connected', 'Supabase subscription successful');
            
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.isSubscribed = false;
            this.updateGlobalSnapshot('error');

            // Gather diagnostic information
            const socketState = (supabase as any)?.realtime?.socket?.readyState;
            const socketStateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
            const socketStateName = socketState !== undefined ? socketStateNames[socketState] || `UNKNOWN(${socketState})` : 'NO_SOCKET';

            // Check authentication state for debugging
            supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
              const diagnostics = {
                status,
                topic,
                socketState: socketStateName,
                hasSession: !!session,
                hasAccessToken: !!session?.access_token,
                tokenExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
                isTokenExpired: session?.expires_at ? Date.now() > session.expires_at * 1000 : null,
                userId: session?.user?.id,
                sessionError: sessionError?.message,
                reconnectAttempts: this.reconnectAttempts,
                timestamp: new Date().toISOString()
              };

              // Build a human-readable error message
              let errorReason = 'Unknown cause';
              const suggestions: string[] = [];

              if (sessionError) {
                errorReason = `Session error: ${sessionError.message}`;
                suggestions.push('Try refreshing the page or logging in again');
              } else if (!session) {
                errorReason = 'No active session';
                suggestions.push('User may be logged out - try logging in again');
              } else if (diagnostics.isTokenExpired) {
                errorReason = 'Access token has expired';
                suggestions.push('Session needs refresh - try refreshing the page');
              } else if (socketStateName === 'CLOSED' || socketStateName === 'NO_SOCKET') {
                errorReason = `WebSocket not connected (state: ${socketStateName})`;
                suggestions.push('Check network connectivity');
                suggestions.push('Supabase Realtime service may be down');
              } else if (status === 'TIMED_OUT') {
                errorReason = 'Connection timed out after 10 seconds';
                suggestions.push('Check network connectivity');
                suggestions.push('Supabase may be slow to respond');
              } else {
                // CHANNEL_ERROR with valid session - likely RLS or table config issue
                errorReason = 'Channel rejected by server';
                suggestions.push('Check Supabase Dashboard → Database → Replication (tables must have realtime enabled)');
                suggestions.push('Check RLS policies allow SELECT for authenticated users');
              }

              console.error(
                `[SimpleRealtime] ❌ Subscription failed: ${status}\n` +
                `  Reason: ${errorReason}\n` +
                `  Suggestions:\n${suggestions.map(s => `    • ${s}`).join('\n')}\n` +
                `  Diagnostics:`, diagnostics
              );
            }).catch(authErr => {
              console.error('[SimpleRealtime] ❌ Subscription failed:', status, '- Also failed to check auth:', authErr);
            });

            // Report failure to freshness manager
            dataFreshnessManager.onRealtimeStatusChange('error', `Subscription failed: ${status}`);

            resolve(false);
          }
        });
      });

      return subscribeResult;

    } catch (error) {
      console.error('[SimpleRealtime] ❌ Join failed:', error);
      
      // Report connection failure to freshness manager
      dataFreshnessManager.onRealtimeStatusChange('error', `Join failed: ${error}`);
      
      return false;
    }
  }

  async leave(): Promise<void> {
    console.log('[SimpleRealtime] 👋 Leaving channel');
    
    // Clear any pending reconnect timeout (unconditionally)
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Clear any pending batch timeout
    if (this.batchTimeoutId) {
      console.log('[SimpleRealtime:Batching] 🧹 Clearing pending batch timeout on leave');
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    
    // Clear the event queue
    if (this.eventBatchQueue.size > 0) {
      console.log('[SimpleRealtime:Batching] 🧹 Clearing', this.eventBatchQueue.size, 'pending batched events');
      this.eventBatchQueue.clear();
    }
    
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
      this.updateGlobalSnapshot('closed');
      
      // Report disconnection to freshness manager
      dataFreshnessManager.onRealtimeStatusChange('disconnected', 'Channel unsubscribed');
    }
    
    // Reset state regardless of channel existence
    this.isSubscribed = false;
    this.projectId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Batch an event for processing. Events are grouped by type and processed together
   * within BATCH_WINDOW_MS to reduce invalidation cascades.
   */
  private batchEvent(eventType: string, payload: RealtimePayload) {
    const existing = this.eventBatchQueue.get(eventType) || [];
    existing.push(payload);
    this.eventBatchQueue.set(eventType, existing);

    console.log('[SimpleRealtime:Batching] 📦 Event queued:', {
      eventType,
      queueSize: existing.length,
      totalQueues: this.eventBatchQueue.size,
      timestamp: Date.now()
    });

    // Clear existing timeout if any
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }

    // Set new timeout to process batch
    this.batchTimeoutId = setTimeout(() => {
      this.processBatchedEvents();
    }, this.BATCH_WINDOW_MS);
  }

  /**
   * Process all batched events together, dispatching a single consolidated event
   * for each event type.
   */
  private processBatchedEvents() {
    if (this.eventBatchQueue.size === 0) {
      console.log('[SimpleRealtime:Batching] ✅ No events to process');
      return;
    }

    console.log('[SimpleRealtime:Batching] 🚀 Processing batched events:', {
      eventTypes: Array.from(this.eventBatchQueue.keys()),
      totalEvents: Array.from(this.eventBatchQueue.values()).reduce((sum, arr) => sum + arr.length, 0),
      breakdown: Array.from(this.eventBatchQueue.entries()).map(([type, events]) => ({
        type,
        count: events.length
      })),
      timestamp: Date.now()
    });

    // Process each event type (cast from unknown[] to the specific payload type per event)
    this.eventBatchQueue.forEach((payloads, eventType) => {
      if (eventType === 'task-update') {
        this.dispatchBatchedTaskUpdates(payloads as TaskUpdatePayload[]);
      } else if (eventType === 'task-new') {
        this.dispatchBatchedNewTasks(payloads as NewTaskPayload[]);
      } else if (eventType === 'shot-generation-change') {
        this.dispatchBatchedShotGenerationChanges(payloads as ShotGenerationChangePayload[]);
      } else if (eventType === 'generation-update') {
        this.dispatchBatchedGenerationUpdates(payloads as GenerationUpdatePayload[]);
      } else if (eventType === 'variant-change') {
        this.dispatchBatchedVariantChanges(payloads as VariantChangePayload[]);
      }
    });

    // Clear the queue
    this.eventBatchQueue.clear();
    this.batchTimeoutId = null;
  }

  /**
   * Dispatch batched task update events as a single consolidated event
   */
  private dispatchBatchedTaskUpdates(payloads: TaskUpdatePayload[]) {
    // Update global snapshot with latest event time
    this.updateGlobalSnapshot('joined', Date.now());

    console.log('[SimpleRealtime:Batching] 📨 Dispatching batched task updates:', {
      count: payloads.length,
      timestamp: Date.now()
    });

    // Report consolidated event to freshness manager
    dataFreshnessManager.onRealtimeEvent('task-update', [
      ['tasks'],
      queryKeys.tasks.statusCountsAll,
      queryKeys.unified.all,
      queryKeys.generations.byShotAll,
      ['generations'],
      this.projectId ? [...queryKeys.tasks.paginated(this.projectId)] : [...queryKeys.tasks.paginatedAll]
    ]);

    // Emit single consolidated event with all payloads
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:task-update-batch', {
        detail: {
          payloads,
          count: payloads.length,
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Dispatch batched new task events as a single consolidated event
   */
  private dispatchBatchedNewTasks(payloads: NewTaskPayload[]) {
    // Update global snapshot with latest event time
    this.updateGlobalSnapshot('joined', Date.now());

    console.log('[SimpleRealtime:Batching] 📨 Dispatching batched new tasks:', {
      count: payloads.length,
      timestamp: Date.now()
    });

    // Report consolidated event to freshness manager
    dataFreshnessManager.onRealtimeEvent('task-new', [
      ['tasks'],
      queryKeys.tasks.statusCountsAll,
      queryKeys.unified.all,
      this.projectId ? [...queryKeys.tasks.paginated(this.projectId)] : [...queryKeys.tasks.paginatedAll]
    ]);

    // Emit single consolidated event with all payloads
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:task-new-batch', {
        detail: {
          payloads,
          count: payloads.length,
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Dispatch batched shot generation change events as a single consolidated event
   */
  private dispatchBatchedShotGenerationChanges(payloads: ShotGenerationChangePayload[]) {
    // Update global snapshot with latest event time
    this.updateGlobalSnapshot('joined', Date.now());

    console.log('[SimpleRealtime:Batching] 📨 Dispatching batched shot generation changes:', {
      count: payloads.length,
      timestamp: Date.now()
    });

    // Collect unique shot IDs affected by this batch
    const affectedShotIds = new Set<string>();
    payloads.forEach((p) => {
      if (p.shotId) {
        affectedShotIds.add(p.shotId);
      }
    });

    console.log('[SimpleRealtime:Batching] 🎯 Affected shots in batch:', {
      count: affectedShotIds.size,
      shotIds: Array.from(affectedShotIds).map(id => id.substring(0, 8))
    });

    // Report consolidated event to freshness manager for all affected shots
    const affectedQueryKeys = Array.from(affectedShotIds).flatMap(shotId => [
      queryKeys.generations.byShot(shotId),
      queryKeys.generations.unpositionedCount(shotId),
      queryKeys.segments.liveTimeline(shotId),  // For video slot positioning in useSegmentOutputsForShot
    ]);

    dataFreshnessManager.onRealtimeEvent('shot-generation-positioned', affectedQueryKeys);

    // Emit single consolidated event with all payloads
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:shot-generation-change-batch', {
        detail: {
          payloads,
          count: payloads.length,
          affectedShotIds: Array.from(affectedShotIds),
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Dispatch batched variant change events (e.g., segment regenerations)
   */
  private dispatchBatchedVariantChanges(payloads: VariantChangePayload[]) {
    // Update global snapshot with latest event time
    this.updateGlobalSnapshot('joined', Date.now());

    // Collect unique generation IDs affected by this batch
    const affectedGenerationIds = new Set<string>();
    payloads.forEach((p) => {
      if (p.generationId) {
        affectedGenerationIds.add(p.generationId);
      }
    });

    console.log('[SimpleRealtime:Batching] 📨 Dispatching batched variant changes:', {
      count: payloads.length,
      affectedGenerations: affectedGenerationIds.size,
      timestamp: Date.now()
    });

    // Build query keys for each affected generation's variants
    const variantKeys = Array.from(affectedGenerationIds).map(generationId =>
      ['generation-variants', generationId]
    );

    // IMPORTANT: Also add all-shot-generations to invalidate Timeline/Batch mode
    // When a variant becomes primary, the generation's location changes which affects shot displays
    variantKeys.push([...queryKeys.generations.byShotAll]);
    variantKeys.push(['generations']);

    dataFreshnessManager.onRealtimeEvent('variant-change', variantKeys);

    // Emit single consolidated event with all payloads
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:variant-change-batch', {
        detail: {
          payloads,
          count: payloads.length,
          affectedGenerationIds: Array.from(affectedGenerationIds),
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Dispatch batched generation update events (e.g., upscale completion)
   */
  private dispatchBatchedGenerationUpdates(payloads: GenerationUpdatePayload[]) {
    // Update global snapshot with latest event time
    this.updateGlobalSnapshot('joined', Date.now());

    console.log('[SimpleRealtime:Batching] 📨 Dispatching batched generation updates:', {
      count: payloads.length,
      upscaleCompletions: payloads.filter((p) => p.upscaleCompleted).length,
      timestamp: Date.now()
    });

    // Invalidate all generation-related queries to pick up changes
    const affectedQueryKeys = [
      queryKeys.unified.all,
      ['generations'],
      queryKeys.generations.byShotAll
    ];

    dataFreshnessManager.onRealtimeEvent('generation-update', affectedQueryKeys);

    // Emit single consolidated event with all payloads
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:generation-update-batch', {
        detail: {
          payloads,
          count: payloads.length,
          timestamp: Date.now()
        }
      }));
    }
  }

  private handleTaskUpdate(payload: TaskUpdatePayload) {
    // Batch this event instead of dispatching immediately
    this.batchEvent('task-update', payload);
  }

  private handleNewTask(payload: NewTaskPayload) {
    // Batch this event instead of dispatching immediately
    this.batchEvent('task-new', payload);
  }

  private handleShotGenerationChange(payload: ShotGenerationChangePayload, eventType: 'INSERT' | 'UPDATE') {
    const newRecord = payload?.new;
    const oldRecord = payload?.old;
    const shotId = newRecord?.shot_id;
    const timelineFrame = newRecord?.timeline_frame;
    const oldTimelineFrame = oldRecord?.timeline_frame;
    
    // Only invalidate if this involves a positioned image (timeline_frame is NOT NULL)
    const isNowPositioned = timelineFrame !== null && timelineFrame !== undefined;
    const wasPositioned = oldTimelineFrame !== null && oldTimelineFrame !== undefined;
    const positionChanged = eventType === 'UPDATE' && timelineFrame !== oldTimelineFrame;
    
    // For INSERT: only care if it's positioned
    // For UPDATE: care if position changed (added, removed, or moved)
    const shouldInvalidate = eventType === 'INSERT' ? isNowPositioned : (isNowPositioned || wasPositioned || positionChanged);
    
    console.log('[SimpleRealtime] 🎯 Shot generation change analysis:', {
      eventType,
      shotId: shotId?.substring(0, 8),
      timelineFrame,
      oldTimelineFrame,
      isNowPositioned,
      wasPositioned,
      positionChanged,
      shouldInvalidate
    });
    
    if (!shouldInvalidate) {
      console.log('[SimpleRealtime] ⏭️  Skipping invalidation - no positioned image changes');
      return;
    }
    
    if (!shotId) {
      console.warn('[SimpleRealtime] ⚠️  Shot generation change missing shot_id, cannot target invalidation');
      return;
    }
    
    // Batch this event to prevent conflicts with optimistic updates during drag operations
    console.log('[SimpleRealtime:Batching] 📦 Batching shot generation change for shot:', shotId.substring(0, 8));
    this.batchEvent('shot-generation-change', { ...payload, eventType, shotId, isPositioned: isNowPositioned });
  }

  private handleVariantChange(payload: VariantChangePayload, eventType: 'INSERT' | 'UPDATE') {
    const newRecord = payload?.new;
    const generationId = newRecord?.generation_id;
    
    if (!generationId) {
      console.warn('[SimpleRealtime] ⚠️  Variant change missing generation_id, cannot invalidate');
      return;
    }

    console.log('[SimpleRealtime] 🎯 Variant change for generation:', generationId.substring(0, 8), eventType);

    // Batch this event to prevent rapid invalidation from multiple variant changes
    this.batchEvent('variant-change', { ...payload, eventType, generationId });
  }

  private handleGenerationUpdate(payload: GenerationUpdatePayload) {
    console.log('[AddFlicker] 2️⃣ handleGenerationUpdate called - checking if shot sync only');
    
    const newRecord = payload?.new;
    const oldRecord = payload?.old;
    const generationId = newRecord?.id;
    const location = newRecord?.location;
    const oldLocation = oldRecord?.location;
    const thumbnailUrl = newRecord?.thumbnail_url;
    const oldThumbnailUrl = oldRecord?.thumbnail_url;
    
    // Check what changed - IMPORTANT: Only consider it a "real" change if BOTH old and new 
    // have values AND they differ. Supabase realtime's `old` record may not include all columns,
    // so comparing against undefined would incorrectly flag unchanged fields as "changed".
    // Note: location changes now include when primary variant switches (e.g., upscale completes)
    const locationActuallyChanged = !!(oldLocation && location && location !== oldLocation);
    const thumbnailActuallyChanged = !!(oldThumbnailUrl && thumbnailUrl && thumbnailUrl !== oldThumbnailUrl);
    
    // CRITICAL: Check if this is just a shot sync update (from sync_shot_to_generation trigger)
    // These updates only change shot_id, timeline_frame, or shot_data - not actual generation content
    // We should NOT invalidate all-shot-generations for these because:
    // 1. The shot_generations INSERT already handles this via handleShotGenerationChange
    // 2. Invalidating here causes flicker when adding images to shots
    const shotIdChanged = newRecord?.shot_id !== oldRecord?.shot_id;
    const timelineFrameChanged = newRecord?.timeline_frame !== oldRecord?.timeline_frame;
    const shotDataChanged = JSON.stringify(newRecord?.shot_data) !== JSON.stringify(oldRecord?.shot_data);
    
    // If no actual content changed (location, thumbnail), this is just a shot sync update
    const hasActualContentChange = locationActuallyChanged || thumbnailActuallyChanged;
    const isOnlyShotSyncUpdate = !hasActualContentChange;
    
    console.log('[AddFlicker] 2️⃣ Generation update analysis:', {
      generationId: generationId?.substring(0, 8),
      locationActuallyChanged,
      thumbnailActuallyChanged,
      hasActualContentChange,
      isOnlyShotSyncUpdate,
      // Debug: show actual values
      hasOldLocation: !!oldLocation,
      hasNewLocation: !!location,
      hasOldThumbnail: !!oldThumbnailUrl,
      hasNewThumbnail: !!thumbnailUrl,
    });
    
    if (!generationId) {
      console.warn('[SimpleRealtime] ⚠️  Generation update missing id, cannot invalidate');
      return;
    }
    
    // Skip invalidation for shot sync updates - these are handled by shot_generations INSERT
    // and invalidating here causes flicker
    if (isOnlyShotSyncUpdate) {
      console.log('[AddFlicker] 2️⃣ ⏭️ SKIPPING generation update - only shot sync fields changed:', generationId.substring(0, 8));
      return;
    }
    
    // Invalidate queries to pick up any generation changes (location, thumbnail, etc.)
    console.log('[SimpleRealtime:Batching] 📦 Batching generation update:', generationId.substring(0, 8));
    this.batchEvent('generation-update', { ...payload, generationId, locationChanged: locationActuallyChanged, thumbnailChanged: thumbnailActuallyChanged });
  }

  private updateGlobalSnapshot(channelState: string, lastEventAt?: number) {
    if (typeof window !== 'undefined') {
      const currentSnapshot = (window as any).__REALTIME_SNAPSHOT__ || {};
      (window as any).__REALTIME_SNAPSHOT__ = {
        ...currentSnapshot,
        channelState,
        lastEventAt: lastEventAt || currentSnapshot.lastEventAt,
        timestamp: Date.now()
      };
    }
  }

  getStatus() {
    return {
      isSubscribed: this.isSubscribed,
      projectId: this.projectId,
      channelState: this.channel?.state || 'closed',
      reconnectAttempts: this.reconnectAttempts
    };
  }

  reset() {
    console.log('[SimpleRealtime] 🔄 Resetting connection state');
    this.reconnectAttempts = 0;
    
    // Clear any pending reconnect timeout (unconditionally)
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Clear any pending batch timeout
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    
    // Clear the event queue
    this.eventBatchQueue.clear();
  }

  destroy() {
    // Clean up event listener with proper bound handler
    if (typeof window !== 'undefined') {
      window.removeEventListener('realtime:auth-heal', this.boundAuthHealHandler);
    }
    
    // Clear any pending reconnect timeout (unconditionally)
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Clear any pending batch timeout
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    
    // Clear the event queue
    this.eventBatchQueue.clear();
    
    // Leave any active channel
    this.leave();
  }
}

// Singleton instance
export const simpleRealtimeManager = new SimpleRealtimeManager();
