import { useCallback, useEffect, useRef, useState } from 'react';
import { writeClipboardTextSafe } from '@/shared/lib/clipboard';

export function useCopyToClipboard<T>(resetMs = 2000) {
  const [copiedValue, setCopiedValue] = useState<T | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const copyText = useCallback(
    async (text: string, copiedIndicator: T) => {
      const copied = await writeClipboardTextSafe(text);
      if (!copied) {
        return false;
      }

      setCopiedValue(copiedIndicator);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => {
        setCopiedValue(null);
        resetTimeoutRef.current = null;
      }, resetMs);
      return true;
    },
    [resetMs]
  );

  return {
    copiedValue,
    copyText,
  };
}
