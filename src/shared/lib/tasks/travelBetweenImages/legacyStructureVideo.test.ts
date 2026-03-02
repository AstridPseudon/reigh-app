import { describe, expect, it, vi } from 'vitest';

const signalPastRemovalTargetUsageMock = vi.fn();

vi.mock('@/shared/lib/governance/deprecationEnforcement', () => ({
  signalPastRemovalTargetUsage: (...args: unknown[]) => signalPastRemovalTargetUsageMock(...args),
}));

import {
  collectTravelStructureLegacyUsage,
  enforceTravelStructureLegacyPolicy,
  migrateLegacyStructureVideos,
} from './legacyStructureVideo';

describe('legacyStructureVideo policy', () => {
  it('detects top-level and structure-video legacy field usage', () => {
    const usage = collectTravelStructureLegacyUsage({
      structure_video_path: 'https://example.com/guide.mp4',
      structure_videos: [
        {
          path: 'https://example.com/guide.mp4',
          start_frame: 0,
          end_frame: 81,
          motion_strength: 1.2,
          structure_type: 'flow',
        },
      ],
    });

    expect(usage.topLevelFields).toContain('structure_video_path');
    expect(usage.structureVideoFields).toContain('motion_strength');
    expect(usage.structureVideoFields).toContain('structure_type');
  });

  it('only signals enforcement when legacy fields are present', () => {
    signalPastRemovalTargetUsageMock.mockReset();
    const noLegacy = collectTravelStructureLegacyUsage({
      structure_videos: [{ path: 'a', start_frame: 0, end_frame: 10 }],
    });

    expect(enforceTravelStructureLegacyPolicy(noLegacy)).toBe(false);
    expect(signalPastRemovalTargetUsageMock).not.toHaveBeenCalled();

    const withLegacy = collectTravelStructureLegacyUsage({
      structure_video_type: 'flow',
    });

    enforceTravelStructureLegacyPolicy(withLegacy, { context: 'test' });
    expect(signalPastRemovalTargetUsageMock).toHaveBeenCalledTimes(1);
  });

  it('preserves structure_type in existing structure_videos entries', () => {
    const migrated = migrateLegacyStructureVideos(
      {
        structure_videos: [
          {
            path: 'https://example.com/guide.mp4',
            start_frame: 0,
            end_frame: 81,
            structure_type: 'flow',
            motion_strength: 1.4,
          },
        ],
      },
      {
        defaultEndFrame: 81,
        defaultVideoTreatment: 'adjust',
        defaultMotionStrength: 1.2,
        defaultStructureType: 'uni3c',
        defaultUni3cEndPercent: 0.1,
      },
    );

    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.structure_type).toBe('flow');
    expect(migrated[0]?.motion_strength).toBe(1.4);
  });

  it('preserves legacy single-field structure_video_type when migrating', () => {
    const migrated = migrateLegacyStructureVideos(
      {
        structure_video_path: 'https://example.com/legacy.mp4',
        structure_video_type: 'depth',
      },
      {
        defaultEndFrame: 81,
        defaultVideoTreatment: 'adjust',
        defaultMotionStrength: 1.2,
        defaultStructureType: 'uni3c',
        defaultUni3cEndPercent: 0.1,
      },
    );

    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.path).toBe('https://example.com/legacy.mp4');
    expect(migrated[0]?.structure_type).toBe('depth');
  });
});
