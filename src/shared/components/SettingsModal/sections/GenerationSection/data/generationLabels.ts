export const COMPUTER_LABELS: Record<string, string> = {
  linux: 'Linux',
  windows: 'Windows',
  mac: 'Mac',
};

export const GPU_LABELS: Record<string, string> = {
  'nvidia-30-40': 'NVIDIA ≤40 series',
  'nvidia-50': 'NVIDIA 50 series',
  'non-nvidia': 'Non-NVIDIA',
};

export const MEMORY_LABELS: Record<string, string> = {
  '1': 'Max Performance',
  '2': 'High RAM',
  '3': 'Balanced',
  '4': 'Conservative',
  '5': 'Minimum',
};

export const SHELL_LABELS: Record<string, string> = {
  cmd: 'Command Prompt',
  powershell: 'PowerShell',
};
