import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerationControlValues } from '../types';
import { temperatureOptions } from '../types';

interface UseGenerationControlsStateParams {
  initialValues?: Partial<GenerationControlValues>;
  onValuesChange?: (values: GenerationControlValues) => void;
  remixMode: boolean;
}

export function useGenerationControlsState({
  initialValues,
  onValuesChange,
  remixMode,
}: UseGenerationControlsStateParams) {
  const [overallPromptText, setOverallPromptText] = useState(initialValues?.overallPromptText || '');
  const [remixPromptText, setRemixPromptText] = useState(initialValues?.remixPromptText || 'More like this');
  const [rulesToRememberText, setRulesToRememberText] = useState(initialValues?.rulesToRememberText || '');
  const [numberToGenerate, setNumberToGenerate] = useState<number>(initialValues?.numberToGenerate || 16);
  const [includeExistingContext, setIncludeExistingContext] = useState(initialValues?.includeExistingContext ?? true);
  const [replaceCurrentPrompts, setReplaceCurrentPrompts] = useState(initialValues?.replaceCurrentPrompts || false);
  const [temperature, setTemperature] = useState<number>(initialValues?.temperature || 0.8);
  const [showAdvanced, setShowAdvanced] = useState(initialValues?.showAdvanced || false);

  const hasHydratedRef = useRef(false);

  const emitChange = useCallback((overrides?: Partial<GenerationControlValues>) => {
    if (!onValuesChange) {
      return;
    }

    onValuesChange({
      overallPromptText,
      remixPromptText,
      rulesToRememberText,
      numberToGenerate,
      includeExistingContext,
      addSummary: true,
      replaceCurrentPrompts,
      temperature,
      showAdvanced,
      ...overrides,
    });
  }, [
    onValuesChange,
    overallPromptText,
    remixPromptText,
    rulesToRememberText,
    numberToGenerate,
    includeExistingContext,
    replaceCurrentPrompts,
    temperature,
    showAdvanced,
  ]);

  useEffect(() => {
    if (!hasHydratedRef.current && initialValues) {
      const hydratedValues = {
        overallPromptText: initialValues.overallPromptText || '',
        remixPromptText: initialValues.remixPromptText || 'More like this',
        rulesToRememberText: initialValues.rulesToRememberText || '',
        numberToGenerate: initialValues.numberToGenerate || 3,
        includeExistingContext: initialValues.includeExistingContext ?? true,
        replaceCurrentPrompts: initialValues.replaceCurrentPrompts || false,
        temperature: initialValues.temperature || 0.8,
        showAdvanced: initialValues.showAdvanced || false,
      };

      setOverallPromptText(hydratedValues.overallPromptText);
      setRemixPromptText(hydratedValues.remixPromptText);
      setRulesToRememberText(hydratedValues.rulesToRememberText);
      setNumberToGenerate(hydratedValues.numberToGenerate);
      setIncludeExistingContext(hydratedValues.includeExistingContext);
      setReplaceCurrentPrompts(hydratedValues.replaceCurrentPrompts);
      setTemperature(hydratedValues.temperature);
      setShowAdvanced(hydratedValues.showAdvanced);

      hasHydratedRef.current = true;
      onValuesChange?.({ ...hydratedValues, addSummary: true });
    }
  }, [initialValues, onValuesChange]);

  useEffect(() => {
    if (remixMode) {
      setIncludeExistingContext(true);
      setReplaceCurrentPrompts(true);
      onValuesChange?.({
        overallPromptText,
        remixPromptText,
        rulesToRememberText,
        numberToGenerate,
        includeExistingContext: true,
        addSummary: true,
        replaceCurrentPrompts: true,
        temperature,
        showAdvanced,
      });
    }
  }, [
    remixMode,
    onValuesChange,
    overallPromptText,
    remixPromptText,
    rulesToRememberText,
    numberToGenerate,
    temperature,
    showAdvanced,
  ]);

  const setTemperatureWithSnap = useCallback((newValue: number | readonly number[]) => {
    const normalizedValue = Array.isArray(newValue) ? (newValue[0] ?? temperature) : newValue;
    const closest = temperatureOptions.reduce((previous, current) =>
      Math.abs(current.value - normalizedValue) < Math.abs(previous.value - normalizedValue)
        ? current
        : previous,
    );
    setTemperature(closest.value);
    emitChange({ temperature: closest.value });
  }, [emitChange, temperature]);

  return {
    overallPromptText,
    remixPromptText,
    rulesToRememberText,
    numberToGenerate,
    includeExistingContext,
    replaceCurrentPrompts,
    temperature,
    showAdvanced,
    emitChange,
    setOverallPromptText,
    setRemixPromptText,
    setRulesToRememberText,
    setNumberToGenerate,
    setIncludeExistingContext,
    setReplaceCurrentPrompts,
    setTemperatureWithSnap,
    setShowAdvanced,
  };
}
