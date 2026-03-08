import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationTokenPanel } from './GenerationTokenPanel';

const mockGetInstallationCommand = vi.fn();
const mockGetRunCommand = vi.fn();
const mockGenerateAIInstructions = vi.fn();
const mockSafeCopy = vi.fn();
const mockCommandPreview = vi.fn();

const markInstallCopied = vi.fn();
const markRunCopied = vi.fn();
const markAICopied = vi.fn();

const revealInstallCommand = vi.fn();
const revealRunCommand = vi.fn();
const setShowFullInstallCommand = vi.fn();
const setShowFullRunCommand = vi.fn();
const setShowPrerequisites = vi.fn();

vi.mock('../../../commandUtils', () => ({
  getInstallationCommand: (...args: unknown[]) => mockGetInstallationCommand(...args),
  getRunCommand: (...args: unknown[]) => mockGetRunCommand(...args),
  generateAIInstructions: (...args: unknown[]) => mockGenerateAIInstructions(...args),
  safeCopy: (...args: unknown[]) => mockSafeCopy(...args),
}));

vi.mock('../hooks/useCopyFeedback', () => ({
  useCopyFeedback: () => ({
    copiedInstallCommand: false,
    copiedRunCommand: false,
    copiedAIInstructions: false,
    markInstallCopied,
    markRunCopied,
    markAICopied,
  }),
}));

vi.mock('../hooks/useCommandVisibility', () => ({
  useCommandVisibility: () => ({
    showFullInstallCommand: false,
    setShowFullInstallCommand,
    showFullRunCommand: false,
    setShowFullRunCommand,
    showPrerequisites: false,
    setShowPrerequisites,
    installCommandRef: { current: null },
    runCommandRef: { current: null },
    revealInstallCommand,
    revealRunCommand,
  }),
}));

vi.mock('./CommandPreview', () => ({
  CommandPreview: (props: Record<string, unknown>) => {
    mockCommandPreview(props);
    const command = props.command as string;
    return (
      <div>
        <span>{`preview:${command}`}</span>
        <button type="button" aria-label={`copy-${command}`} onClick={() => (props.onCopy as () => void)()}>
          copy
        </button>
        <button type="button" aria-label={`reveal-${command}`} onClick={() => (props.onReveal as () => void)()}>
          reveal
        </button>
        <button type="button" aria-label={`hide-${command}`} onClick={() => (props.onHide as () => void)()}>
          hide
        </button>
      </div>
    );
  },
}));

vi.mock('./GenerationHelpPopover', () => ({
  GenerationHelpPopover: ({ onCopyAIInstructions }: { onCopyAIInstructions: () => void }) => (
    <button type="button" aria-label="copy-ai-help" onClick={onCopyAIInstructions}>
      ai-help
    </button>
  ),
}));

vi.mock('@/shared/components/ui/primitives/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/shared/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ children }: { children: ReactNode | ((value: string | null) => ReactNode) }) => (
    <span>{typeof children === 'function' ? children(null) : children}</span>
  ),
}));

vi.mock('@/shared/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    isMobile: false,
    config: {
      computerType: 'linux',
      gpuType: 'nvidia-30-40',
      memoryProfile: '3',
      windowsShell: 'cmd',
      showDebugLogs: false,
    },
    state: {
      generatedToken: null,
      activeInstallTab: 'need-install',
    },
    actions: {
      getActiveToken: vi.fn(() => ({ token: 'active-token', created_at: '2026-01-01T00:00:00Z' })),
      setComputerType: vi.fn(),
      setGpuType: vi.fn(),
      setMemoryProfile: vi.fn(),
      setWindowsShell: vi.fn(),
      setShowDebugLogs: vi.fn(),
      setActiveInstallTab: vi.fn(),
      updateGenerationMethodsWithNotification: vi.fn(),
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockGetInstallationCommand.mockReset();
  mockGetRunCommand.mockReset();
  mockGenerateAIInstructions.mockReset();
  mockSafeCopy.mockReset();
  mockCommandPreview.mockReset();

  markInstallCopied.mockReset();
  markRunCopied.mockReset();
  markAICopied.mockReset();

  revealInstallCommand.mockReset();
  revealRunCommand.mockReset();
  setShowFullInstallCommand.mockReset();
  setShowFullRunCommand.mockReset();
  setShowPrerequisites.mockReset();

  mockGetInstallationCommand.mockReturnValue('install-cmd');
  mockGetRunCommand.mockReturnValue('run-cmd');
  mockGenerateAIInstructions.mockReturnValue('ai-help-text');
  mockSafeCopy.mockResolvedValue(true);
});

describe('GenerationTokenPanel', () => {
  it('builds install/run commands from active token and handles copy/reveal actions', async () => {
    const props = buildProps();

    render(<GenerationTokenPanel {...(props as never)} />);

    expect(mockGetInstallationCommand).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'active-token' }),
    );
    expect(mockGetRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'active-token' }),
    );

    const logsButton = screen.getByRole('button', { name: /Logs/i });
    fireEvent.click(logsButton);
    expect(props.actions.setShowDebugLogs).toHaveBeenCalledWith(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'copy-install-cmd' }));
      fireEvent.click(screen.getByRole('button', { name: 'copy-run-cmd' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'copy-ai-help' })[0]);
    });

    await waitFor(() => {
      expect(mockSafeCopy).toHaveBeenCalledWith('install-cmd');
      expect(mockSafeCopy).toHaveBeenCalledWith('run-cmd');
      expect(mockSafeCopy).toHaveBeenCalledWith('ai-help-text');
    });

    expect(markInstallCopied).toHaveBeenCalledTimes(1);
    expect(markRunCopied).toHaveBeenCalledTimes(1);
    expect(markAICopied).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'reveal-install-cmd' }));
    fireEvent.click(screen.getByRole('button', { name: 'hide-install-cmd' }));
    expect(revealInstallCommand).toHaveBeenCalledTimes(1);
    expect(setShowFullInstallCommand).toHaveBeenCalledWith(false);
  });

  it('shows mac unsupported message and switches generation method to cloud', () => {
    const props = buildProps({
      config: {
        computerType: 'mac',
        gpuType: 'nvidia-30-40',
        memoryProfile: '3',
        windowsShell: 'cmd',
        showDebugLogs: false,
      },
    });

    render(<GenerationTokenPanel {...(props as never)} />);

    expect(screen.getByText(/Mac isn't supported yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Process in the cloud/i }));

    expect(props.actions.updateGenerationMethodsWithNotification).toHaveBeenCalledWith({
      onComputer: false,
      inCloud: true,
    });
    expect(mockCommandPreview).not.toHaveBeenCalled();
  });

  it('shows windows powershell execution-policy note and prerequisites toggle', () => {
    const props = buildProps({
      config: {
        computerType: 'windows',
        gpuType: 'nvidia-30-40',
        memoryProfile: '2',
        windowsShell: 'powershell',
        showDebugLogs: true,
      },
    });

    render(<GenerationTokenPanel {...(props as never)} />);

    expect(screen.getByText(/Set-ExecutionPolicy -ExecutionPolicy RemoteSigned/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Prerequisites/i }));
    expect(setShowPrerequisites).toHaveBeenCalledWith(true);
  });
});
