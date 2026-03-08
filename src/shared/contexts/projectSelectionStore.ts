/**
 * Runtime project selection snapshot for non-React consumers.
 *
 * This replaces ad-hoc window globals with an explicit typed access layer.
 */
const PROJECT_SELECTION_STORAGE_KEY = 'lastSelectedProjectId';

interface ProjectSelectionSnapshot {
  selectedProjectId: string | null;
}

type ProjectSelectionListener = (snapshot: ProjectSelectionSnapshot) => void;

function readPersistedProjectSelection(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const persisted = window.localStorage.getItem(PROJECT_SELECTION_STORAGE_KEY);
    return persisted && persisted.trim().length > 0 ? persisted : null;
  } catch {
    return null;
  }
}

let snapshot: ProjectSelectionSnapshot | null = null;

function ensureSnapshot(): ProjectSelectionSnapshot {
  if (!snapshot) {
    snapshot = { selectedProjectId: readPersistedProjectSelection() };
  }
  return snapshot;
}

const listeners = new Set<ProjectSelectionListener>();

export function setProjectSelectionSnapshot(next: ProjectSelectionSnapshot): void {
  const normalized: ProjectSelectionSnapshot = {
    selectedProjectId: next.selectedProjectId ?? null,
  };
  const current = ensureSnapshot();
  if (current.selectedProjectId === normalized.selectedProjectId) {
    return;
  }
  snapshot = normalized;
  for (const listener of listeners) {
    listener(normalized);
  }
}

export function getProjectSelectionSnapshot(): ProjectSelectionSnapshot {
  return ensureSnapshot();
}

export function getProjectSelectionFallbackId(): string | null {
  return ensureSnapshot().selectedProjectId ?? readPersistedProjectSelection();
}
