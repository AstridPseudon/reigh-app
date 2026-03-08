import * as React from "react"
import { cn } from "@/shared/components/ui/contracts/cn"
import {
  TextFieldActionButtons,
  type ClearableVoiceFieldProps,
  useTextFieldActions,
} from "./textFieldActions"

interface InputProps extends React.ComponentProps<"input">, ClearableVoiceFieldProps {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
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

    return (
      <div
        className="relative"
        onMouseEnter={() => fieldActions.setIsHovered(true)}
        onMouseLeave={() => fieldActions.setIsHovered(false)}
      >
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-light file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm preserve-case [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]",
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
            containerClassName="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 z-10"
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
Input.displayName = "Input"

export { Input }
