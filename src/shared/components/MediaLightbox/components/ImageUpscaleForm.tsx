/**
 * ImageUpscaleForm Component (displayed as "Enhance")
 *
 * Simple form for image enhancement - creates an upscale task.
 * Follows the same pattern as inpainting: button shows loading, then success briefly.
 */

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { ArrowUp, Loader2, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ImageUpscaleFormProps {
  onUpscale: () => Promise<void>;
  isUpscaling: boolean;
  upscaleSuccess: boolean;
  variant?: 'desktop' | 'mobile';
}

export const ImageUpscaleForm: React.FC<ImageUpscaleFormProps> = ({
  onUpscale,
  isUpscaling,
  upscaleSuccess,
  variant = 'desktop',
}) => {
  const isMobile = variant === 'mobile';

  return (
    <div className={cn("flex flex-col gap-4", isMobile ? "px-3 py-2" : "p-4")}>
      {/* Info section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowUp className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Enhance Resolution</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Increase image resolution using AI upscaling (2x). Creates a new high-resolution variant.
        </p>
      </div>

      {/* Enhance Button */}
      <Button
        onClick={onUpscale}
        disabled={isUpscaling || upscaleSuccess}
        className={cn(
          "w-full",
          upscaleSuccess && "bg-green-600 hover:bg-green-600"
        )}
        size={isMobile ? 'default' : 'lg'}
      >
        {isUpscaling ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating task...
          </>
        ) : upscaleSuccess ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Task Created
          </>
        ) : (
          <>
            <ArrowUp className="mr-2 h-4 w-4" />
            Enhance Image
          </>
        )}
      </Button>
    </div>
  );
};
