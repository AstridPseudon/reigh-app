/**
 * VariantDetails Component
 *
 * Shared component that fetches real task data for a variant and renders
 * GenerationDetails. Used by both VariantHoverDetails (desktop) and
 * MobileVariantDetails (mobile modal).
 */

import React from 'react';
import { GenerationDetails } from '@/shared/components/GenerationDetails';
import type { LoraModel } from '@/shared/components/LoraSelectorModal';
import { getSourceTaskId } from '@/shared/lib/taskIdHelpers';
import { useGetTask } from '@/shared/hooks/useTasks';
import type { GenerationVariant } from '@/shared/hooks/useVariants';

interface VariantDetailsProps {
  variant: GenerationVariant;
  availableLoras?: LoraModel[];
}

export const VariantDetails: React.FC<VariantDetailsProps> = ({ variant, availableLoras }) => {
  const variantParams = variant.params;
  const sourceTaskId = getSourceTaskId(variantParams);
  const { data: task, isLoading } = useGetTask(sourceTaskId || '');

  if (task && !isLoading) {
    return (
      <GenerationDetails
        task={task}
        inputImages={[]}
        variant="hover"
        isMobile={false}
        availableLoras={availableLoras}
        showCopyButtons={true}
      />
    );
  }

  return (
    <GenerationDetails
      task={{
        taskType: variantParams?.task_type || variantParams?.created_from || 'video_generation',
        params: variantParams,
      }}
      inputImages={[]}
      variant="hover"
      isMobile={false}
      availableLoras={availableLoras}
      showCopyButtons={true}
    />
  );
};
