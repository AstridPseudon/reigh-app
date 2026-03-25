import { describe, expect, it } from 'vitest';
import type { EffectComponentProps } from '@/tools/video-editor/effects/entrances';
import { DynamicEffectRegistry } from '@/tools/video-editor/effects/DynamicEffectRegistry';
import { preloadSucrase } from '@/tools/video-editor/effects/compileEffect';

function BuiltInFade(_props: EffectComponentProps) {
  return <div data-testid="builtin-fade" />;
}

describe('DynamicEffectRegistry', () => {
  it('prefers built-in effects over dynamic name collisions and resolves custom prefix lookups', async () => {
    await preloadSucrase();
    const registry = new DynamicEffectRegistry({ fade: BuiltInFade });
    registry.register('fade', 'export default function Effect(){ return <div data-testid="dynamic-fade" />; }');
    await registry.registerAsync('test', 'export default function Effect(){ return <div data-testid="custom-test" />; }');

    const FadeComponent = registry.get('fade');
    const CustomComponent = registry.get('custom:test');

    expect(FadeComponent).toBe(BuiltInFade);
    expect(CustomComponent).toBeDefined();
    expect(registry.getCode('custom:test')).toContain('custom-test');
  });

  it('returns a compile error overlay instead of throwing for invalid custom code', async () => {
    await preloadSucrase();
    const registry = new DynamicEffectRegistry({});
    expect(() => registry.register('broken', 'export default function Effect( {')).not.toThrow();
    expect(registry.get('broken')).toBeDefined();
  });
});
