import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBrowsePresetsTabModel } from './useBrowsePresetsTabModel';

function buildResource(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'phase-config',
    created_at: '2026-01-01T00:00:00.000Z',
    metadata: {
      name: `Preset ${id}`,
      description: `Description ${id}`,
      tags: [],
      created_at: '2026-01-01T00:00:00.000Z',
      created_by: { is_you: true },
      is_public: true,
      phaseConfig: {
        num_phases: 2,
        steps_per_phase: [2, 2],
        flow_shift: 5,
        sample_solver: 'euler',
        model_switch_phase: 1,
        phases: [
          { phase: 1, guidance_scale: 1, loras: [] },
          { phase: 2, guidance_scale: 1, loras: [] },
        ],
      },
      ...overrides,
    },
  };
}

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    onSelectPreset: vi.fn(),
    onRemovePreset: vi.fn(),
    selectedPresetId: null,
    myPresetsResource: { data: [], isLoading: false },
    publicPresetsResource: { data: [], isLoading: false },
    createResource: { mutate: vi.fn(), isPending: false },
    deleteResource: { mutate: vi.fn(), isPending: false },
    onEdit: vi.fn(),
    showMyPresetsOnly: false,
    showSelectedPresetOnly: false,
    onProcessedPresetsLengthChange: vi.fn(),
    onPageChange: vi.fn(),
    intent: 'load',
    onOverwrite: vi.fn(),
    ...overrides,
  };
}

describe('useBrowsePresetsTabModel', () => {
  it('deduplicates my/public presets and marks my ownership', () => {
    const props = buildProps({
      myPresetsResource: {
        data: [buildResource('mine-1'), buildResource('shared')],
        isLoading: false,
      },
      publicPresetsResource: {
        data: [buildResource('shared'), buildResource('public-1')],
        isLoading: false,
      },
    });

    const { result } = renderHook(() => useBrowsePresetsTabModel({ props: props as never }));

    expect(result.current.isLoadingPresets).toBe(false);
    expect(result.current.myPresetIds).toEqual(['mine-1', 'shared']);
    expect(result.current.paginatedPresets).toHaveLength(3);

    const sharedPreset = result.current.paginatedPresets.find((preset) => preset.id === 'shared');
    expect(sharedPreset?._isMyPreset).toBe(true);
    expect(props.onProcessedPresetsLengthChange).toHaveBeenCalledWith(3);
  });

  it('filters by model/search and sorts by most used', () => {
    const props = buildProps({
      publicPresetsResource: {
        data: [
          buildResource('a', { name: 'Alpha', generationTypeMode: 'i2v', use_count: 1, tags: ['cat'] }),
          buildResource('b', { name: 'Beta', generationTypeMode: 'vace', use_count: 9, tags: ['dog'] }),
          buildResource('c', { name: 'Gamma', generationTypeMode: 'vace', use_count: 3, tags: ['cat'] }),
        ],
        isLoading: false,
      },
    });

    const { result } = renderHook(() => useBrowsePresetsTabModel({ props: props as never }));

    act(() => {
      result.current.setModelTypeFilter('vace');
      result.current.setSearchTerm('a');
      result.current.setSortOption('mostUsed');
    });

    expect(result.current.paginatedPresets.map((preset) => preset.id)).toEqual(['b', 'c']);
  });

  it('paginates presets and exposes page setter via onPageChange callback', () => {
    const publicData = Array.from({ length: 13 }, (_, index) =>
      buildResource(`preset-${index}`, {
        name: `Preset ${String(index).padStart(2, '0')}`,
        created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );

    const onPageChange = vi.fn();
    const props = buildProps({
      publicPresetsResource: { data: publicData, isLoading: false },
      onPageChange,
    });

    const { result } = renderHook(() => useBrowsePresetsTabModel({ props: props as never }));

    expect(result.current.paginatedPresets).toHaveLength(12);
    expect(onPageChange).toHaveBeenCalledWith(0, 2, expect.any(Function));

    const setPage = onPageChange.mock.calls[0][2] as (page: number) => void;
    act(() => {
      setPage(1);
    });

    expect(result.current.paginatedPresets).toHaveLength(1);
  });

  it('opens, confirms, and closes delete dialog state', () => {
    const deleteResource = { mutate: vi.fn() };
    const onRemovePreset = vi.fn();

    const props = buildProps({ deleteResource, onRemovePreset });
    const { result } = renderHook(() => useBrowsePresetsTabModel({ props: props as never }));

    const preset = buildResource('delete-me', { name: 'Delete Me' });

    act(() => {
      result.current.openDeleteDialog(preset as never, true);
    });

    expect(result.current.deleteDialogOpen).toBe(true);
    expect(result.current.presetToDelete).toEqual({
      id: 'delete-me',
      name: 'Delete Me',
      isSelected: true,
    });

    act(() => {
      result.current.handleDeleteConfirm();
    });

    expect(deleteResource.mutate).toHaveBeenCalledWith({ id: 'delete-me', type: 'phase-config' });
    expect(onRemovePreset).toHaveBeenCalledTimes(1);
    expect(result.current.deleteDialogOpen).toBe(false);
    expect(result.current.presetToDelete).toBeNull();

    act(() => {
      result.current.openDeleteDialog(preset as never, false);
      result.current.closeDeleteDialog();
    });

    expect(result.current.deleteDialogOpen).toBe(false);
    expect(result.current.presetToDelete).toBeNull();
  });
});
