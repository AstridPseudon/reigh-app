import * as React from "react"
import { cn } from "@/shared/components/ui/contracts/cn"
import {
  TextFieldActionButtons,
  type ClearableVoiceFieldProps,
  useTextFieldActions,
} from "./textFieldActions"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    ClearableVoiceFieldProps {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    clearable = false,
    onClear,
    voiceInput = false,
    onVoiceResult,
    voiceTask = "transcribe_and_write",
    voiceContext,
    voiceExample,
    onVoiceError,
    ...props
  }, ref) => {
    const fieldActions = useTextFieldActions({
      value: props.value,
      defaultValue: props.defaultValue,
      clearable,
      onClear,
      voiceInput,
      onVoiceResult,
      disabled: props.disabled,
    })

    const isShortTextarea =
      className?.includes("h-8") || className?.includes("min-h-0") || className?.includes("h-10")

    return (
      <div
        className="relative"
        onMouseEnter={() => fieldActions.setIsHovered(true)}
        onMouseLeave={() => fieldActions.setIsHovered(false)}
      >
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base lg:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 preserve-case",
            fieldActions.hasActions && "pr-10",
            className
          )}
          ref={ref}
          {...props}
        />

        {fieldActions.showButtons && (
          <TextFieldActionButtons
            showVoice={fieldActions.showVoice}
            showClear={fieldActions.showClear}
            existingValue={fieldActions.existingValue}
            disabled={props.disabled}
            onVoiceActiveStateChange={fieldActions.setIsAIInputActive}
            onClearClick={fieldActions.handleClear}
            containerClassName={cn(
              "absolute right-0 z-10",
              isShortTextarea
                ? "top-1/2 -translate-y-1/2 right-2 flex items-center gap-1"
                : "top-0 bottom-0 w-8 flex flex-col items-center gap-1 py-1.5"
            )}
            voiceButtonClassName={isShortTextarea ? undefined : "flex-1 w-6 min-h-0"}
            clearButtonClassName="flex-shrink-0"
            voiceTask={voiceTask}
            onVoiceResult={onVoiceResult}
            onVoiceError={onVoiceError}
            voiceContext={voiceContext}
            voiceExample={voiceExample}
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
