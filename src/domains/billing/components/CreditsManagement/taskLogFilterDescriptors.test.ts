import { describe, expect, it } from 'vitest';
import {
  getTaskLogFilterCount,
  getTaskLogFilterSummary,
  getVisibleTaskLogFilterDescriptors,
} from './taskLogFilterDescriptors';
import type { TaskLogAvailableFilters, TaskLogFilters } from './types';

const availableFilters: TaskLogAvailableFilters = {
  statuses: ['Complete', 'Failed'],
  taskTypes: ['image_generation', 'video_generation'],
  projects: [
    { id: 'project-1', name: 'Project One' },
    { id: 'project-2', name: 'Project Two' },
  ],
};

describe('taskLogFilterDescriptors', () => {
  it('counts active filters from the shared descriptor model', () => {
    const filters: TaskLogFilters = {
      costFilter: 'paid',
      status: ['Complete'],
      taskTypes: [],
      projectIds: ['project-1'],
    };

    expect(getTaskLogFilterCount(filters)).toBe(3);
  });

  it('omits empty multi-select filter sections while keeping cost visible', () => {
    const visibleDescriptors = getVisibleTaskLogFilterDescriptors({
      statuses: [],
      taskTypes: ['image_generation'],
      projects: [],
    });

    expect(visibleDescriptors.map((descriptor) => descriptor.key)).toEqual([
      'costFilter',
      'taskTypes',
    ]);
  });

  it('builds the empty-state summary text from descriptor metadata', () => {
    expect(getTaskLogFilterSummary(availableFilters)).toBe(
      'cost, status, task type, and project',
    );
  });
});
