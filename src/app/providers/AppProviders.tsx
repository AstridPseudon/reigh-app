import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { AuthGate } from '@/shared/auth/components/AuthGate';
import { UserSettingsProvider } from '@/shared/contexts/UserSettingsContext';
import { ProjectProvider } from '@/shared/contexts/ProjectContext';
import { RealtimeProvider } from '@/shared/providers/RealtimeProvider';
import { ShotsProvider } from '@/shared/contexts/ShotsContext';
import { GenerationTaskProvider } from '@/shared/contexts/GenerationTaskContext';
import { IncomingTasksProvider } from '@/shared/contexts/IncomingTasksContext';
import { PanesProvider } from '@/shared/contexts/PanesContext';
import { GallerySelectionProvider } from '@/shared/contexts/GallerySelectionContext';
import {
  AgentChatProvider,
  type AgentChatContextValue,
} from '@/shared/contexts/AgentChatContext';
import { LastAffectedShotProvider } from '@/shared/contexts/LastAffectedShotContext';
import { CurrentShotProvider } from '@/shared/contexts/CurrentShotContext';
import { ToolPageHeaderProvider } from '@/shared/contexts/ToolPageHeaderContext';
import { ShotAdditionSelectionProvider } from '@/shared/contexts/ShotAdditionSelectionContext';
import { useUserSettings } from '@/shared/contexts/UserSettingsContext';
import { TaskTypeConfigInitializer } from '@/shared/components/TaskTypeConfigInitializer';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { queryClient } from '@/app/providers/queryClient';

interface AppProvidersProps {
  children: React.ReactNode;
}

type TreeProvider = React.ComponentType<{ children: React.ReactNode }>;

const noopReplaceSelectedTimelineClips: AgentChatContextValue['replaceSelectedTimelineClips'] = () => {};

function DefaultAgentChatProvider({ children }: { children: React.ReactNode }) {
  const { userSettings } = useUserSettings();
  const value = React.useMemo<AgentChatContextValue>(() => ({
    timelineId: userSettings?.lastTimelineId ?? null,
    timelineClips: [],
    replaceSelectedTimelineClips: noopReplaceSelectedTimelineClips,
  }), [userSettings?.lastTimelineId]);

  return (
    <AgentChatProvider value={value}>
      {children}
    </AgentChatProvider>
  );
}

function composeProviders(providers: TreeProvider[]): TreeProvider {
  return function ProviderTree({ children }: { children: React.ReactNode }) {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
  };
}

const AppProviderTree = composeProviders([
  AuthProvider,
  AuthGate,
  TaskTypeConfigInitializer,
  UserSettingsProvider,
  ProjectProvider,
  RealtimeProvider,
  ShotsProvider,
  GenerationTaskProvider,
  IncomingTasksProvider,
  PanesProvider,
  GallerySelectionProvider,
  DefaultAgentChatProvider,
  ShotAdditionSelectionProvider,
  LastAffectedShotProvider,
  CurrentShotProvider,
  ToolPageHeaderProvider,
]);

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AppProviderTree>{children}</AppProviderTree>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
