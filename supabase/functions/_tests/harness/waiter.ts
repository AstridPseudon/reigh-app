import { getAdminSupabaseClient } from "./client.ts";
import type {
  CreditsLedgerSnapshotRow,
  GenerationSnapshotRow,
  HarnessSnapshot,
  TaskSnapshotRow,
} from "./snapshot.ts";

const POLL_INTERVAL_MS = 2_000;
const TASK_TERMINAL_STATUSES = new Set(["Complete", "Failed", "Cancelled"]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectLinkedTaskIds(row: { tasks: unknown; params: unknown }): string[] {
  const linked = new Set<string>();

  if (Array.isArray(row.tasks)) {
    for (const taskId of row.tasks) {
      if (typeof taskId === "string" && taskId.trim()) {
        linked.add(taskId.trim());
      }
    }
  }

  if (isRecord(row.params) && typeof row.params.source_task_id === "string" && row.params.source_task_id.trim()) {
    linked.add(row.params.source_task_id.trim());
  }

  return Array.from(linked).sort((left, right) => left.localeCompare(right));
}

async function fetchTasks(taskIds: string[]): Promise<TaskSnapshotRow[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_type, params, status, output_location, error_message, created_at, generation_created")
    .in("id", taskIds);

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }

  return (data ?? []) as TaskSnapshotRow[];
}

async function fetchGenerationsForTask(taskId: string): Promise<GenerationSnapshotRow[]> {
  const supabase = getAdminSupabaseClient();
  const [tasksLinkedResult, sourceLinkedResult] = await Promise.all([
    supabase
      .from("generations")
      .select("id, tasks, params, location, thumbnail_url, type, primary_variant_id")
      .contains("tasks", JSON.stringify([taskId])),
    supabase
      .from("generations")
      .select("id, tasks, params, location, thumbnail_url, type, primary_variant_id")
      .eq("params->>source_task_id", taskId),
  ]);

  if (tasksLinkedResult.error) {
    throw new Error(`Failed to load generations by tasks for ${taskId}: ${tasksLinkedResult.error.message}`);
  }
  if (sourceLinkedResult.error) {
    throw new Error(`Failed to load generations by source_task_id for ${taskId}: ${sourceLinkedResult.error.message}`);
  }

  const deduped = new Map<string, GenerationSnapshotRow>();
  for (const row of [...(tasksLinkedResult.data ?? []), ...(sourceLinkedResult.data ?? [])]) {
    if (!row?.id || typeof row.id !== "string") {
      continue;
    }
    deduped.set(row.id, {
      ...(row as Omit<GenerationSnapshotRow, "linked_task_ids">),
      linked_task_ids: collectLinkedTaskIds({
        tasks: row.tasks,
        params: row.params,
      }),
    });
  }

  return Array.from(deduped.values());
}

