import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function useCopyFeedback() {
  const [copiedInstallCommand, setCopiedInstallCommand] = useState(false);
  const [copiedRunCommand, setCopiedRunCommand] = useState(false);
  const [copiedAIInstructions, setCopiedAIInstructions] = useState(false);

  const triggerCopyFeedback = useCallback((setCopied: Dispatch<SetStateAction<boolean>>) => {
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, []);

  return {
    copiedInstallCommand,
    copiedRunCommand,
    copiedAIInstructions,
    markInstallCopied: () => triggerCopyFeedback(setCopiedInstallCommand),
    markRunCopied: () => triggerCopyFeedback(setCopiedRunCommand),
    markAICopied: () => triggerCopyFeedback(setCopiedAIInstructions),
  };
}
