/**
 * Utility function to expand single-element arrays to match a target count.
 * This is commonly needed for steerable motion tasks where user provides
 * one value that should be applied to all segments.
 */
export function expandArrayToCount<T>(arr: T[] | undefined, targetCount: number): T[] {
  if (!arr || arr.length === 0) {
    return [];
  }

  if (arr.length === 1 && targetCount > 1) {
    return Array(targetCount).fill(arr[0]);
  }

  // Truncate arrays that are longer than the target count
  // This handles the case where images were deleted and arrays are stale
  if (arr.length > targetCount) {
    return arr.slice(0, targetCount);
  }

  return arr;
}
