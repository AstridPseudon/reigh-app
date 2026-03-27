import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import type { AgentSession, AgentSessionStatus, AgentTurn } from '@/tools/video-editor/types/agent-session';
import { timelineQueryKey } from '@/tools/video-editor/hooks/useTimeline';

const TIMELINE_AGENT_SESSIONS_TABLE = 'timeline_agent_sessions';
const AUTO_CONTINUE_LIMIT = 10;
const AUTO_CONTINUE_DELAY_MS = 300;

type AgentInvocationResponse = {
  session_id: string;
  status: AgentSessionStatus;
  turns_added: number;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAgentSessionStatus(value: unknown): value is AgentSessionStatus {
  return value === 'waiting_user'
    || value === 'processing'
    || value === 'continue'
    || value === 'done'
    || value === 'cancelled'
    || value === 'error';
}

function normalizeTurns(value: unknown): AgentTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.content !== 'string' || typeof item.timestamp !== 'string') {
      return [];
    }

    const role = item.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'tool_call' && role !== 'tool_result') {
      return [];
    }

    return [{
      role,
      content: item.content,
      tool_name: typeof item.tool_name === 'string' ? item.tool_name : undefined,
      tool_args: isRecord(item.tool_args) ? item.tool_args : undefined,
      timestamp: item.timestamp,
    }];
  });
}

function normalizeSession(row: unknown): AgentSession {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === 'string' ? record.id : '',
    timeline_id: typeof record.timeline_id === 'string' ? record.timeline_id : '',
    user_id: typeof record.user_id === 'string' ? record.user_id : '',
    status: isAgentSessionStatus(record.status) ? record.status : 'error',
    turns: normalizeTurns(record.turns),
    model: typeof record.model === 'string' ? record.model : 'groq',
    summary: typeof record.summary === 'string' ? record.summary : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : '',
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : '',
  };
}

function normalizeInvokeResponse(value: unknown): AgentInvocationResponse {
  const record = isRecord(value) ? value : {};

  return {
    session_id: typeof record.session_id === 'string' ? record.session_id : '',
    status: isAgentSessionStatus(record.status) ? record.status : 'error',
    turns_added: typeof record.turns_added === 'number' ? record.turns_added : 0,
  };
}

function delayWithTracking(timeoutIdsRef: MutableRefObject<Set<number>>, ms: number) {
  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      resolve();
    }, ms);
    timeoutIdsRef.current.add(timeoutId);
  });
}

export const agentSessionsQueryKey = (timelineId: string | null | undefined) =>
  ['timeline-agent-sessions', timelineId] as const;
export const agentSessionQueryKey = (sessionId: string | null | undefined) =>
  ['timeline-agent-session', sessionId] as const;

export function useAgentSessions(timelineId: string | null | undefined) {
  return useQuery({
    queryKey: agentSessionsQueryKey(timelineId),
    enabled: Boolean(timelineId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from(TIMELINE_AGENT_SESSIONS_TABLE as never)
        .select('*')
        .eq('timeline_id', timelineId!)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return Array.isArray(data) ? data.map(normalizeSession) : [];
    },
  });
}

export function useAgentSession(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: agentSessionQueryKey(sessionId),
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from(TIMELINE_AGENT_SESSIONS_TABLE as never)
        .select('*')
        .eq('id', sessionId!)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeSession(data) : null;
    },
  });

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`timeline-agent-session:${sessionId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'timeline_agent_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: agentSessionQueryKey(sessionId) });
          void queryClient.invalidateQueries({ queryKey: ['timeline-agent-sessions'] });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useAgentSession] Realtime subscription failed (${status}), removing channel`);
          void supabase.removeChannel(channel);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, sessionId]);

  return query;
}

export function useCreateSession(timelineId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!timelineId) {
        throw new Error('timelineId is required');
      }

      const { data: authData, error: authError } = await getSupabaseClient().auth.getUser();
      if (authError) {
        throw authError;
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await getSupabaseClient()
        .from(TIMELINE_AGENT_SESSIONS_TABLE as never)
        .insert({
          timeline_id: timelineId,
          user_id: userId,
          status: 'waiting_user',
          turns: [],
          model: 'groq',
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return normalizeSession(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentSessionsQueryKey(timelineId) });
    },
  });
}

export function useSendMessage(sessionId: string | null | undefined, timelineId?: string | null) {
  const queryClient = useQueryClient();
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const lastMessageRef = useRef<string | null>(null);
  const [continuationNotice, setContinuationNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      timeoutIds.clear();
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      lastMessageRef.current = userMessage;
      setLocalError(null);

      const invokeAgent = async (
        nextUserMessage?: string,
        continueCount = 0,
      ): Promise<AgentInvocationResponse> => {
        const { data, error } = await getSupabaseClient().functions.invoke('ai-timeline-agent', {
          body: {
            session_id: sessionId,
            ...(nextUserMessage ? { user_message: nextUserMessage } : {}),
          },
        });

        if (error) {
          throw error;
        }

        const response = normalizeInvokeResponse(data);

        if (response.status !== 'continue') {
          setContinuationNotice(null);
          return response;
        }

        if (continueCount >= AUTO_CONTINUE_LIMIT) {
          setContinuationNotice(
            `Auto-continuation paused after ${AUTO_CONTINUE_LIMIT} consecutive continue responses.`,
          );
          return response;
        }

        setContinuationNotice('Agent is continuing...');
        await delayWithTracking(timeoutIdsRef, AUTO_CONTINUE_DELAY_MS);
        return invokeAgent(undefined, continueCount + 1);
      };

      return invokeAgent(userMessage, 0);
    },
    onError: (error) => {
      // Only show error briefly — it will be cleared if realtime delivers a successful update
      setLocalError(toErrorMessage(error));
      // Auto-clear after 5s to avoid stale error banners
      const clearId = window.setTimeout(() => setLocalError(null), 5000);
      timeoutIdsRef.current.add(clearId);
    },
    onSuccess: () => {
      setLocalError(null);
      void queryClient.invalidateQueries({ queryKey: agentSessionQueryKey(sessionId) });
      void queryClient.invalidateQueries({ queryKey: ['timeline-agent-sessions'] });
      // Re-fetch the timeline so agent edits appear immediately in the editor
      if (timelineId) {
        void queryClient.invalidateQueries({ queryKey: timelineQueryKey(timelineId) });
      }
    },
  });

  const retryLastMessage = async () => {
    if (!lastMessageRef.current) {
      return null;
    }

    setLocalError(null);
    return mutation.mutateAsync(lastMessageRef.current);
  };

  return {
    continuationNotice,
    clearContinuationNotice: () => setContinuationNotice(null),
    localError,
    clearLocalError: () => setLocalError(null),
    hasRetryableMessage: Boolean(lastMessageRef.current),
    retryLastMessage,
    ...mutation,
  };
}

export function useCancelSession(sessionId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }

      const { error } = await getSupabaseClient()
        .from(TIMELINE_AGENT_SESSIONS_TABLE as never)
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentSessionQueryKey(sessionId) });
      void queryClient.invalidateQueries({ queryKey: ['timeline-agent-sessions'] });
    },
  });
}
