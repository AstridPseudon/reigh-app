import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import { isAbortError } from '@/shared/lib/errorHandling/errorUtils';

interface EnhancePromptsForBatchParams {
  batchBasePrompt: string;
  pairCount: number;
  pairOverridePrompts?: Array<string | undefined>;
  numFrames: number;
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
}

interface EnhanceBatchResponse {
  enhanced_prompts?: string[];
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('aborted', 'AbortError'));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
    };
    const cleanup = () => signal.removeEventListener('abort', onAbort);

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { cleanup(); resolve(v); },
      (e) => { cleanup(); reject(e); },
    );
  });
}

export async function enhancePromptsForBatch({
  batchBasePrompt,
  pairCount,
  pairOverridePrompts,
  numFrames,
  onProgress,
  signal,
}: EnhancePromptsForBatchParams): Promise<string[]> {
  if (pairCount <= 0) return [];

  // Resolve each pair's prompt: per-pair override or shared base prompt
  const resolvedPrompts = Array.from({ length: pairCount }, (_, i) =>
    pairOverridePrompts?.[i] || batchBasePrompt,
  );

  onProgress?.(0, pairCount);

  const invocation = supabase().functions.invoke<EnhanceBatchResponse>('ai-prompt', {
    body: {
      task: 'enhance_segment_prompt',
      prompts: resolvedPrompts,
      temperature: 0.7,
      numFrames,
    },
  });

  const { data, error } = await raceWithAbort(invocation, signal);

  if (error) {
    if (isAbortError(error)) throw error;
    // On failure, fall back to original prompts
    onProgress?.(pairCount, pairCount);
    return resolvedPrompts;
  }

  const enhanced = data?.enhanced_prompts ?? resolvedPrompts;
  onProgress?.(pairCount, pairCount);
  return enhanced;
}
