import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/shared/lib/utils"

const TooltipProvider: React.FC<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>> = ({ delayDuration = 0, ...props }) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[100010] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150 data-[state=closed]:ease-in",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/**
 * Touch-aware tooltip that works on both desktop (hover) and touch devices (tap).
 * On touch devices, tapping the trigger toggles the tooltip open/closed.
 * Tapping outside closes it.
 *
 * Usage:
 * <TouchableTooltip content={<p>Tooltip text</p>}>
 *   <button>Trigger</button>
 * </TouchableTooltip>
 */
interface TouchableTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  contentClassName?: string;
}

const TouchableTooltip: React.FC<TouchableTooltipProps> = ({
  children,
  content,
  side = 'bottom',
  className,
  contentClassName,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent mouse events from firing
    e.stopPropagation();
    setOpen(prev => !prev);
  }, []);

  // Clone child to add touch handler without wrapping in a span
  // This preserves the child's positioning (e.g., position: absolute)
  const child = React.Children.only(children) as React.ReactElement;
  const triggerElement = React.cloneElement(child, {
    onTouchEnd: (e: React.TouchEvent) => {
      handleTouchEnd(e);
      // Call original handler if it exists
      child.props.onTouchEnd?.(e);
    },
    className: cn(child.props.className, className),
  });

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          {triggerElement}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className={contentClassName}
          // Radix handles outside clicks correctly (excludes tooltip content)
          onPointerDownOutside={() => setOpen(false)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TouchableTooltip }
