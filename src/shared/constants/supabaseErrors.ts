export const SUPABASE_ERROR = {
  NOT_FOUND: 'PGRST116',
  UNIQUE_VIOLATION: '23505',
  FUNCTION_NOT_FOUND: '42883',
} as const;

type SupabaseErrorCode = typeof SUPABASE_ERROR[keyof typeof SUPABASE_ERROR];

function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function isNotFoundError(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === SUPABASE_ERROR.NOT_FOUND;
}

export function isUniqueViolationError(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === SUPABASE_ERROR.UNIQUE_VIOLATION;
}
