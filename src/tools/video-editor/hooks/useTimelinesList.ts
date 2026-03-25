import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { createDefaultTimelineConfig } from '@/tools/video-editor/lib/defaults';

export const timelineListQueryKey = (projectId: string | null | undefined) => ['timelines', projectId] as const;

export function useTimelinesList(projectId: string | null | undefined, userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const timelinesQuery = useQuery({
    queryKey: timelineListQueryKey(projectId),
    enabled: Boolean(projectId && userId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('timelines')
        .select('*')
        .eq('project_id', projectId!)
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: timelineListQueryKey(projectId) });

  const createTimeline = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await getSupabaseClient()
        .from('timelines')
        .insert({
          name,
          project_id: projectId!,
          user_id: userId!,
          config: createDefaultTimelineConfig(),
          asset_registry: { assets: {} },
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const renameTimeline = useMutation({
    mutationFn: async ({ timelineId, name }: { timelineId: string; name: string }) => {
      const { error } = await getSupabaseClient()
        .from('timelines')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', timelineId)
        .eq('project_id', projectId!)
        .eq('user_id', userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  const deleteTimeline = useMutation({
    mutationFn: async (timelineId: string) => {
      const { error } = await getSupabaseClient()
        .from('timelines')
        .delete()
        .eq('id', timelineId)
        .eq('project_id', projectId!)
        .eq('user_id', userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });

  return {
    ...timelinesQuery,
    createTimeline,
    renameTimeline,
    deleteTimeline,
  };
}
