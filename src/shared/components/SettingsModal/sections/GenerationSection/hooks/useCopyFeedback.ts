import { useCallback, useState } from 'react';

export function useCopyFeedback() {
  const [copiedInstallCommand, setCopiedInstallCommand] = useState(false);
  const [copiedRunCommand, setCopiedRunCommand] = useState(false);
  const [copiedAIInstructions, setCopiedAIInstructions] = useState(false);

  const triggerCopyFeedback = useCallback(
    (
      setCopied: React.Dispatch<React.SetStateAction<boolean>>,
      timeoutMs = 3000
    ) => {
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
    },
    []
  );

  return {
    copiedInstallCommand,
    copiedRunCommand,
    copiedAIInstructions,
    markInstallCopied: () => triggerCopyFeedback(setCopiedInstallCommand),
    markRunCopied: () => triggerCopyFeedback(setCopiedRunCommand),
    markAICopied: () => triggerCopyFeedback(setCopiedAIInstructions),
  };
}
