/**
 * HeaderSection - Shot header with navigation and name editing
 *
 * Extracted from ShotSettingsEditor for modularity.
 * Gets most data from ShotSettingsContext, only takes callback props.
 */

import React from 'react';
import { Header } from '../ui/Header';
import { useShotSettingsContext } from '../ShotSettingsContext';

interface HeaderSectionProps {
  // Navigation callbacks
  onBack: () => void;
  onPreviousShot?: () => void;
  onNextShot?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;

  // Name editing callbacks
  onUpdateShotName?: (name: string) => void;
  onNameClick: () => void;
  onNameSave: () => void;
  onNameCancel: (e?: React.MouseEvent) => void;
  onNameKeyDown: (e: React.KeyboardEvent) => void;

  // Refs (passed from parent for scroll tracking)
  headerContainerRef?: (node: HTMLDivElement | null) => void;
  centerSectionRef: React.RefObject<HTMLDivElement>;

  // Sticky state (controlled by parent)
  isSticky?: boolean;
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({
  onBack,
  onPreviousShot,
  onNextShot,
  hasPrevious,
  hasNext,
  onUpdateShotName,
  onNameClick,
  onNameSave,
  onNameCancel,
  onNameKeyDown,
  headerContainerRef,
  centerSectionRef,
  isSticky,
}) => {
  // Get shared state from context
  const { selectedShot, state, actions, effectiveAspectRatio, projectId } = useShotSettingsContext();

  return (
    <div ref={headerContainerRef}>
      <Header
        selectedShot={selectedShot}
        isEditingName={state.isEditingName}
        editingName={state.editingName}
        isTransitioningFromNameEdit={state.isTransitioningFromNameEdit}
        onBack={onBack}
        onUpdateShotName={onUpdateShotName}
        onPreviousShot={onPreviousShot}
        onNextShot={onNextShot}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onNameClick={onNameClick}
        onNameSave={onNameSave}
        onNameCancel={onNameCancel}
        onNameKeyDown={onNameKeyDown}
        onEditingNameChange={actions.setEditingNameValue}
        projectAspectRatio={effectiveAspectRatio}
        projectId={projectId}
        centerSectionRef={centerSectionRef}
        isSticky={isSticky}
      />
    </div>
  );
};
