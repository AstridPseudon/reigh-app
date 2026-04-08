import { describe, expect, it } from 'vitest';
import { shouldAcceptPolledData } from '@/tools/video-editor/lib/timeline-save-utils';
import { getTimelinePollRejectionReason, isTimelinePollIdle } from '@/tools/video-editor/hooks/usePollSync';

function getLegacyPollRejectionReason(input: {
  editSeq: number;
  savedSeq: number;
  pendingOps: number;
  polledConfigVersion: number;
  currentConfigVersion: number;
  polledStableSignature: string;
  lastSavedStableSignature: string;
}): string | null {
  if (input.savedSeq < input.editSeq) {
    return 'unsaved edits';
  }

  if (input.pendingOps > 0) {
    return 'pending ops';
  }

  if (input.polledConfigVersion < input.currentConfigVersion) {
    return 'stale version';
  }

  if (
    !shouldAcceptPolledData(
      input.editSeq,
      input.savedSeq,
      input.pendingOps,
      input.polledStableSignature,
      input.lastSavedStableSignature,
    )
  ) {
    return input.polledConfigVersion === input.currentConfigVersion ? 'own echo' : 'signature match';
  }

  return null;
}

describe('usePollSync helpers', () => {
  it('preserves legacy poll decisions except for the intentional save-in-flight rejection', () => {
    const editSeqValues = [2, 4];
    const savedSeqValues = [1, 2, 4, 6];
    const pendingOpsValues = [0, 1];
    const isSavingValues = [false, true];
    const configVersions = [
      { polledConfigVersion: 7, currentConfigVersion: 7 },
      { polledConfigVersion: 8, currentConfigVersion: 7 },
      { polledConfigVersion: 6, currentConfigVersion: 7 },
    ];
    const signatures = [
      { polledStableSignature: 'saved-sig', lastSavedStableSignature: 'saved-sig' },
      { polledStableSignature: 'remote-sig', lastSavedStableSignature: 'saved-sig' },
    ];

    for (const editSeq of editSeqValues) {
      for (const savedSeq of savedSeqValues) {
        for (const pendingOps of pendingOpsValues) {
          for (const isSaving of isSavingValues) {
            for (const versionState of configVersions) {
              for (const signatureState of signatures) {
                const nextReason = getTimelinePollRejectionReason({
                  editSeq,
                  savedSeq,
                  pendingOps,
                  isSaving,
                  ...versionState,
                  ...signatureState,
                });
                const legacyReason = getLegacyPollRejectionReason({
                  editSeq,
                  savedSeq,
                  pendingOps,
                  ...versionState,
                  ...signatureState,
                });
                const expectedReason = isSaving && savedSeq >= editSeq && pendingOps === 0
                  ? 'saving'
                  : legacyReason;

                expect(nextReason).toBe(expectedReason);
              }
            }
          }
        }
      }
    }
  });

  it('default-rejects polls while a save is in flight even if other idle conditions are true', () => {
    expect(isTimelinePollIdle({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: true,
    })).toBe(false);

    expect(getTimelinePollRejectionReason({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: true,
      polledConfigVersion: 8,
      currentConfigVersion: 7,
      polledStableSignature: 'remote-sig',
      lastSavedStableSignature: 'saved-sig',
    })).toBe('saving');
  });

  it('rejects polls while an interaction (drag/resize) is active', () => {
    // Even when the timeline would otherwise be idle and the poll signature is fresh,
    // an active interaction must defer the conflict reload.
    expect(isTimelinePollIdle({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: false,
      interactionActive: true,
    })).toBe(false);

    expect(getTimelinePollRejectionReason({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: false,
      interactionActive: true,
      polledConfigVersion: 8,
      currentConfigVersion: 7,
      polledStableSignature: 'remote-sig',
      lastSavedStableSignature: 'saved-sig',
    })).toBe('interaction active');
  });

  it('accepts polls when interaction is no longer active', () => {
    expect(isTimelinePollIdle({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: false,
      interactionActive: false,
    })).toBe(true);

    expect(getTimelinePollRejectionReason({
      editSeq: 4,
      savedSeq: 4,
      pendingOps: 0,
      isSaving: false,
      interactionActive: false,
      polledConfigVersion: 8,
      currentConfigVersion: 7,
      polledStableSignature: 'remote-sig',
      lastSavedStableSignature: 'saved-sig',
    })).toBeNull();
  });
});
