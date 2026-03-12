import { describe, expect, it } from 'vitest';
import {
  applyTaskLogCostFilter,
  enrichTaskLogTasks,
  type TaskLogTaskRecord,
} from '../taskLogPipeline';

describe('taskLogPipeline', () => {
  const tasks: TaskLogTaskRecord[] = [
    {
      id: 'task-free',
      task_type: 'generate-image',
      status: 'Complete',
      created_at: '2026-03-10T10:00:00.000Z',
      generation_started_at: '2026-03-10T10:00:00.000Z',
      generation_processed_at: '2026-03-10T10:00:03.000Z',
      project_id: 'project-1',
    },
    {
      id: 'task-paid',
      task_type: 'generate-video',
      status: 'Failed',
      created_at: '2026-03-10T11:00:00.000Z',
      generation_started_at: '2026-03-10T11:00:00.000Z',
      generation_processed_at: '2026-03-10T11:00:09.000Z',
      project_id: 'project-2',
    },
  ];

  it('enriches tasks with project names, costs, and durations', () => {
    const enriched = enrichTaskLogTasks(
      tasks,
      [{ task_id: 'task-paid', amount: -0.125, created_at: '2026-03-10T11:01:00.000Z' }],
      {
        'project-1': 'Project One',
        'project-2': 'Project Two',
      },
    );

    expect(enriched).toEqual([
      expect.objectContaining({
        id: 'task-free',
        projectName: 'Project One',
        cost: undefined,
        duration: 3,
      }),
      expect.objectContaining({
        id: 'task-paid',
        projectName: 'Project Two',
        cost: 0.125,
        duration: 9,
      }),
    ]);
  });

  it('applies free and paid cost filters consistently', () => {
    const enriched = enrichTaskLogTasks(
      tasks,
      [{ task_id: 'task-paid', amount: -0.125, created_at: '2026-03-10T11:01:00.000Z' }],
      {
        'project-1': 'Project One',
        'project-2': 'Project Two',
      },
    );

    expect(applyTaskLogCostFilter(enriched, 'free').map((task) => task.id)).toEqual(['task-free']);
    expect(applyTaskLogCostFilter(enriched, 'paid').map((task) => task.id)).toEqual(['task-paid']);
    expect(applyTaskLogCostFilter(enriched, 'all').map((task) => task.id)).toEqual([
      'task-free',
      'task-paid',
    ]);
  });
});
