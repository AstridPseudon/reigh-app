import * as React from "react"
import { Button, type ButtonProps } from "./button"
import { cn } from "@/shared/lib/utils"

export interface LoadingButtonProps extends ButtonProps {
  /** Whether the button is in a loading state */
  isLoading?: boolean
  /** Text to show while loading (defaults to children) */
  loadingText?: string
}

/**
 * Button with built-in loading state management.
 *
 * Automatically:
 * - Disables the button while loading
 * - Shows a spinner
 * - Optionally swaps text with loadingText
 *
 * @example
 * // Basic usage
 * <LoadingButton isLoading={mutation.isPending}>
 *   Save
 * </LoadingButton>
 *
 * @example
 * // With loading text
 * <LoadingButton isLoading={isSubmitting} loadingText="Saving...">
 *   Save Changes
 * </LoadingButton>
 */
const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, children, isLoading, loadingText, disabled, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {isLoading && loadingText ? loadingText : children}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
