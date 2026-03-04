import React, { useMemo } from 'react';
import { Slider } from '@/shared/components/ui/slider';
import { temperatureOptions } from '@/shared/components/PromptGenerationControls';

interface TemperatureSelectorProps {
  temperature: number;
  onChange: (value: number | readonly number[]) => void;
  disabled: boolean;
}

export const TemperatureSelector: React.FC<TemperatureSelectorProps> = ({
  temperature,
  onChange,
  disabled,
}) => {
  const selectedTemperatureOption = useMemo(
    () => temperatureOptions.find((option) => option.value === temperature),
    [temperature],
  );

  return (
    <div>
      <div className="text-center mb-3">
        <span className="font-light text-sm">Level of creativity</span>
      </div>
      <div className="relative mb-0">
        <Slider
          value={temperature}
          onValueChange={onChange}
          min={0.4}
          max={1.2}
          step={0.2}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>1</span>
          <span>5</span>
        </div>
      </div>
      <div className="text-center -mt-1">
        <span className="text-xs text-muted-foreground">
          {selectedTemperatureOption?.description || 'Good balance of creativity'}
        </span>
      </div>
    </div>
  );
};
