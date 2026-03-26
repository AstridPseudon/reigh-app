import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/components/ui/contracts/cn';
import type { ParameterDefinition, ParameterSchema } from '@/tools/video-editor/types';

export interface ParameterControlsProps {
  schema: ParameterSchema;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
  className?: string;
}

const getFallbackValue = (parameter: ParameterDefinition): number | string | boolean => {
  if (parameter.default !== undefined) {
    return parameter.default;
  }

  switch (parameter.type) {
    case 'number':
      return parameter.min ?? 0;
    case 'select':
      return parameter.options?.[0]?.value ?? '';
    case 'boolean':
      return false;
    case 'color':
      return '#000000';
    default:
      return '';
  }
};

export function getDefaultValues(schema: ParameterSchema): Record<string, unknown> {
  return schema.reduce<Record<string, unknown>>((defaults, parameter) => {
    defaults[parameter.name] = getFallbackValue(parameter);
    return defaults;
  }, {});
}

function getDisplayValue(parameter: ParameterDefinition, value: unknown): number | string | boolean {
  if (value !== undefined) {
    return value as number | string | boolean;
  }

  return getFallbackValue(parameter);
}

export function ParameterControls({
  schema,
  values,
  onChange,
  disabled = false,
  className,
}: ParameterControlsProps) {
  if (schema.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card/60 p-3', className)}>
      {schema.map((parameter) => {
        const value = getDisplayValue(parameter, values[parameter.name]);

        return (
          <div key={parameter.name} className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{parameter.label}</div>
                <div className="text-xs text-muted-foreground">{parameter.description}</div>
              </div>
              {parameter.type === 'number' && (
                <div className="shrink-0 text-xs font-medium text-muted-foreground">{String(value)}</div>
              )}
            </div>

            {parameter.type === 'number' && (
              <Slider
                min={parameter.min ?? 0}
                max={parameter.max ?? 100}
                step={parameter.step ?? 1}
                value={typeof value === 'number' ? value : Number(value) || 0}
                onValueChange={(nextValue) => onChange(parameter.name, nextValue)}
                disabled={disabled}
              />
            )}

            {parameter.type === 'select' && (
              <Select
                value={typeof value === 'string' ? value : String(value)}
                onValueChange={(nextValue) => onChange(parameter.name, nextValue)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {(parameter.options ?? []).map((option) => (
                    <SelectItem key={`${parameter.name}:${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {parameter.type === 'boolean' && (
              <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                <div className="text-sm text-foreground">{(value as boolean) ? 'Enabled' : 'Disabled'}</div>
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={(nextValue) => onChange(parameter.name, nextValue)}
                  disabled={disabled}
                />
              </div>
            )}

            {parameter.type === 'color' && (
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={typeof value === 'string' ? value : String(value)}
                  onChange={(event) => onChange(parameter.name, event.target.value)}
                  disabled={disabled}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {String(value)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
