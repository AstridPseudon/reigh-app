/**
 * Status states for the auto-save settings lifecycle.
 */
export type AutoSaveStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

/**
 * Custom load/save functions for non-React-Query persistence.
 */
export interface CustomLoadSave<T> {
  load: (entityId: string) => Promise<T | null>;
  save: (entityId: string, data: T) => Promise<void>;
  entityId: string | null;
  onFlush?: (entityId: string, data: T) => void;
}

export interface UseAutoSaveSettingsOptions<T> {
  toolId?: string;
  shotId?: string | null;
  projectId?: string | null;
  scope?: 'shot' | 'project';
  debounceMs?: number;
  defaults: T;
  enabled?: boolean;
  debug?: boolean;
  debugTag?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  customLoadSave?: CustomLoadSave<T>;
}

export interface UseAutoSaveSettingsReturn<T> {
  settings: T;
  status: AutoSaveStatus;
  entityId: string | null;
  isDirty: boolean;
  error: Error | null;
  hasShotSettings: boolean;
  hasPersistedData: boolean;
  updateField: <K extends keyof T>(key: K, value: T[K]) => void;
  updateFields: (updates: Partial<T>) => void;
  save: () => Promise<void>;
  saveImmediate: (dataToSave?: T) => Promise<void>;
  revert: () => void;
  reset: (newDefaults?: T) => void;
  initializeFrom: (data: Partial<T>) => void;
}
