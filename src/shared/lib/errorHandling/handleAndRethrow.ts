import {
  normalizeAndPresentAndRethrow,
  type RuntimeErrorOptions,
} from '@/shared/lib/errorHandling/runtimeError';

function handleAndRethrow(error: unknown, options: RuntimeErrorOptions): never {
  return normalizeAndPresentAndRethrow(error, options);
}
