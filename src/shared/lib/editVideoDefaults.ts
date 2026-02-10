/**
 * Edit Video defaults — shared so that both shared/ hooks and tools/edit-video/
 * can import without creating a backwards shared → tools dependency.
 *
 * The canonical tool settings object lives here; tools/edit-video/settings.ts
 * re-exports it for local convenience.
 */

import { VACE_GENERATION_DEFAULTS } from '@/shared/lib/vaceDefaults';
import { TOOL_IDS } from '@/shared/lib/toolConstants';

export const editVideoSettings = {
  id: TOOL_IDS.EDIT_VIDEO,
  scope: ['project'] as const,
  defaults: {
    ...VACE_GENERATION_DEFAULTS,
    // Edit-video-specific frame counts
    contextFrameCount: 8,
    gapFrameCount: 12,
    // Selected video info
    selectedVideoUrl: undefined as string | undefined,
    selectedVideoPosterUrl: undefined as string | undefined,
    selectedVideoGenerationId: undefined as string | undefined,
    // Portion selection (in seconds)
    portionStartTime: 0,
    portionEndTime: 0,
    // LoRAs (for basic mode - additional loras on top of preset)
    loras: [] as Array<{ id: string; strength: number }>,
    hasEverSetLoras: false as boolean,
  },
};

// TypeScript type for settings
export type EditVideoSettings = typeof editVideoSettings.defaults;
