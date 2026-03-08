import type { TooltipRenderProps } from 'react-joyride';
import {
  ChevronRight,
  ChevronLeft,
  Lock,
  Images,
  Sparkles,
  Lightbulb,
  Layout,
  Film,
  ListTodo,
  Wrench,
  PartyPopper,
  Layers,
} from 'lucide-react';
import { tourStepColors } from './tourSteps';

const stepIcons = [
  Lock,
  Images,
  Sparkles,
  Lightbulb,
  Layout,
  Film,
  Layers,
  Film,
  ListTodo,
  Wrench,
  PartyPopper,
];

export function CustomTooltip({
  continuous,
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
}: TooltipRenderProps) {
  const colors = tourStepColors[index % tourStepColors.length];
  const Icon = stepIcons[index] || PartyPopper;
  const totalSteps = size;

  return (
    <div
      {...tooltipProps}
      className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-xs z-[100011] animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <div className="text-center space-y-2 mb-3">
        <div className={`mx-auto w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
        {step.title && (
          <h3 className="text-base font-semibold text-center text-foreground">
            {step.title as string}
          </h3>
        )}
      </div>
      <div className="text-center mb-3">
        <p className="text-sm text-muted-foreground">{step.content as string}</p>
      </div>
      <div className="flex justify-between items-center">
        {index > 0 ? (
          <button
            {...backProps}
            className="flex items-center gap-x-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            <span>Back</span>
          </button>
        ) : (
          <button
            {...skipProps}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        )}
        {continuous && (
          <button
            {...primaryProps}
            className="flex items-center gap-x-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <span>{isLastStep ? 'Done' : 'Next'}</span>
            {!isLastStep && <ChevronRight className="h-3 w-3" />}
          </button>
        )}
      </div>
      <div className="flex justify-center gap-x-1.5 pt-3 border-t border-border mt-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === index ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