async function fetchCreditsLedger(taskIds: string[]): Promise<CreditsLedgerSnapshotRow[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("credits_ledger")
    .select("id, amount, type, task_id, metadata")
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to load credits_ledger rows: ${error.message}`);
  }

  return (data ?? []) as CreditsLedgerSnapshotRow[];
}

function formatTaskTimeout(rows: TaskSnapshotRow[], expectedTaskIds: string[]): string {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const pending = expectedTaskIds.map((taskId) => {
    const row = rowsById.get(taskId);
    return row
      ? `${taskId}=${row.status}${row.error_message ? ` (${row.error_message})` : ""}`
      : `${taskId}=missing`;
  });

  return `Timed out waiting for task completion. Pending/current states: ${pending.join(", ")}`;
}

function formatGenerationTimeout(taskIds: string[], generations: GenerationSnapshotRow[]): string {
  const matchedTaskIds = new Set(generations.flatMap((row) => row.linked_task_ids));
  const pending = taskIds.filter((taskId) => !matchedTaskIds.has(taskId));
  const known = generations.map((row) => `${row.id}[${row.linked_task_ids.join(",") || "unlinked"}]`);
  return `Timed out waiting for generations for task ids ${pending.join(", ")}. Seen generations: ${known.join(", ") || "none"}`;
}

function formatCreditsTimeout(taskIds: string[], ledgerRows: CreditsLedgerSnapshotRow[]): string {
  const foundTaskIds = new Set(ledgerRows.flatMap((row) => row.task_id ? [row.task_id] : []));
  const pending = taskIds.filter((taskId) => !foundTaskIds.has(taskId));
  const seen = ledgerRows.map((row) => `${row.id}[task=${row.task_id ?? "null"},type=${row.type},amount=${row.amount}]`);
  return `Timed out waiting for credits_ledger rows for task ids ${pending.join(", ")}. Seen entries: ${seen.join(", ") || "none"}`;
}

export async function waitForTaskCompletion(
  taskIds: string[],
  timeoutMs = 120_000,
): Promise<TaskSnapshotRow[]> {
  const uniqueTaskIds = Array.from(new Set(taskIds));
  if (uniqueTaskIds.length === 0) {
    return [];
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const rows = await fetchTasks(uniqueTaskIds);
    const terminal = rows.length === uniqueTaskIds.length
      && rows.every((row) => TASK_TERMINAL_STATUSES.has(row.status));
    if (terminal) {
      return rows;
    }

    await delay(POLL_INTERVAL_MS);
  }

  const rows = await fetchTasks(uniqueTaskIds);
  throw new Error(formatTaskTimeout(rows, uniqueTaskIds));
}

export async function waitForGenerations(
  taskIds: string[],
  timeoutMs = 120_000,
): Promise<GenerationSnapshotRow[]> {
  const uniqueTaskIds = Array.from(new Set(taskIds));
  if (uniqueTaskIds.length === 0) {
    return [];
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const generations = (await Promise.all(uniqueTaskIds.map((taskId) => fetchGenerationsForTask(taskId)))).flat();
    const matchedTaskIds = new Set(generations.flatMap((row) => row.linked_task_ids));
    if (uniqueTaskIds.every((taskId) => matchedTaskIds.has(taskId))) {
      return generations;
    }

    // If all tasks have reached a terminal failure state, no generations will
    // ever appear.  Return early instead of waiting for the full timeout.
    const tasks = await fetchTasks(uniqueTaskIds);
    const allTerminalFailure = tasks.length === uniqueTaskIds.length
      && tasks.every((row) => row.status === "Failed" || row.status === "Cancelled");
    if (allTerminalFailure) {
      return generations;
    }

    await delay(POLL_INTERVAL_MS);
  }

  const generations = (await Promise.all(uniqueTaskIds.map((taskId) => fetchGenerationsForTask(taskId)))).flat();
  throw new Error(formatGenerationTimeout(uniqueTaskIds, generations));
}

export async function waitForCreditsLedger(
  taskIds: string[],
  timeoutMs = 30_000,
): Promise<CreditsLedgerSnapshotRow[]> {
  const uniqueTaskIds = Array.from(new Set(taskIds));
  if (uniqueTaskIds.length === 0) {
    return [];
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const rows = await fetchCreditsLedger(uniqueTaskIds);
    const foundTaskIds = new Set(rows.flatMap((row) => row.task_id ? [row.task_id] : []));
    if (uniqueTaskIds.every((taskId) => foundTaskIds.has(taskId))) {
      return rows;
    }

    // If all tasks have failed/cancelled, no credits will ever be charged.
    const tasks = await fetchTasks(uniqueTaskIds);
    const allTerminalFailure = tasks.length === uniqueTaskIds.length
      && tasks.every((row) => row.status === "Failed" || row.status === "Cancelled");
    if (allTerminalFailure) {
      return rows;
    }

    await delay(POLL_INTERVAL_MS);
  }

  const rows = await fetchCreditsLedger(uniqueTaskIds);
  throw new Error(formatCreditsTimeout(uniqueTaskIds, rows));
}

export function extractNewTaskIds(
  beforeSnapshot: HarnessSnapshot,
  afterSnapshot: HarnessSnapshot,
): string[] {
  return Object.keys(afterSnapshot.tasks)
    .filter((taskId) => !(taskId in beforeSnapshot.tasks))
    .sort((left, right) => left.localeCompare(right));
}
