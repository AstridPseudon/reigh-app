/**
 * Task routes of the frozen doc-27 §4.1 set: admission, polling reads, and
 * cancellation. Thin declarations over the shared transport — no retry
 * policy, no caching, no state. Consumers own cadence (plan §7: 2 s active /
 * 10 s idle) and idempotency-key discipline.
 */

import type { AstridBridgeTransport } from './transport.ts';
import { observeAstridCapabilityFailure } from './capabilityCensus.ts';
import {
  bridgeCancelRequestSchema,
  bridgeCancelResponseSchema,
  bridgeTaskAdmissionRequestSchema,
  bridgeTaskAdmissionResponseSchema,
  bridgeTaskDetailPayloadSchema,
  bridgeTaskListSchema,
  type BridgeCancelRequest,
  type BridgeCancelResponse,
  type BridgeAdmittedTask,
  type BridgeTaskSummary,
  type BridgeTaskAdmissionRequest,
  type BridgeTaskAdmissionResponse,
  type BridgeTaskDetailPayload,
  type BridgeTaskList,
  type WorkspaceTask,
  workspaceTaskMutationSchema,
  workspaceTaskPageSchema,
  workspaceTaskSchema,
} from '@/tools/video-editor/data/bridgeContract.ts';
import { isAstridWorkspaceV1 } from './workspaceV1.ts';

export type TaskRoutesOptions = {
  /** The project slug every task route is scoped under (`/projects/:slug/…`). */
  projectSlug: string;
};

function workspaceStateToBridgeStatus(state: WorkspaceTask['state']): BridgeTaskSummary['status'] {
  switch (state) {
    case 'running': return 'running';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    case 'cancelled':
    case 'cancel_requested': return 'cancelled';
    case 'queued':
    case 'ready':
    case 'retrying': return 'queued';
  }
}

function publicWorkspaceSpec(task: WorkspaceTask): Record<string, unknown> {
  const raw = task.spec as Record<string, unknown>;
  const nested = raw.spec && typeof raw.spec === 'object' && !Array.isArray(raw.spec)
    ? raw.spec as Record<string, unknown>
    : raw;
  return {
    family: typeof nested.family === 'string' ? nested.family : task.capability_id,
    source_task_type: typeof nested.family === 'string' ? nested.family : task.capability_id,
    params: nested.params && typeof nested.params === 'object' && !Array.isArray(nested.params)
      ? nested.params
      : {},
    output_policy: nested.output_policy && typeof nested.output_policy === 'object' && !Array.isArray(nested.output_policy)
      ? nested.output_policy
      : {},
  };
}

function workspaceTaskToSummary(task: WorkspaceTask, projectSlug: string): BridgeTaskSummary {
  const spec = publicWorkspaceSpec(task);
  return {
    task_id: task.task_id,
    project_id: projectSlug,
    capability: task.capability_id,
    status: workspaceStateToBridgeStatus(task.state),
    spec,
    priority: 0,
    max_attempts: 1,
    created_at: task.created_at,
    updated_at: task.updated_at,
    ...(task.state === 'succeeded' || task.state === 'failed' || task.state === 'cancelled'
      ? { finished_at: task.updated_at }
      : {}),
    winning_attempt_id: null,
  };
}

function workspaceTaskToAdmitted(task: WorkspaceTask, projectSlug: string): BridgeAdmittedTask {
  const summary = workspaceTaskToSummary(task, projectSlug);
  return {
    id: task.task_id,
    project_id: projectSlug,
    capability: task.capability_id,
    spec: summary.spec ?? {},
    // The legacy DTO requires this field, while workspace.v1 exposes the
    // authoritative capability digest separately. Preserve that digest as
    // the stable adapter value; callers never use this compatibility field
    // for admission authority.
    spec_hash: task.capability_digest,
    input_manifest: task.input_object_ids.map((object_id) => ({ object_id })),
    status: summary.status,
    priority: 0,
    available_at: task.created_at,
    max_attempts: 1,
    run_id: task.run_id,
    run_ordinal: null,
    winning_attempt_id: task.attempt_id ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
    finished_at: summary.finished_at ?? null,
  };
}

