import { createContext, useContext, type ReactNode } from 'react';
import { requireContextValue } from '@/shared/contexts/contextGuard';
import type { SelectedMediaClip } from '@/tools/video-editor/hooks/useSelectedMediaClips';

export type AgentChatContextValue = {
  timelineId: string | null;
  timelineClips: SelectedMediaClip[];
  replaceSelectedTimelineClips: (clips: SelectedMediaClip[]) => void;
};

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

type AgentChatProviderProps = {
  value: AgentChatContextValue;
  children: ReactNode;
};

export function AgentChatProvider({ value, children }: AgentChatProviderProps) {
  return (
    <AgentChatContext.Provider value={value}>
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChatBridge(): AgentChatContextValue {
  const context = useContext(AgentChatContext);
  return requireContextValue(context, 'useAgentChatBridge', 'AgentChatProvider');
}
