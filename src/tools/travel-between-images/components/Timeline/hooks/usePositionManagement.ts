import { useEffect } from 'react';
import type { ShotGeneration } from '@/shared/hooks/useTimelineCore';
import { useTimelinePositions } from './useTimelinePositions';

interface PositionManagementProps {
  shotId: string;
  shotGenerations: ShotGeneration[];
  frameSpacing: number;
  isLoading: boolean;
  isPersistingPositions: boolean;
  isDragInProgress: boolean;
  updateTimelineFrame?: (shotGenerationId: string, frame: number, metadata?: Record<string, unknown>) => Promise<void>;
  onFramePositionsChange?: (framePositions: Map<string, number>) => void;
  setIsPersistingPositions: (persisting: boolean) => void;
}

// Feature flag - set to true to use the new simplified position system
const USE_NEW_POSITION_SYSTEM = true;

interface PositionChangeAnalysis {
  totalAnalyzed: number;
  significantChanges: Array<[string, unknown]>;
  filteredOut: Array<[string, unknown]>;
  allChanges: Array<[string, unknown]>;
  syncSummary: {
    db_vs_display_synced: number;
    db_vs_display_out_of_sync: number;
    total_out_of_sync: number;
  };
}

export function usePositionManagement({
  shotId,
  shotGenerations,
  frameSpacing,
  isLoading,
  isPersistingPositions,
  isDragInProgress,
  updateTimelineFrame,
  onFramePositionsChange,
  setIsPersistingPositions
}: PositionManagementProps) {
  
  // =========================================================================
  // NEW POSITION SYSTEM (when feature flag enabled)
  // =========================================================================
  
  const newPositionSystem = useTimelinePositions({
    shotId,
    shotGenerations,
    frameSpacing,
    onPositionsChange: onFramePositionsChange,
  });
  
  // Lock/unlock positions during drag operations
  useEffect(() => {
    if (USE_NEW_POSITION_SYSTEM) {
      if (isDragInProgress) {
        newPositionSystem.lockPositions();
      } else {
        newPositionSystem.unlockPositions();
      }
    }
  }, [isDragInProgress, newPositionSystem]);
  
  // If using new system, return its interface wrapped for compatibility
  if (USE_NEW_POSITION_SYSTEM) {
    // Wrapper for setFramePositions that handles the persisting state
    const wrappedSetFramePositions = async (newPositions: Map<string, number>) => {
      setIsPersistingPositions(true);
      try {
        await newPositionSystem.updatePositions(newPositions, { operation: 'drag' });
      } finally {
        // Small delay before clearing to allow UI to settle
        setTimeout(() => setIsPersistingPositions(false), 100);
      }
    };
    
    // Simple analyze function for backwards compatibility
    const analyzePositionChanges = (
      newPositions: Map<string, number>,
      framePositions: Map<string, number>,
      displayPositions: Map<string, number>,
      stablePositions: Map<string, number>
    ) => {
      const changes: Array<[string, unknown]> = [];
      for (const [id, newPos] of newPositions) {
        const oldPos = framePositions.get(id);
        if (oldPos !== newPos) {
          changes.push([id, { oldPos, newPos, delta: newPos - (oldPos ?? 0) }]);
        }
      }
      return {
        totalAnalyzed: newPositions.size,
        significantChanges: changes,
        filteredOut: [],
        allChanges: changes,
        syncSummary: { db_vs_display_synced: 0, db_vs_display_out_of_sync: 0, total_out_of_sync: 0 }
      };
    };
    
    return {
      framePositions: newPositionSystem.positions,
      displayPositions: newPositionSystem.positions,
      stablePositions: newPositionSystem.positions,
      setStablePositions: () => {}, // No-op, new system handles this
      setFramePositions: wrappedSetFramePositions,
      analyzePositionChanges,
    };
  }
  
// Remove unused legacy code and return the simplified interface
  // This effectively replaces the entire legacy implementation
  return {
    framePositions: newPositionSystem.positions,
    displayPositions: newPositionSystem.positions,
    stablePositions: newPositionSystem.positions,
    setStablePositions: () => {}, // No-op, new system handles this
    setFramePositions: wrappedSetFramePositions,
    analyzePositionChanges: () => ({
      totalAnalyzed: 0,
      significantChanges: [],
      filteredOut: [],
      allChanges: [],
      syncSummary: { db_vs_display_synced: 0, db_vs_display_out_of_sync: 0, total_out_of_sync: 0 }
    }),
  };
}

export type { PositionChangeAnalysis };
