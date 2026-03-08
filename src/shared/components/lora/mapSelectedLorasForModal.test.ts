import { describe, expect, it } from 'vitest';
import { mapSelectedLorasForModal } from './mapSelectedLorasForModal';

describe('mapSelectedLorasForModal', () => {
  it('maps selected loras into selector modal shape', () => {
    const result = mapSelectedLorasForModal(
      [{ id: 'foo', name: 'Foo LoRA', strength: 0.75 }],
      [{ 'Model ID': 'foo', Name: 'Original Foo' } as never],
    );

    expect(result).toHaveLength(1);
    expect(result[0]['Model ID']).toBe('foo');
    expect(result[0].Name).toBe('Foo LoRA');
    expect(result[0].strength).toBe(0.75);
  });
});
