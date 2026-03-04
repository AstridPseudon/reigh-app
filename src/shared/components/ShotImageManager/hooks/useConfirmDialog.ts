import { useState } from 'react';

export function useConfirmDialog() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const openConfirm = (ids: string[]) => {
    setPendingDeleteIds(ids);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPendingDeleteIds([]);
  };

  return {
    confirmOpen,
    setConfirmOpen,
    pendingDeleteIds,
    setPendingDeleteIds,
    openConfirm,
    closeConfirm,
  };
}
