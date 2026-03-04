import { DefaultableTextarea } from '@/shared/components/DefaultableTextarea';
import type { SegmentSettings, SegmentSettingsFormProps } from '@/shared/components/SegmentSettingsForm/types';

interface PromptFieldsSectionProps {
  settings: SegmentSettings;
  onChange: (updates: Partial<SegmentSettings>) => void;
  shotDefaults?: SegmentSettingsFormProps['shotDefaults'];
  hasOverride?: SegmentSettingsFormProps['hasOverride'];
  onSaveFieldAsDefault?: SegmentSettingsFormProps['onSaveFieldAsDefault'];
  handleSaveFieldAsDefault: (field: keyof SegmentSettings, value: unknown) => Promise<void>;
  savingField: string | null;
}

export function PromptFieldsSection({
  settings,
  onChange,
  shotDefaults,
  hasOverride,
  onSaveFieldAsDefault,
  handleSaveFieldAsDefault,
  savingField,
}: PromptFieldsSectionProps) {
  if (
    shotDefaults?.textBeforePrompts === undefined &&
    shotDefaults?.textAfterPrompts === undefined
  ) {
    return null;
  }

  return (
    <div className="space-y-2">
      <DefaultableTextarea
        label="Before:"
        value={settings.textBeforePrompts}
        defaultValue={shotDefaults?.textBeforePrompts}
        hasDbOverride={hasOverride?.textBeforePrompts}
        onChange={(value) => onChange({ textBeforePrompts: value })}
        onClear={() => onChange({ textBeforePrompts: '' })}
        onUseDefault={() => onChange({ textBeforePrompts: undefined })}
        onSetAsDefault={
          onSaveFieldAsDefault
            ? (displayValue) =>
                handleSaveFieldAsDefault('textBeforePrompts', displayValue)
            : undefined
        }
        isSavingDefault={savingField === 'textBeforePrompts'}
        className="min-h-0 h-8 text-xs resize-none py-1.5 overflow-hidden"
        placeholder="Text to prepend..."
        voiceInput
        voiceContext="This is text to prepend before video prompts. Keep it brief - style keywords, quality tags, or consistent elements."
        onVoiceResult={(result) => {
          onChange({ textBeforePrompts: result.prompt || result.transcription });
        }}
      />
      <DefaultableTextarea
        label="After:"
        value={settings.textAfterPrompts}
        defaultValue={shotDefaults?.textAfterPrompts}
        hasDbOverride={hasOverride?.textAfterPrompts}
        onChange={(value) => onChange({ textAfterPrompts: value })}
        onClear={() => onChange({ textAfterPrompts: '' })}
        onUseDefault={() => onChange({ textAfterPrompts: undefined })}
        onSetAsDefault={
          onSaveFieldAsDefault
            ? (displayValue) =>
                handleSaveFieldAsDefault('textAfterPrompts', displayValue)
            : undefined
        }
        isSavingDefault={savingField === 'textAfterPrompts'}
        className="min-h-0 h-8 text-xs resize-none py-1.5 overflow-hidden"
        placeholder="Text to append..."
        voiceInput
        voiceContext="This is text to append after video prompts. Keep it brief - style keywords, quality tags, or consistent elements."
        onVoiceResult={(result) => {
          onChange({ textAfterPrompts: result.prompt || result.transcription });
        }}
      />
    </div>
  );
}
