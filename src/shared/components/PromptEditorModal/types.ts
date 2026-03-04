import { type GenerationControlValues as PGC_GenerationControlValues } from '@/shared/components/PromptGenerationControls';
import { type BulkEditControlValues as BEC_BulkEditControlValues } from '@/shared/components/PromptEditorModal/BulkEditControls';

export type GenerationControlValues = PGC_GenerationControlValues;
export type BulkEditControlValues = BEC_BulkEditControlValues;
export type EditorMode = 'generate' | 'remix' | 'bulk-edit';

export interface PersistedEditorControlsSettings {
  generationSettings: GenerationControlValues;
  bulkEditSettings: BulkEditControlValues;
  activeTab: EditorMode;
}
