import { nanoid } from 'nanoid';

/**
 * Generates a UUID with fallback for mobile browsers.
 * Uses crypto.randomUUID() when available, falls back to nanoid.
 */
export function generateUUID(): string {
  // Check if crypto.randomUUID is available (requires secure context and modern browser)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through to nanoid
    }
  }

  // Fallback to nanoid for mobile browsers or when crypto.randomUUID is not available
  return nanoid();
}

/**
 * Generates a unique task ID with a prefix and timestamp.
 */
export function generateTaskId(taskTypePrefix: string): string {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const shortUuid = generateUUID().slice(0, 6);
  return `${taskTypePrefix}_${runId.substring(2, 10)}_${shortUuid}`;
}

/**
 * Generates a run ID for tasks that need it.
 */
export function generateRunId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '');
}
