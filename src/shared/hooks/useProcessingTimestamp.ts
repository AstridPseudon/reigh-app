import { useMemo } from 'react';
import { isValid } from 'date-fns';
import { useTimestampUpdater } from './useTimestampUpdater';
import { formatRelativeDuration } from '@/shared/lib/timeFormatting';

/**
 * Hook for formatting "In Progress" task timestamps based on generation_started_at
 * Shows "Processing: <1 min" for <1 min, "Processing: For X mins/hrs" for longer durations
 */

interface UseProcessingTimestampOptions {
  /** Date when generation started */
  generationStartedAt?: string | Date | null;
  /** Disable automatic updates */
  disabled?: boolean;
}

interface UseCompletedTimestampOptions {
  /** Date when generation was processed/completed */
  generationProcessedAt?: string | Date | null;
  /** Disable automatic updates */
  disabled?: boolean;
}

/**
 * Format processing duration: "Processing for 5 mins", "Processing for 1 hr, 30 mins"
 * Processing durations don't need day-level granularity — hours keep accumulating.
 */
const formatProcessingDuration = (startDate: Date): string =>
  `Processing for ${formatRelativeDuration(startDate, { includeDays: false })}`;

/**
 * Format completed time: "Completed 5 mins ago", "Completed 2 days ago"
 */
const formatCompletedTime = (completedDate: Date): string =>
  `Completed ${formatRelativeDuration(completedDate)} ago`;

/**
 * Shared hook for live-updating timestamp formatting.
 * Parses a date, sets up live update triggers, and formats using the provided formatter.
 */
function useLiveTimestamp(
  dateInput: string | Date | null | undefined,
  disabled: boolean,
  formatter: (date: Date) => string,
): string | null {
  const parsedDate = useMemo(() => {
    if (!dateInput) return null;
    const parsed = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return isValid(parsed) ? parsed : null;
  }, [dateInput]);

  const { updateTrigger } = useTimestampUpdater({
    date: parsedDate,
    disabled,
    isVisible: true,
  });

  const formattedTime = useMemo(() => {
    if (!parsedDate) return null;
    // Keep recomputing when the updater ticks so relative durations stay fresh.
    void updateTrigger;
    return formatter(parsedDate);
  }, [parsedDate, formatter, updateTrigger]);

  return formattedTime;
}

/**
 * Hook that returns a formatted, live-updating processing timestamp string
 *
 * @example
 * const processingTime = useProcessingTimestamp({ generationStartedAt: task.generationStartedAt });
 * return <span>{processingTime}</span>;
 */
export function useProcessingTimestamp({
  generationStartedAt,
  disabled = false
}: UseProcessingTimestampOptions = {}) {
  return useLiveTimestamp(generationStartedAt, disabled, formatProcessingDuration);
}

/**
 * Hook that returns a formatted completed task timestamp string showing how long ago it was completed
 *
 * @example
 * const completedTime = useCompletedTimestamp({
 *   generationProcessedAt: task.generationProcessedAt
 * });
 * return <span>{completedTime}</span>;
 */
export function useCompletedTimestamp({
  generationProcessedAt,
  disabled = false
}: UseCompletedTimestampOptions = {}) {
  return useLiveTimestamp(generationProcessedAt, disabled, formatCompletedTime);
}
