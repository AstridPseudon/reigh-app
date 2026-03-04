import { useRef, useState } from 'react';

export function useCommandVisibility() {
  const [showFullInstallCommand, setShowFullInstallCommand] = useState(false);
  const [showFullRunCommand, setShowFullRunCommand] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);

  const installCommandRef = useRef<HTMLDivElement>(null);
  const runCommandRef = useRef<HTMLDivElement>(null);

  const revealInstallCommand = () => {
    setShowFullInstallCommand(true);
    setTimeout(() => {
      installCommandRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  const revealRunCommand = () => {
    setShowFullRunCommand(true);
    setTimeout(() => {
      runCommandRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  return {
    showFullInstallCommand,
    setShowFullInstallCommand,
    showFullRunCommand,
    setShowFullRunCommand,
    showPrerequisites,
    setShowPrerequisites,
    installCommandRef,
    runCommandRef,
    revealInstallCommand,
    revealRunCommand,
  };
}
