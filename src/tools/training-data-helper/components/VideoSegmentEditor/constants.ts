/** Assumed video frame rate for frame count estimates */
export const ASSUMED_FPS = 30;

/** Milliseconds per second - used for ms/s time unit conversions */
export const MS_PER_SECOND = 1000;

/** Convert milliseconds to seconds */
export const msToSeconds = (ms: number) => ms / MS_PER_SECOND;

/** Convert seconds to milliseconds */
export const secondsToMs = (seconds: number) => seconds * MS_PER_SECOND;
