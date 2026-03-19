import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionControl } from './MotionControl';

vi.mock('@/shared/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/components/ui/primitives/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/shared/components/PhaseConfigSelectorModal', () => ({
  PhaseConfigVertical: () => <div data-testid="phase-config-vertical">advanced-config</div>,
  PhaseConfigSelectorModal: () => <div data-testid="phase-config-selector-modal">preset-modal</div>,
}));

vi.mock('./MotionControlBasicTab', () => ({
  MotionControlBasicTab: ({ selectedModel }: { selectedModel: string }) => (
    <div data-testid="motion-control-basic-tab">{selectedModel}</div>
  ),
}));

vi.mock('./hooks/useMotionControlPresetState', () => ({
  useMotionControlPresetState: () => ({
    isPresetModalOpen: true,
    openPresetModal: vi.fn(),
    closePresetModal: vi.fn(),
    allPresets: [],
    builtinDefaultId: '__builtin_default_vace__',
    isCustomConfig: false,
    isSelectedPresetKnown: true,
    handleSwitchToAdvanced: vi.fn(),
    handleCustomClick: vi.fn(),
    handlePresetSelect: vi.fn(),
  }),
}));

function buildProps(
  selectedModel: 'wan-2.2' | 'ltx-2.3' | 'ltx-2.3-fast',
): React.ComponentProps<typeof MotionControl> {
  return {
    mode: {
      motionMode: 'basic',
      onMotionModeChange: vi.fn(),
      selectedModel,
      generationTypeMode: 'vace',
      onGenerationTypeModeChange: vi.fn(),
      hasStructureVideo: false,
      guidanceKind: undefined,
    },
    lora: {
      selectedLoras: [],
      availableLoras: [],
      onAddLoraClick: vi.fn(),
      onRemoveLora: vi.fn(),
      onLoraStrengthChange: vi.fn(),
      onAddTriggerWord: vi.fn(),
      renderLoraHeaderActions: vi.fn(),
    },
    presets: {
      selectedPhasePresetId: null,
      onPhasePresetSelect: vi.fn(),
      onPhasePresetRemove: vi.fn(),
      currentSettings: {
        prompt: '',
        negative_prompt: '',
        model: '',
        num_frames: 61,
        amount_of_motion: 50,
      },
    },
    advanced: {
      phaseConfig: undefined,
      onPhaseConfigChange: vi.fn(),
      onBlurSave: vi.fn(),
      randomSeed: false,
      onRandomSeedChange: vi.fn(),
      onRestoreDefaults: vi.fn(),
    },
    stateOverrides: {
      turboMode: false,
      settingsLoading: false,
      smoothContinuations: false,
      onSmoothContinuationsChange: vi.fn(),
    },
  };
}

describe('MotionControl', () => {
  it('hides tabs and preset modal for LTX models', () => {
    render(<MotionControl {...buildProps('ltx-2.3')} />);

    expect(screen.getByTestId('motion-control-basic-tab')).toHaveTextContent('ltx-2.3');
    expect(screen.queryByText('Mode:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('phase-config-selector-modal')).not.toBeInTheDocument();
  });

  it('renders tabs and preset modal for WAN models', () => {
    render(<MotionControl {...buildProps('wan-2.2')} />);

    expect(screen.getByText('Mode:')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('phase-config-selector-modal')).toBeInTheDocument();
  });
});
