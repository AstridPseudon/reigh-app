import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { requireContextValue } from '@/shared/contexts/contextGuard';
import { useToolSettings } from '@/shared/hooks/settings/useToolSettings';
import { videoEditorSettings } from '@/tools/video-editor/settings/videoEditorDefaults';
import type { SelectedMediaClip } from '@/tools/video-editor/hooks/useSelectedMediaClips';

export type AgentChatContextValue = {
  timelineId: string | null;
  timelineClips: SelectedMediaClip[];
  replaceSelectedTimelineClips: (clips: SelectedMediaClip[]) => void;
};

type AgentChatRegistryValue = {
  register: (value: AgentChatContextValue) => void;
  unregister: () => void;
};

const AgentChatContext = createContext<AgentChatContextValue | null>(null);
const AgentChatRegistryContext = createContext<AgentChatRegistryValue | null>(null);

const noopReplace: AgentChatContextValue['replaceSelectedTimelineClips'] = () => {};

/**
 * Single app-level provider. Holds a default (settings-based) value that can be
 * overridden by VideoEditorProvider via register/unregister.
 */
export function AgentChatProvider({ children }: { children: ReactNode }) {
  const { settings: videoSettings } = useToolSettings(videoEditorSettings.id);
  const [override, setOverride] = useState<AgentChatContextValue | null>(null);

  const defaultValue = useMemo<AgentChatContextValue>(() => ({
    timelineId: videoSettings?.lastTimelineId ?? null,
    timelineClips: [],
    replaceSelectedTimelineClips: noopReplace,
  }), [videoSettings?.lastTimelineId]);

  const register = useCallback((value: AgentChatContextValue) => setOverride(value), []);
  const unregister = useCallback(() => setOverride(null), []);

  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <AgentChatRegistryContext.Provider value={registry}>
      <AgentChatContext.Provider value={override ?? defaultValue}>
        {children}
      </AgentChatContext.Provider>
    </AgentChatRegistryContext.Provider>
  );
}

/** Consumed by AgentChat to read timeline state. */
export function useAgentChatBridge(): AgentChatContextValue {
  const context = useContext(AgentChatContext);
  return requireContextValue(context, 'useAgentChatBridge', 'AgentChatProvider');
}

/** Consumed by VideoEditorProvider to push timeline state into the bridge. */
export function useAgentChatRegistry(): AgentChatRegistryValue {
  const context = useContext(AgentChatRegistryContext);
  return requireContextValue(context, 'useAgentChatRegistry', 'AgentChatProvider');
}
