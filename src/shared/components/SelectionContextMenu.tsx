import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clapperboard, FolderPlus } from 'lucide-react';
import { cn } from '@/shared/components/ui/contracts/cn';

interface SelectionContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  onCreateShot: () => void | Promise<void>;
  onGenerateVideo: () => void | Promise<void>;
  isCreating?: boolean;
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex w-full select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        disabled
          ? 'cursor-wait opacity-60'
          : destructive
            ? 'hover:bg-destructive hover:text-destructive-foreground'
            : 'hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </button>
  );
}

export function SelectionContextMenu({
  position,
  onClose,
  onCreateShot,
  onGenerateVideo,
  isCreating = false,
}: SelectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) {
      return undefined;
    }

    const handleClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [position, onClose]);

  if (!position) {
    return null;
  }

  const handleAction = (action: () => void | Promise<void>) => {
    onClose();
    void action();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      <MenuItem
        icon={<FolderPlus className="h-4 w-4" />}
        label="Create Shot"
        onClick={() => handleAction(onCreateShot)}
        disabled={isCreating}
      />
      <MenuItem
        icon={<Clapperboard className="h-4 w-4" />}
        label="Generate Video"
        onClick={() => handleAction(onGenerateVideo)}
        disabled={isCreating}
      />
    </div>,
    document.body,
  );
}
