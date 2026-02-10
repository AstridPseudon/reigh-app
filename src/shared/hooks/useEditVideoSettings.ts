/**
 * useEditVideoSettings - Hook for managing Edit Video tool settings
 *
 * Uses useAutoSaveSettings with Edit Video specific defaults.
 * This hook was moved from tools/edit-video/hooks/ to shared/
 * because it's used by shared/components/MediaLightbox/hooks/useVideoEditing.ts.
 */

import { useAutoSaveSettings } from '@/shared/hooks/useAutoSaveSettings';
import { editVideoSettings, EditVideoSettings } from '@/shared/lib/editVideoDefaults';
import { TOOL_IDS } from '@/shared/lib/toolConstants';

// Re-export the type so existing imports keep working
export type { EditVideoSettings } from '@/shared/lib/editVideoDefaults';

/**
 * Hook for managing Edit Video tool settings at the project level
 * Uses useAutoSaveSettings with Edit Video specific defaults
 */
export function useEditVideoSettings(projectId: string | null | undefined) {
  return useAutoSaveSettings<EditVideoSettings>({
    toolId: TOOL_IDS.EDIT_VIDEO,
    scope: 'project',
    projectId,
    defaults: editVideoSettings.defaults,
    enabled: !!projectId,
    debug: false,
    debugTag: '[EditVideo]',
  });
}