type BridgeTaskOutputs = NonNullable<BridgeTaskDetailPayload['task']['outputs']>;

function workspaceOutputRows(task: WorkspaceTask): BridgeTaskOutputs {
  const result = task.result;
  const outputs = result && Array.isArray(result.outputs) ? result.outputs : [];
  return outputs.flatMap((output, ordinal): BridgeTaskOutputs => {
    if (!output || typeof output !== 'object' || Array.isArray(output)) return [];
    const row = output as Record<string, unknown>;
    const mediaId = typeof row.digest === 'string' ? row.digest : typeof row.object_id === 'string' ? row.object_id : '';
    if (!mediaId) return [];
    const role = typeof row.name === 'string' ? row.name : typeof row.output_port === 'string' ? row.output_port : 'output';
    return [{
      ordinal: typeof row.ordinal === 'number' ? row.ordinal : ordinal,
      role,
      media_id: mediaId,
      ...(row.primary === true || row.is_primary === true ? { is_primary: true } : {}),
      ...(row.params && typeof row.params === 'object' && !Array.isArray(row.params)
        ? { params_json: JSON.stringify(row.params) }
        : {}),
    }];
  });
}

export class AstridLocalTaskRoutes {
  private readonly transport: AstridBridgeTransport;
  private readonly projectSlug: string;

  constructor(transport: AstridBridgeTransport, options: TaskRoutesOptions) {
    this.transport = transport;
    this.projectSlug = options.projectSlug;
  }

