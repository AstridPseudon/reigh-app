import { useEffect, useMemo } from 'react';
import { DynamicEffectRegistry } from '@/tools/video-editor/effects/DynamicEffectRegistry';
import {
  continuousEffects,
  entranceEffects,
  exitEffects,
  replaceEffectRegistry,
} from '@/tools/video-editor/effects';
import { loadDraftEffects } from '@/tools/video-editor/effects/effect-store';

const BUILT_INS = {
  ...entranceEffects,
  ...exitEffects,
  ...continuousEffects,
};

export function useEffectRegistry(
  dbEffects: Array<{ slug: string; code: string }> | undefined,
) {
  const draftEffects = useMemo(() => loadDraftEffects(), []);
  const registry = useMemo(() => new DynamicEffectRegistry(BUILT_INS), []);

  useEffect(() => {
    replaceEffectRegistry(registry);
    void Promise.all([
      ...Object.entries(draftEffects).map(([name, code]) => registry.registerAsync(name, code)),
      ...(dbEffects ?? []).map((effect) => registry.registerAsync(effect.slug, effect.code)),
    ]);
  }, [dbEffects, draftEffects, registry]);

  return registry;
}
