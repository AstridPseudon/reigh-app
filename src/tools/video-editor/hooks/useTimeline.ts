import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataProvider } from '@/tools/video-editor/data/DataProvider';
import type { TimelineConfig } from '@/tools/video-editor/types';

export const timelineQueryKey = (timelineId: string | null | undefined) => ['timeline', timelineId] as const;
export const assetRegistryQueryKey = (timelineId: string | null | undefined) => ['asset-registry', timelineId] as const;

export function useTimeline(provider: DataProvider | null, timelineId: string | null | undefined) {
  const queryClient = useQueryClient();

  const timelineQuery = useQuery({
    queryKey: timelineQueryKey(timelineId),
    enabled: Boolean(provider && timelineId),
    queryFn: () => provider!.loadTimeline(timelineId!),
  });

  const saveTimeline = useMutation({
    mutationFn: async (config: TimelineConfig) => {
      await provider!.saveTimeline(timelineId!, config);
      return config;
    },
    onMutate: async (config) => {
      await queryClient.cancelQueries({ queryKey: timelineQueryKey(timelineId) });
      const previous = queryClient.getQueryData<TimelineConfig>(timelineQueryKey(timelineId));
      queryClient.setQueryData(timelineQueryKey(timelineId), config);
      return { previous };
    },
    onError: (_error, _config, context) => {
      if (context?.previous) {
        queryClient.setQueryData(timelineQueryKey(timelineId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timelineQueryKey(timelineId) });
      void queryClient.invalidateQueries({ queryKey: assetRegistryQueryKey(timelineId) });
    },
  });

  return {
    ...timelineQuery,
    saveTimeline,
  };
}
