/**
 * Realtime Payload Types
 *
 * Type definitions for Supabase realtime broadcast and postgres_changes payloads.
 * Used by SimpleRealtimeManager and its consumers to replace `any` in event handlers.
 */

/** Payload for task-update broadcast events */
export interface TaskUpdatePayload {
  new: {
    id: string;
    status: string;
    task_type?: string;
    output_location?: string;
    error_message?: string;
    cost_cents?: number;
    generation_started_at?: string;
    generation_processed_at?: string;
    updated_at?: string;
    project_id?: string;
    params?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  old?: {
    id: string;
    status?: string;
  };
  eventType?: string;
}

/** Payload for new-task broadcast events */
export interface NewTaskPayload {
  new: {
    id: string;
    task_type: string;
    status: string;
    project_id: string;
    created_at: string;
    params?: Record<string, unknown>;
  };
  eventType?: string;
}

/** Payload for shot-generation INSERT/UPDATE events */
export interface ShotGenerationChangePayload {
  new: {
    id: string;
    shot_id: string;
    generation_id: string;
    timeline_frame?: number | null;
    metadata?: Record<string, unknown>;
  };
  old?: {
    id: string;
    shot_id?: string;
    timeline_frame?: number | null;
  };
  eventType: 'INSERT' | 'UPDATE' | 'insert' | 'update';
  /** Added by SimpleRealtimeManager when batching */
  shotId?: string;
  /** Added by SimpleRealtimeManager when batching */
  isPositioned?: boolean;
}

/** Payload for generation_variants INSERT/UPDATE events */
export interface VariantChangePayload {
  new: {
    id: string;
    generation_id: string;
    variant_type?: string;
    is_primary?: boolean;
    name?: string;
    location?: string;
    thumbnail_url?: string;
    params?: Record<string, unknown>;
    viewed_at?: string | null;
  };
  old?: {
    id: string;
    generation_id?: string;
  };
  eventType: 'INSERT' | 'UPDATE' | 'insert' | 'update';
  /** Added by SimpleRealtimeManager when batching */
  generationId?: string;
}

/** Payload for generation UPDATE events */
export interface GenerationUpdatePayload {
  new: {
    id: string;
    location?: string;
    thumbnail_url?: string;
    type?: string;
    starred?: boolean;
    name?: string;
    updated_at?: string;
    shot_id?: string;
    timeline_frame?: number | null;
    shot_data?: Record<string, unknown>;
  };
  old?: {
    id: string;
    location?: string;
    thumbnail_url?: string;
    shot_id?: string;
    timeline_frame?: number | null;
    shot_data?: Record<string, unknown>;
  };
  upscaleCompleted?: boolean;
  eventType?: string;
  /** Added by SimpleRealtimeManager when batching */
  generationId?: string;
  /** Added by SimpleRealtimeManager when batching */
  locationChanged?: boolean;
  /** Added by SimpleRealtimeManager when batching */
  thumbnailChanged?: boolean;
}

/** Union of all realtime payload types */
export type RealtimePayload =
  | TaskUpdatePayload
  | NewTaskPayload
  | ShotGenerationChangePayload
  | VariantChangePayload
  | GenerationUpdatePayload;
