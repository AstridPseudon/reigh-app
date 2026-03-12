import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import { getHiddenTaskTypes, getVisibleTaskTypes } from '@/shared/lib/tasks/taskConfig';

interface TaskLogCostEntry {
  task_id: string | null;
  amount: number;
  created_at: string;
}

async function fetchTaskLogCosts(taskIds: string[]): Promise<TaskLogCostEntry[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const { data: costs } = await supabase()
    .from('credits_ledger')
    .select('task_id, amount, created_at')
    .in('task_id', taskIds)
    .eq('type', 'spend');

  return costs || [];
}

export interface TaskLogFilters {
  costFilter?: 'all' | 'free' | 'paid';
  status?: string[];
  taskTypes?: string[];
  projectIds?: string[];
}

export interface TaskLogProject {
  id: string;
  name: string;
}

export interface TaskLogAvailableFilters {
  taskTypes: string[];
  projects: TaskLogProject[];
  statuses: string[];
}

export interface TaskLogTaskRecord {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
  generation_started_at?: string | null;
  generation_processed_at?: string | null;
  project_id: string;
}

export interface EnrichedTaskLogTask {
  id: string;
  taskType: string;
  status: string;
  createdAt: string;
  generationStartedAt?: string | null;
  generationProcessedAt?: string | null;
  projectId: string;
  cost?: number;
  duration?: number;
  projectName?: string;
}

export interface TaskLogDataResult {
  availableFilters: TaskLogAvailableFilters;
  projects: TaskLogProject[];
  tasks: EnrichedTaskLogTask[];
  total: number;
}

interface FetchTaskLogDataOptions {
  filters?: TaskLogFilters;
  limit?: number;
  offset?: number;
}

function getTaskDuration(task: TaskLogTaskRecord): number | undefined {
  if (!task.generation_started_at || !task.generation_processed_at) {
    return undefined;
  }

  const start = new Date(task.generation_started_at);
  const end = new Date(task.generation_processed_at);
  return Math.ceil((end.getTime() - start.getTime()) / 1000);
}

export function enrichTaskLogTasks(
  tasks: TaskLogTaskRecord[],
  costs: TaskLogCostEntry[],
  projectLookup: Record<string, string>,
): EnrichedTaskLogTask[] {
  return tasks.map((task) => {
    const costEntry = costs.find((entry) => entry.task_id === task.id);

    return {
      id: task.id,
      taskType: task.task_type,
      status: task.status,
      createdAt: task.created_at,
      generationStartedAt: task.generation_started_at,
      generationProcessedAt: task.generation_processed_at,
      projectId: task.project_id,
      projectName: projectLookup[task.project_id] || 'Unknown Project',
      cost: costEntry ? Math.abs(costEntry.amount) : undefined,
      duration: getTaskDuration(task),
    };
  });
}

export function applyTaskLogCostFilter(
  tasks: EnrichedTaskLogTask[],
  costFilter: TaskLogFilters['costFilter'],
): EnrichedTaskLogTask[] {
  if (costFilter === 'free') {
    return tasks.filter((task) => !task.cost || task.cost === 0);
  }

  if (costFilter === 'paid') {
    return tasks.filter((task) => Boolean(task.cost && task.cost > 0));
  }

  return tasks;
}

async function requireTaskLogProjects(userId: string): Promise<TaskLogProject[]> {
  const { data: projects } = await supabase().from('projects')
    .select('id, name')
    .eq('user_id', userId);

  return projects || [];
}

function applyTaskLogQueryFilters(
  query: {
    in: (column: string, values: string[]) => unknown;
    not: (column: string, operator: string, value: string) => unknown;
  } & Record<string, unknown>,
  filters: TaskLogFilters,
  hiddenTaskTypes: string[],
) {
  let nextQuery = query;

  if (hiddenTaskTypes.length > 0) {
    nextQuery = nextQuery.not('task_type', 'in', `(${hiddenTaskTypes.join(',')})`) as typeof query;
  }

  if (filters.status && filters.status.length > 0) {
    nextQuery = nextQuery.in('status', filters.status) as typeof query;
  }

  if (filters.taskTypes && filters.taskTypes.length > 0) {
    nextQuery = nextQuery.in('task_type', filters.taskTypes) as typeof query;
  }

  if (filters.projectIds && filters.projectIds.length > 0) {
    nextQuery = nextQuery.in('project_id', filters.projectIds) as typeof query;
  }

  return nextQuery;
}

async function fetchAvailableTaskLogFilters(
  projectIds: string[],
  projects: TaskLogProject[],
  hiddenTaskTypes: string[],
): Promise<TaskLogAvailableFilters> {
  let availableQuery = supabase().from('tasks')
    .select('task_type, status, project_id')
    .in('project_id', projectIds);

  if (hiddenTaskTypes.length > 0) {
    availableQuery = availableQuery.not('task_type', 'in', `(${hiddenTaskTypes.join(',')})`);
  }

  const { data: allTasks } = await availableQuery;

  return {
    taskTypes: getVisibleTaskTypes().sort((left, right) => left.localeCompare(right)),
    projects,
    statuses: [...new Set((allTasks || []).map((task) => task.status))].sort(
      (left, right) => left.localeCompare(right),
    ),
  };
}

export async function fetchTaskLogData({
  filters = {},
  limit,
  offset,
}: FetchTaskLogDataOptions = {}): Promise<TaskLogDataResult> {
  const client = supabase();
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required');
  }

  const projects = await requireTaskLogProjects(user.id);
  if (projects.length === 0) {
    return {
      availableFilters: {
        taskTypes: [],
        projects: [],
        statuses: [],
      },
      projects: [],
      tasks: [],
      total: 0,
    };
  }

  const projectIds = projects.map((project) => project.id);
  const projectLookup = Object.fromEntries(projects.map((project) => [project.id, project.name]));
  const hiddenTaskTypes = getHiddenTaskTypes();

  let query = client.from('tasks')
    .select('*', { count: 'exact' })
    .in('project_id', projectIds);

  query = applyTaskLogQueryFilters(query, filters, hiddenTaskTypes);

  let orderedQuery = query.order('created_at', { ascending: false });
  if (typeof limit === 'number' && typeof offset === 'number') {
    orderedQuery = orderedQuery.range(offset, offset + limit - 1);
  }

  const { data: taskRows, error: tasksError, count } = await orderedQuery;

  if (tasksError) {
    throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
  }

  const tasksData = (taskRows || []) as TaskLogTaskRecord[];
  const taskIds = tasksData.map((task) => task.id);
  const costsData = await fetchTaskLogCosts(taskIds);
  const enrichedTasks = applyTaskLogCostFilter(
    enrichTaskLogTasks(tasksData, costsData, projectLookup),
    filters.costFilter,
  );

  return {
    availableFilters: await fetchAvailableTaskLogFilters(projectIds, projects, hiddenTaskTypes),
    projects,
    tasks: enrichedTasks,
    total: count || 0,
  };
}
