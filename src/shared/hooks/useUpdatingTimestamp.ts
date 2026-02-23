import { useMemo } from 'react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { useTimestampUpdater } from './useTimestampUpdater';
import { abbreviateRelativeTime } from '@/shared/lib/timeFormatting';

/**
 * Simple hook that returns a live-updating formatted timestamp string
 * Perfect for inline timestamps in task lists, galleries, etc.
 */

interface UseUpdatingTimestampOptions {
  /** Date to format */
  date?: string | Date | null;
  /** Custom abbreviation function */
  abbreviate?: (str: string) => string;
  /** Disable automatic updates */
  disabled?: boolean;
}

/**
 * Hook that returns a formatted, live-updating timestamp string
 * 
 * @example
 * const timeAgo = useUpdatingTimestamp({ date: task.createdAt });
 * return <span>Created: {timeAgo}</span>;
 */
export function useUpdatingTimestamp({ 
  date, 
  abbreviate = abbreviateRelativeTime,
  disabled = false 
}: UseUpdatingTimestampOptions = {}) {
  
  const parsedDate = useMemo(() => {
    if (!date) return null;
    const parsed = typeof date === 'string' ? new Date(date) : date;
    return isValid(parsed) ? parsed : null;
  }, [date]);
  
  // Get live update trigger
  const { updateTrigger } = useTimestampUpdater({
    date: parsedDate,
    disabled,
    isVisible: true // Explicitly set to ensure TaskPane timestamps update
  });
  
  // Format timestamp with live updates
  const formattedTime = useMemo(() => {
    if (!parsedDate) return 'Unknown';
    void updateTrigger;
    
    const formatted = formatDistanceToNow(parsedDate, { addSuffix: true });
    const abbreviated = abbreviate(formatted);
    
    return abbreviated;
  }, [parsedDate, updateTrigger, abbreviate]);
  
  return formattedTime;
}

/**
 * Hook specifically for task timestamps with consistent abbreviation
 */
export function useTaskTimestamp(date?: string | Date | null) {
  return useUpdatingTimestamp({ 
    date,
    abbreviate: abbreviateRelativeTime
  });
}
