/**
 * Performance utilities to help prevent setTimeout violations and monitor execution times
 */

/**
 * Performance-monitored setTimeout wrapper
 * Automatically detects when callback execution exceeds 16ms and logs warnings
 */
export const performanceMonitoredTimeout = (
  callback: () => void,
  delay: number,
  context: string = 'Unknown'
): NodeJS.Timeout => {
  return setTimeout(() => {
    const startTime = performance.now();

    try {
      callback();
    } finally {
      const duration = performance.now() - startTime;
      if (duration > 16) {
        console.warn(`[PerformanceMonitor] setTimeout in ${context} took ${duration.toFixed(1)}ms (target: <16ms)`);
      }
    }
  }, delay);
};

/**
 * Helper for measuring async operations with consistent logging
 */
export const measureAsync = async <T>(
  operation: () => Promise<T>,
  context: string,
  warnThreshold: number = 100
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    if (duration > warnThreshold) {
      console.warn(`[PerformanceMonitor] ${context} took ${duration.toFixed(1)}ms (threshold: ${warnThreshold}ms)`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.warn(`[PerformanceMonitor] ${context} failed after ${duration.toFixed(1)}ms:`, error);
    throw error;
  }
};