  private path(suffix?: string): string {
    const base = `/projects/${encodeURIComponent(this.projectSlug)}/tasks`;
    return suffix ? `${base}/${suffix}` : base;
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      observeAstridCapabilityFailure('tasks', error);
      throw error;
    }
  }

  /**
   * R1 admission. `idempotencyKey` is REQUIRED by the bridge
   * (`Idempotency-Key` header); replaying the same key with the same body is
   * the server's dedup primitive, so callers derive keys deterministically.
   */
  async admit(
    request: BridgeTaskAdmissionRequest,
    idempotencyKey: string,
  ): Promise<BridgeTaskAdmissionResponse> {
    // Validate on the client too: an invalid admit must fail here, before a
    // receipted key is spent on a request the bridge would reject.
    const parsed = bridgeTaskAdmissionRequestSchema.parse(request);
    // Rebuild the closed envelope in contract order so the bytes used by
    // Runtime's idempotency receipt are independent of caller key order.
    const canonicalRequest: BridgeTaskAdmissionRequest = {
      project: parsed.project,
      capability_id: parsed.capability_id,
      capability_digest: parsed.capability_digest,
      schema_version: parsed.schema_version,
      input_object_ids: [...parsed.input_object_ids],
      spec: {
        family: parsed.spec.family,
        params: parsed.spec.params,
        output_policy: parsed.spec.output_policy,
      },
      storage_estimate: {
        estimated_scratch_bytes: parsed.storage_estimate.estimated_scratch_bytes,
        estimated_output_bytes: parsed.storage_estimate.estimated_output_bytes,
      },
      settlement_effect: parsed.settlement_effect,
    };
    if (isAstridWorkspaceV1) {
      const workspaceRequest = {
        ...canonicalRequest,
        storage_estimate: {
          scratch_bytes: canonicalRequest.storage_estimate.estimated_scratch_bytes,
          output_bytes: canonicalRequest.storage_estimate.estimated_output_bytes,
        },
      };
      const committed = await this.request(() => this.transport.requestJson(
        '/v1/tasks',
        { method: 'POST', body: workspaceRequest, headers: { 'Idempotency-Key': idempotencyKey } },
        workspaceTaskMutationSchema,
        'workspace.v1 task admission',
      ));
      return { task: workspaceTaskToAdmitted(committed.data, this.projectSlug) };
    }
    return await this.request(() => this.transport.requestJson(
      this.path(),
      { method: 'POST', body: canonicalRequest, headers: { 'Idempotency-Key': idempotencyKey } },
      bridgeTaskAdmissionResponseSchema,
      'task admission',
    ));
  }

  /** Bounded task page for polling reads (`limit`, `offset`). */
  async list(options: { limit?: number; offset?: number } = {}): Promise<BridgeTaskList> {
    if (isAstridWorkspaceV1) {
      const offset = options.offset ?? 0;
      const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
      const rows: BridgeTaskSummary[] = [];
      let cursor: string | undefined;
      const seenCursors = new Set<string>();
      let exhausted = false;
      while (rows.length < offset + limit && !exhausted) {
        if (cursor !== undefined) {
          if (seenCursors.has(cursor)) throw new Error('workspace.v1 task cursor cycle detected');
          seenCursors.add(cursor);
        }
        const query = new URLSearchParams({ limit: '200' });
        if (cursor !== undefined) query.set('cursor', cursor);
        const page = await this.request(() => this.transport.requestJson(
          `/v1/projects/${encodeURIComponent(this.projectSlug)}/tasks?${query.toString()}`,
          {},
          workspaceTaskPageSchema,
          'workspace.v1 task list',
        ));
        rows.push(...page.items.map((task) => workspaceTaskToSummary(task, this.projectSlug)));
        exhausted = page.next_cursor === null;
        if (!exhausted) cursor = page.next_cursor ?? undefined;
      }
      const items = rows.slice(offset, offset + limit);
      return {
        tasks: items,
        next_offset: exhausted ? null : offset + items.length,
      };
    }
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return await this.request(() => this.transport.requestJson(
      this.path() + query,
      {},
      bridgeTaskListSchema,
      'task list',
    ));
  }

  /** One task's full read model incl. attempts and committed outputs. */
  async get(taskId: string): Promise<BridgeTaskDetailPayload['task']> {
    if (isAstridWorkspaceV1) {
      const task = await this.request(() => this.transport.requestJson(
        `/v1/tasks/${encodeURIComponent(taskId)}`,
        {},
        workspaceTaskSchema,
        'workspace.v1 task detail',
      ));
      return {
        ...workspaceTaskToSummary(task, this.projectSlug),
        ...(workspaceOutputRows(task).length > 0 ? { outputs: workspaceOutputRows(task) } : {}),
      };
    }
    const payload = await this.request(() => this.transport.requestJson(
      this.path(encodeURIComponent(taskId)),
      {},
      bridgeTaskDetailPayloadSchema,
      'task detail',
    ));
    return payload.task;
  }

  /**
   * Common queued/running cancellation. A running cancel requires the live
   * attempt fence; cancelling an already-terminal task replays its current
   * state without error.
   */
  async cancel(taskId: string, fence: BridgeCancelRequest = {}): Promise<BridgeCancelResponse> {
    bridgeCancelRequestSchema.parse(fence);
    if (isAstridWorkspaceV1) {
      const committed = await this.request(() => this.transport.requestJson(
        `/v1/tasks/${encodeURIComponent(taskId)}/cancel`,
        {
          method: 'POST',
          body: fence.status_version === undefined ? {} : { expected_version: fence.status_version },
          headers: { 'Idempotency-Key': `reigh-cancel-${crypto.randomUUID()}` },
        },
        workspaceTaskMutationSchema,
        'workspace.v1 task cancellation',
      ));
      return { task: workspaceTaskToSummary(committed.data, this.projectSlug) };
    }
    return await this.request(() => this.transport.requestJson(
      `${this.path(encodeURIComponent(taskId))}/cancel`,
      { method: 'POST', body: fence },
      bridgeCancelResponseSchema,
      'task cancel',
    ));
  }
}
