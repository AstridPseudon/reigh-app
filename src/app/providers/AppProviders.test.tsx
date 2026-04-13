// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgentChatBridge } from '@/shared/contexts/AgentChatContext';
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
  useUserSettings: () => ({
    userSettings: { lastTimelineId: 'timeline-from-settings' },
    isLoadingSettings: false,
    fetchUserSettings: vi.fn(),
    updateUserSettings: vi.fn(),
  }),
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

function AgentChatBridgeConsumer() {
  const bridge = useAgentChatBridge();
  return (
    <>
      <span data-testid="agent-chat-timeline-id">{bridge.timelineId ?? 'none'}</span>
      <span data-testid="agent-chat-timeline-clips">{String(bridge.timelineClips.length)}</span>
    </>
  );
}

describe('AppProviders', () => {
  it('mounts GallerySelectionProvider and the default AgentChat bridge inside the provider tree', () => {
    render(
      <AppProviders>
        <GallerySelectionConsumer />
        <AgentChatBridgeConsumer />
      </AppProviders>,
    );

    expect(screen.getByTestId('gallery-selection-context')).toHaveTextContent('available');
    expect(screen.getByTestId('agent-chat-timeline-id')).toHaveTextContent('timeline-from-settings');
    expect(screen.getByTestId('agent-chat-timeline-clips')).toHaveTextContent('0');
    expect(screen.getByTestId('PanesProvider')).toContainElement(
      screen.getByTestId('ShotAdditionSelectionProvider'),
    );
  });
});
