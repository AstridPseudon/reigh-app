import { useMemo } from 'react';
import { isValid } from 'date-fns';
import { useTimestampUpdater } from './useTimestampUpdater';
import { formatRelativeDuration } from '@/shared/lib/timeFormatting';

interface UseCompletedTimestampOptions {
  /** Date when generation was processed/completed */
  generationProcessedAt?: string | Date | null;
  /** Disable automatic updates */
  disabled?: boolean;
}

const formatCompletedTime = (completedDate: Date): string =>
  `Completed ${formatRelativeDuration(completedDate)} ago`;

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
    void updateTrigger;
    return formatter(parsedDate);
  }, [parsedDate, formatter, updateTrigger]);

  return formattedTime;
}

/**
 * Hook that returns a formatted completed task timestamp string showing how long ago it was completed.
 */
export function useCompletedTimestamp({
  generationProcessedAt,
  disabled = false,
}: UseCompletedTimestampOptions = {}) {
  return useLiveTimestamp(generationProcessedAt, disabled, formatCompletedTime);
}
