import { ConfirmDialog } from './ConfirmDialog';

export interface DeleteGenerationConfirmContract {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function DeleteGenerationConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isConfirming,
}: DeleteGenerationConfirmContract) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Generation"
      description="Are you sure you want to delete this generation? This action cannot be undone."
      confirmText="Delete"
      destructive
      onConfirm={onConfirm}
      isLoading={isConfirming}
    />
  );
}
