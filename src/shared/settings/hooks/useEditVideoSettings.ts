import { useAutoSaveSettings } from '@/shared/settings/hooks/useAutoSaveSettings';
import {
  editVideoSettings,
  type EditVideoSettings,
} from '@/tools/edit-video/settings/editVideoDefaults';
import { TOOL_IDS } from '@/shared/lib/toolIds';

export type { EditVideoSettings } from '@/tools/edit-video/settings/editVideoDefaults';

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
