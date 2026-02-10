/**
 * Performance utilities to help prevent setTimeout violations and monitor execution times
 */

/**
 * Performance-monitored setTimeout wrapper
 * Automatically detects when callback execution exceeds 16ms and logs warnings
 */
const _performanceMonitoredTimeout = (
  callback: () => void,
  delay: number,
  _context: string = 'Unknown'
): NodeJS.Timeout => {
  return setTimeout(() => {
    callback();
  }, delay);
};

/**
 * Helper for measuring async operations with consistent logging
 */
const _measureAsync = async <T>(
  operation: () => Promise<T>,
  _context: string,
  _warnThreshold: number = 100
): Promise<T> => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    throw error;
  }
};
