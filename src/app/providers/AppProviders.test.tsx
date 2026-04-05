// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGallerySelectionOptional } from '@/shared/contexts/GallerySelectionContext';
import { AppProviders } from './AppProviders';

function passthroughProvider(testId: string) {
  return function Provider({ children }: { children: ReactNode }) {
    return <div data-testid={testId}>{children}</div>;
  };
}

vi.mock('@/shared/contexts/AuthContext', () => ({
  AuthProvider: passthroughProvider('AuthProvider'),
}));

vi.mock('@/shared/auth/components/AuthGate', () => ({
  AuthGate: passthroughProvider('AuthGate'),
}));

vi.mock('@/shared/contexts/UserSettingsContext', () => ({
  UserSettingsProvider: passthroughProvider('UserSettingsProvider'),
}));

vi.mock('@/shared/contexts/ProjectContext', () => ({
  ProjectProvider: passthroughProvider('ProjectProvider'),
}));

vi.mock('@/shared/providers/RealtimeProvider', () => ({
  RealtimeProvider: passthroughProvider('RealtimeProvider'),
}));

vi.mock('@/shared/contexts/ShotsContext', () => ({
  ShotsProvider: passthroughProvider('ShotsProvider'),
}));

vi.mock('@/shared/contexts/GenerationTaskContext', () => ({
  GenerationTaskProvider: passthroughProvider('GenerationTaskProvider'),
}));

vi.mock('@/shared/contexts/IncomingTasksContext', () => ({
  IncomingTasksProvider: passthroughProvider('IncomingTasksProvider'),
}));

vi.mock('@/shared/contexts/PanesContext', () => ({
  PanesProvider: passthroughProvider('PanesProvider'),
}));

vi.mock('@/shared/contexts/LastAffectedShotContext', () => ({
  LastAffectedShotProvider: passthroughProvider('LastAffectedShotProvider'),
}));

vi.mock('@/shared/contexts/CurrentShotContext', () => ({
  CurrentShotProvider: passthroughProvider('CurrentShotProvider'),
}));

vi.mock('@/shared/contexts/ToolPageHeaderContext', () => ({
  ToolPageHeaderProvider: passthroughProvider('ToolPageHeaderProvider'),
}));

vi.mock('@/shared/contexts/ShotAdditionSelectionContext', () => ({
  ShotAdditionSelectionProvider: passthroughProvider('ShotAdditionSelectionProvider'),
}));

vi.mock('@/shared/components/TaskTypeConfigInitializer', () => ({
  TaskTypeConfigInitializer: passthroughProvider('TaskTypeConfigInitializer'),
}));

function GallerySelectionConsumer() {
  const context = useGallerySelectionOptional();
  return <span data-testid="gallery-selection-context">{context ? 'available' : 'missing'}</span>;
}

describe('AppProviders', () => {
  it('mounts GallerySelectionProvider inside the provider tree so descendants can consume it', () => {
    render(
      <AppProviders>
        <GallerySelectionConsumer />
      </AppProviders>,
    );

    expect(screen.getByTestId('gallery-selection-context')).toHaveTextContent('available');
    expect(screen.getByTestId('PanesProvider')).toContainElement(
      screen.getByTestId('ShotAdditionSelectionProvider'),
    );
  });
});
