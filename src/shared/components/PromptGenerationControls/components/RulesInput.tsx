import React from 'react';
import { Label } from '@/shared/components/ui/primitives/label';
import { Textarea } from '@/shared/components/ui/textarea';

const formatBulletLines = (text: string): string => {
  return text
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine !== '' && !line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
        return `• ${line}`;
      }
      return line;
    })
    .join('\n');
};

interface RulesInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  isDesktop: boolean;
}

export const RulesInput: React.FC<RulesInputProps> = ({
  value,
  onChange,
  disabled,
  isDesktop,
}) => {
  return (
    <div>
      <Label htmlFor={`gen_rulesToRememberText_${isDesktop ? 'desktop' : 'mobile'}`} className="mb-2 block">
        Rules/Constraints:
      </Label>
      <Textarea
        id={`gen_rulesToRememberText_${isDesktop ? 'desktop' : 'mobile'}`}
        value={value}
        onChange={(event) => {
          const formatted = formatBulletLines(event.target.value);
          onChange(formatted);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            const textarea = event.target as HTMLTextAreaElement;
            const cursorPos = textarea.selectionStart;
            const currentValue = textarea.value;
            const newValue = `${currentValue.slice(0, cursorPos)}\n• ${currentValue.slice(cursorPos)}`;
            onChange(newValue);
            setTimeout(() => {
              textarea.setSelectionRange(cursorPos + 3, cursorPos + 3);
            }, 0);
          } else if (event.key === 'Backspace') {
            const textarea = event.target as HTMLTextAreaElement;
            const cursorPos = textarea.selectionStart;
            const cursorEnd = textarea.selectionEnd;
            const currentValue = textarea.value;

            if (cursorPos === cursorEnd && cursorPos > 0) {
              const lines = currentValue.split('\n');
              let currentLineStart = 0;
              let currentLineIndex = 0;

              for (let index = 0; index < lines.length; index += 1) {
                const lineLength = lines[index].length + (index < lines.length - 1 ? 1 : 0);
                if (currentLineStart + lineLength > cursorPos) {
                  currentLineIndex = index;
                  break;
                }
                currentLineStart += lineLength;
              }

              const currentLine = lines[currentLineIndex];
              const positionInLine = cursorPos - currentLineStart;
              const isEmptyBulletLine =
                currentLine === '• ' ||
                currentLine === '- ' ||
                currentLine === '* ' ||
                currentLine === '•' ||
                currentLine === '-' ||
                currentLine === '*';

              const shouldDeleteEmptyBulletLine = currentLineIndex > 0 && isEmptyBulletLine;
              const shouldDeleteAtBeginning =
                currentLineIndex > 0 &&
                positionInLine === 0 &&
                (currentLine.startsWith('• ') || currentLine.startsWith('- ') || currentLine.startsWith('* '));

              if (shouldDeleteEmptyBulletLine || shouldDeleteAtBeginning) {
                event.preventDefault();
                const newLines = [...lines];
                newLines.splice(currentLineIndex, 1);
                onChange(newLines.join('\n'));
                const previousLineEnd = currentLineStart - 1;
                setTimeout(() => {
                  textarea.setSelectionRange(previousLineEnd, previousLineEnd);
                }, 0);
              }
            }
          }
        }}
        onFocus={(event) => {
          if (event.target.value.trim() === '') {
            onChange('• ');
            setTimeout(() => {
              event.target.setSelectionRange(2, 2);
            }, 0);
          }
        }}
        placeholder="e.g., Under 50 words&#10;No modern technology&#10;Include vivid descriptions"
        rows={3}
        disabled={disabled}
        clearable
        onClear={() => onChange('')}
        voiceInput
        voiceContext="These are rules and constraints for AI prompt generation. List requirements like 'keep prompts under 50 words' or 'always include lighting details'. Speak each rule clearly - they will be formatted as bullet points."
        onVoiceResult={(result) => {
          const text = result.prompt || result.transcription;
          const formatted = text.startsWith('•') || text.startsWith('-') || text.startsWith('*')
            ? text
            : `• ${text}`;
          onChange(formatted);
        }}
      />
    </div>
  );
};
