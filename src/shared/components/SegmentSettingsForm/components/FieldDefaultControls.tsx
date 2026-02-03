/**
 * FieldDefaultControls Component
 *
 * Shows either a "Default" badge (when using shot defaults) or two action buttons
 * (when overridden): "Reset" to clear override, "Set as Default" to save as new default.
 */

import React from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';

export interface FieldDefaultControlsProps {
  isUsingDefault: boolean;
  onUseDefault: () => void;
  onSetAsDefault?: () => void;
  isSaving?: boolean;
  className?: string;
}

export const FieldDefaultControls: React.FC<FieldDefaultControlsProps> = ({
  isUsingDefault,
  onUseDefault,
  onSetAsDefault,
  isSaving,
  className = '',
}) => {
  if (isUsingDefault) {
    return (
      <span className={`text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded ${className}`}>
        Default
      </span>
    );
  }
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onUseDefault}
        disabled={isSaving}
        className="text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors disabled:opacity-50"
        title="Use the shot default value"
      >
        <RotateCcw className="w-2.5 h-2.5" />
        Use Default
      </button>
      {onSetAsDefault && (
        <button
          type="button"
          onClick={onSetAsDefault}
          disabled={isSaving}
          className="text-[10px] bg-muted hover:bg-primary/15 text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors disabled:opacity-50"
          title="Set this value as the shot default"
        >
          {isSaving ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <Save className="w-2.5 h-2.5" />
          )}
          Set as Default
        </button>
      )}
    </div>
  );
};

export default FieldDefaultControls;
