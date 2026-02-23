export { handleError } from '@/shared/lib/errorHandling/handleError';
export {
  AppError,
  NetworkError,
  AuthError,
  SilentError,
  isAppError,
  isAuthError,
  isNetworkError,
  ValidationError,
  ServerError,
  categorizeError,
} from './errorHandling/errors';
export {
  isError,
  isErrorWithCode,
  isErrorWithStatus,
  getErrorMessage,
  isAbortError,
  isCancellationError,
} from './errorHandling/errorUtils';
