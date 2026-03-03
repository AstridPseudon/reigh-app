import { Label } from '@/shared/components/ui/primitives/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { SectionHeader } from '@/shared/components/ImageGenerationForm/components';

interface JoinClipsPromptSettingsProps {
  prompt: string;
  setPrompt: (val: string) => void;
  negativePrompt: string;
  setNegativePrompt: (val: string) => void;
  useIndividualPrompts?: boolean;
  setUseIndividualPrompts?: (val: boolean) => void;
  clipCount: number;
  enhancePrompt?: boolean;
  setEnhancePrompt?: (val: boolean) => void;
}

export function JoinClipsPromptSettings({
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  useIndividualPrompts,
  setUseIndividualPrompts,
  clipCount,
  enhancePrompt,
  setEnhancePrompt,
}: JoinClipsPromptSettingsProps) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Settings" theme="blue" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="gap-y-2 flex flex-col">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="join-prompt">Global Prompt:</Label>
            {setUseIndividualPrompts && clipCount > 2 && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="useIndividualPrompts"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Set individually
                </Label>
                <Switch
                  id="useIndividualPrompts"
                  checked={useIndividualPrompts}
                  onCheckedChange={setUseIndividualPrompts}
                />
              </div>
            )}
          </div>
          <Textarea
            id="join-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              useIndividualPrompts
                ? 'Appended to each individual transition prompt'
                : 'Describe what you want for all transitions'
            }
            rows={5}
            className="resize-none bg-background/50 flex-1 min-h-[120px]"
            clearable
            onClear={() => setPrompt('')}
            voiceInput
            voiceContext="This is a global prompt for video clip transitions. Describe the motion, style, or visual effect you want for joining video clips together. Focus on transition dynamics like camera movement, morphing effects, or smooth blending between scenes."
            onVoiceResult={(result) => {
              setPrompt(result.prompt || result.transcription);
            }}
          />
          {useIndividualPrompts && (
            <p className="text-xs text-muted-foreground">
              💡 This will be inserted after each individual prompt
            </p>
          )}
        </div>

        <div className="gap-y-2 flex flex-col">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="join-negative-prompt">Negative Prompt:</Label>
          </div>
          <Textarea
            id="join-negative-prompt"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="What to avoid in all transitions (optional)"
            rows={5}
            className="resize-none bg-background/50 flex-1 min-h-[120px]"
            clearable
            onClear={() => setNegativePrompt('')}
            voiceInput
            voiceContext="This is a negative prompt - things to AVOID in video transitions. List unwanted qualities like 'jerky, flickering, blurry, distorted, unnatural motion'. Keep it as a comma-separated list of terms to avoid."
            onVoiceResult={(result) => {
              setNegativePrompt(result.prompt || result.transcription);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-x-2 p-3 bg-muted/30 rounded-lg border">
        <Switch
          id="join-enhance-prompt"
          checked={enhancePrompt}
          onCheckedChange={(val) => {
            setEnhancePrompt?.(val);
          }}
        />
        <div className="flex-1">
          <Label htmlFor="join-enhance-prompt" className="font-medium cursor-pointer">
            Enhance/Create Prompts
          </Label>
        </div>
      </div>
    </div>
  );
}
