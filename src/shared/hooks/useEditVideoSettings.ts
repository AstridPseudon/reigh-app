import { useAutoSaveSettings } from '@/shared/hooks/useAutoSaveSettings';
import { editVideoSettings, EditVideoSettings } from '@/shared/lib/editVideoDefaults';
import { TOOL_IDS } from '@/shared/lib/toolConstants';

// Re-export the type so existing imports keep working
export type { EditVideoSettings } from '@/shared/lib/editVideoDefaults';

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
