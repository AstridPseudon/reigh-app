import { describe, it, expect } from 'vitest';
import {
  buildWorkerLaunchLine,
  getInstallationCommand,
  getRunCommand,
} from './commandUtils';
import type { CommandConfig } from './types';

const baseConfig: CommandConfig = {
  computerType: 'linux',
  gpuType: 'nvidia-30-40',
  memoryProfile: '4',
  windowsShell: 'cmd',
  showDebugLogs: false,
  idleReleaseMinutes: '15',
  token: 'test-token',
};

describe('buildWorkerLaunchLine', () => {
  it('includes --debug when showDebugLogs is true', () => {
    const line = buildWorkerLaunchLine({ ...baseConfig, showDebugLogs: true });
    expect(line).toContain('--debug');
    expect(line).toContain('python run_worker.py');
  });

  it('excludes --debug when showDebugLogs is false', () => {
    const line = buildWorkerLaunchLine({ ...baseConfig, showDebugLogs: false });
    expect(line).not.toContain('--debug');
  });

  it('always appends --idle-release-minutes including for "0"', () => {
    expect(buildWorkerLaunchLine({ ...baseConfig, idleReleaseMinutes: '0' })).toContain('--idle-release-minutes 0');
    expect(buildWorkerLaunchLine({ ...baseConfig, idleReleaseMinutes: '15' })).toContain('--idle-release-minutes 15');
    expect(buildWorkerLaunchLine({ ...baseConfig, idleReleaseMinutes: '30' })).toContain('--idle-release-minutes 30');
  });
});

describe('getInstallationCommand', () => {
  it('picks cu128 for nvidia-50', () => {
    const cmd = getInstallationCommand({ ...baseConfig, gpuType: 'nvidia-50' });
    expect(cmd).toContain('cu128');
    expect(cmd).not.toContain('cu124');
  });

  it('picks cu124 for nvidia-30-40', () => {
    const cmd = getInstallationCommand({ ...baseConfig, gpuType: 'nvidia-30-40' });
    expect(cmd).toContain('cu124');
    expect(cmd).not.toContain('cu128');
  });
});

describe('getRunCommand', () => {
  it('uses run_worker.py (not worker.py) on Linux', () => {
    const cmd = getRunCommand({ ...baseConfig, computerType: 'linux' });
    expect(cmd).toContain('python run_worker.py');
    expect(cmd).not.toMatch(/python worker\.py\b/);
  });

  it('uses run_worker.py (not worker.py) on Windows', () => {
    const cmd = getRunCommand({ ...baseConfig, computerType: 'windows', windowsShell: 'powershell' });
    expect(cmd).toContain('python run_worker.py');
    expect(cmd).not.toMatch(/python worker\.py\b/);
  });

  it('uses powershell-style cd-check on Windows powershell', () => {
    const cmd = getRunCommand({ ...baseConfig, computerType: 'windows', windowsShell: 'powershell' });
    expect(cmd).toContain('if (!(Test-Path run_worker.py)) { cd Reigh-Worker }');
  });

  it('uses cmd-style cd-check on Windows cmd', () => {
    const cmd = getRunCommand({ ...baseConfig, computerType: 'windows', windowsShell: 'cmd' });
    expect(cmd).toContain('if not exist run_worker.py cd Reigh-Worker');
  });
});
