import type { AppError } from '@/shared/lib/errorHandling/errors';
import {
  reportError,
  type ErrorReportOptions,
} from '@/shared/lib/errorHandling/coreReporter';

/**
 * Infra-safe error normalization/logging facade.
 *
 * Accepts runtime-style options for call-site compatibility, but intentionally
 * never triggers UI presentation side effects.
 */
interface RuntimeErrorReportOptions extends ErrorReportOptions {
  toastTitle?: string;
  showToast?: boolean;
}

export function normalizeAndReportError(
  error: unknown,
  options: RuntimeErrorReportOptions,
): AppError {
  const { context, logData, onError } = options;
  return reportError(error, { context, logData, onError });
}
