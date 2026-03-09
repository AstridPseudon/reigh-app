import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAuthenticatedMediaUserId: vi.fn(),
}));

vi.mock('@/shared/lib/media/videoThumbnailGenerator', () => ({
  resolveAuthenticatedMediaUserId: (...args: unknown[]) => mocks.resolveAuthenticatedMediaUserId(...args),
}));

import { requireProjectAndUserId } from './uploadGuards';

describe('editMedia/uploadGuards requireProjectAndUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthenticatedMediaUserId.mockResolvedValue('user-1');
  });

  it('throws when project id is missing', async () => {
    await expect(requireProjectAndUserId(undefined)).rejects.toThrow('No project selected');
    expect(mocks.resolveAuthenticatedMediaUserId).not.toHaveBeenCalled();
  });

  it('returns project and user ids when project id is provided', async () => {
    await expect(requireProjectAndUserId('project-1')).resolves.toEqual({
      projectId: 'project-1',
      userId: 'user-1',
    });
    expect(mocks.resolveAuthenticatedMediaUserId).toHaveBeenCalledTimes(1);
  });
});
