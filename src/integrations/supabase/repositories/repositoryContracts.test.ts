import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const queryBuilder = {
  eq: vi.fn(() => queryBuilder),
  maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
};
const mockSelect = vi.fn(() => queryBuilder);
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockIsTaskDbRow = vi.fn();
const mockMapTaskDbRowToTask = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock('@/shared/lib/taskRowMapper', () => ({
  isTaskDbRow: (...args: unknown[]) => mockIsTaskDbRow(...args),
  mapTaskDbRowToTask: (...args: unknown[]) => mockMapTaskDbRowToTask(...args),
}));

import { fetchGenerationById } from './generationRepository';
import { fetchPresetResourceById } from './presetResourcesRepository';
import { RepositoryError } from './repositoryErrors';
import { fetchTaskInProject } from './taskRepository';

describe('repository contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(queryBuilder);
    mockFrom.mockReturnValue({ select: mockSelect });
    queryBuilder.eq.mockImplementation(() => queryBuilder);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('returns null for missing generations', async () => {
    await expect(fetchGenerationById('generation-1')).resolves.toBeNull();
  });

  it('throws RepositoryError for generation query failures', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'generation query failed' },
    });

    await expect(fetchGenerationById('generation-1')).rejects.toMatchObject<Partial<RepositoryError>>({
      name: 'RepositoryError',
      code: 'query_failed',
    });
  });

  it('returns null for missing tasks instead of throwing raw Postgrest errors', async () => {
    await expect(fetchTaskInProject('task-1', 'project-1')).resolves.toBeNull();
  });

  it('throws RepositoryError for invalid task row shapes', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'task-1', project_id: 'project-1' },
      error: null,
    });
    mockIsTaskDbRow.mockReturnValue(false);

    await expect(fetchTaskInProject('task-1', 'project-1')).rejects.toMatchObject<Partial<RepositoryError>>({
      name: 'RepositoryError',
      code: 'invalid_row_shape',
    });
  });

  it('returns null for missing preset resources', async () => {
    await expect(fetchPresetResourceById('preset-1')).resolves.toBeNull();
  });

  it('throws RepositoryError for preset query failures', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'preset query failed' },
    });

    await expect(fetchPresetResourceById('preset-1')).rejects.toMatchObject<Partial<RepositoryError>>({
      name: 'RepositoryError',
      code: 'query_failed',
    });
  });

  it('throws RepositoryError for invalid preset rows', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { metadata: { name: 'broken' } },
      error: null,
    });

    await expect(fetchPresetResourceById('preset-1')).rejects.toMatchObject<Partial<RepositoryError>>({
      name: 'RepositoryError',
      code: 'invalid_row_shape',
    });
  });
});
