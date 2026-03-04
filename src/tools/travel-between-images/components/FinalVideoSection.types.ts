import type { GenerationRow } from '@/domains/generation/types';

export interface FinalVideoSectionProps {
  shotId: string;
  projectId: string;
  projectAspectRatio?: string;
  onApplySettingsFromTask?: (taskId: string, replaceImages: boolean, inputImages: string[]) => void;
  onJoinSegmentsClick?: () => void;
  selectedParentId?: string | null;
  onSelectedParentChange?: (id: string | null) => void;
  parentGenerations?: GenerationRow[];
  segmentProgress?: { completed: number; total: number };
  isParentLoading?: boolean;
  getFinalVideoCount?: (shotId: string | null) => number | null;
  onDelete?: (generationId: string) => void;
  isDeleting?: boolean;
  readOnly?: boolean;
  preloadedParent?: GenerationRow | null;
}

export interface FinalVideoVariantBadgeData {
  derivedCount: number;
  unviewedVariantCount: number;
  hasUnviewedVariants: boolean;
}

export interface FinalVideoSectionProgress {
  completed: number;
  total: number;
}
