import {
  type OperationResult,
  operationFailure,
  operationSuccess,
} from "./edgeOperation.ts";
import { asObjectRecord, asString } from "./payloadNormalization.ts";

function fail(code: string, message: string, cause: unknown): OperationResult<never> {
  return operationFailure(new Error(message), {
    policy: "fail_closed",
    errorCode: code,
    message,
    recoverable: false,
    cause,
  });
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export interface DayBucket {
  date: string;
  images_generated: number;
  images_edited: number;
  videos_generated: number;
}

export interface UserCapacityStatsRow {
  user_id: string;
  credits: number;
  queued_tasks: number;
  in_progress_tasks: number;
  allows_cloud: boolean;
  at_limit: boolean;
}

export interface QueuedTasksBreakdownRow {
  claimable_now: number;
  blocked_by_capacity: number;
  blocked_by_deps: number;
  blocked_by_settings: number;
  total_queued: number;
}

export interface TaskAvailabilityAnalysis {
  eligible_count: number;
  user_info: Record<string, unknown>;
}

function parseDayBucket(value: unknown): OperationResult<DayBucket> {
  const row = asObjectRecord(value);
  if (!row) {
    return fail("rpc_day_bucket_invalid", "Day bucket row must be an object", { value });
  }

  const date = asString(row.date);
  const imagesGenerated = asFiniteNumber(row.images_generated);
  const imagesEdited = asFiniteNumber(row.images_edited);
  const videosGenerated = asFiniteNumber(row.videos_generated);

  if (!date || imagesGenerated === null || imagesEdited === null || videosGenerated === null) {
    return fail("rpc_day_bucket_invalid", "Day bucket row is missing required fields", {
      row,
      has_date: !!date,
      images_generated: imagesGenerated,
      images_edited: imagesEdited,
      videos_generated: videosGenerated,
    });
  }

  return operationSuccess({
    date,
    images_generated: imagesGenerated,
    images_edited: imagesEdited,
    videos_generated: videosGenerated,
  });
}

export function parseDayBuckets(value: unknown): OperationResult<DayBucket[]> {
  if (!Array.isArray(value)) {
    return fail("rpc_day_buckets_invalid", "RPC day buckets payload must be an array", { value });
  }

  const buckets: DayBucket[] = [];
  for (const row of value) {
    const parsed = parseDayBucket(row);
    if (!parsed.ok) {
      return parsed;
    }
    buckets.push(parsed.value);
  }

  return operationSuccess(buckets);
}

function parseUserCapacityStatsRow(value: unknown): OperationResult<UserCapacityStatsRow> {
  const row = asObjectRecord(value);
  if (!row) {
    return fail("rpc_user_capacity_row_invalid", "User capacity row must be an object", { value });
  }

  const userId = asString(row.user_id);
  const credits = asFiniteNumber(row.credits);
  const queuedTasks = asFiniteNumber(row.queued_tasks);
  const inProgressTasks = asFiniteNumber(row.in_progress_tasks);
  const allowsCloud = asBoolean(row.allows_cloud);
  const atLimit = asBoolean(row.at_limit);

  if (
    !userId
    || credits === null
    || queuedTasks === null
    || inProgressTasks === null
    || allowsCloud === null
    || atLimit === null
  ) {
    return fail("rpc_user_capacity_row_invalid", "User capacity row is missing required fields", {
      row,
      has_user_id: !!userId,
      credits,
      queued_tasks: queuedTasks,
      in_progress_tasks: inProgressTasks,
      allows_cloud: allowsCloud,
      at_limit: atLimit,
    });
  }

  return operationSuccess({
    user_id: userId,
    credits,
    queued_tasks: queuedTasks,
    in_progress_tasks: inProgressTasks,
    allows_cloud: allowsCloud,
    at_limit: atLimit,
  });
}

export function parseUserCapacityStatsRows(value: unknown): OperationResult<UserCapacityStatsRow[]> {
  if (!Array.isArray(value)) {
    return fail("rpc_user_capacity_rows_invalid", "User capacity stats payload must be an array", { value });
  }

  const rows: UserCapacityStatsRow[] = [];
  for (const row of value) {
    const parsed = parseUserCapacityStatsRow(row);
    if (!parsed.ok) {
      return parsed;
    }
    rows.push(parsed.value);
  }

  return operationSuccess(rows);
}

export function parseQueuedTasksBreakdownRow(value: unknown): OperationResult<QueuedTasksBreakdownRow> {
  const row = asObjectRecord(value);
  if (!row) {
    return fail("rpc_task_breakdown_invalid", "Task breakdown row must be an object", { value });
  }

  const claimableNow = asFiniteNumber(row.claimable_now);
  const blockedByCapacity = asFiniteNumber(row.blocked_by_capacity);
  const blockedByDeps = asFiniteNumber(row.blocked_by_deps);
  const blockedBySettings = asFiniteNumber(row.blocked_by_settings);
  const totalQueued = asFiniteNumber(row.total_queued);

  if (
    claimableNow === null
    || blockedByCapacity === null
    || blockedByDeps === null
    || blockedBySettings === null
    || totalQueued === null
  ) {
    return fail("rpc_task_breakdown_invalid", "Task breakdown row is missing required fields", {
      row,
      claimable_now: claimableNow,
      blocked_by_capacity: blockedByCapacity,
      blocked_by_deps: blockedByDeps,
      blocked_by_settings: blockedBySettings,
      total_queued: totalQueued,
    });
  }

  return operationSuccess({
    claimable_now: claimableNow,
    blocked_by_capacity: blockedByCapacity,
    blocked_by_deps: blockedByDeps,
    blocked_by_settings: blockedBySettings,
    total_queued: totalQueued,
  });
}

export function parseTaskAvailabilityAnalysis(value: unknown): OperationResult<TaskAvailabilityAnalysis> {
  const row = asObjectRecord(value);
  if (!row) {
    return fail("rpc_task_availability_invalid", "Task availability payload must be an object", { value });
  }

  const eligibleCount = asFiniteNumber(row.eligible_count);
  const userInfo = asObjectRecord(row.user_info);
  if (eligibleCount === null || !userInfo) {
    return fail("rpc_task_availability_invalid", "Task availability payload is missing required fields", {
      row,
      eligible_count: eligibleCount,
      has_user_info: !!userInfo,
    });
  }

  return operationSuccess({
    eligible_count: eligibleCount,
    user_info: userInfo,
  });
}
