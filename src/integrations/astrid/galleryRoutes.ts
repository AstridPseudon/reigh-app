/**
 * Gallery routes of the frozen doc-27 §4.1 set: bounded generation pages and
 * generation detail with variants. Read-only — star/delete/set-primary ride
 * pack commands in later batches, never a second write surface here.
 */

import type { AstridBridgeTransport } from './transport.ts';
import { observeAstridCapabilityFailure } from './capabilityCensus.ts';
import {
  BridgeContractError,
  bridgeGenerationDetailPayloadSchema,
  bridgeGenerationListSchema,
  bridgeGenerationViewedResponseSchema,
  type BridgeGenerationDetailPayload,
  type BridgeGenerationList,
  type BridgeGenerationVariant,
  type BridgeGenerationViewedResponse,
  type WorkspaceGeneration,
  type WorkspaceGenerationVariant,
  workspaceGenerationPageSchema,
  workspaceGenerationSchema,
  workspaceGenerationVariantPageSchema,
} from '@/tools/video-editor/data/bridgeContract.ts';
import { isAstridWorkspaceV1 } from './workspaceV1.ts';

export type GalleryRoutesOptions = {
  /** The project slug every gallery route is scoped under. */
  projectSlug: string;
};

function metadataParams(generation: WorkspaceGeneration): Record<string, unknown> | undefined {
  const params = generation.metadata.params;
  return params && typeof params === 'object' && !Array.isArray(params)
    ? params as Record<string, unknown>
    : undefined;
}

function variantToBridge(variant: WorkspaceGenerationVariant): BridgeGenerationVariant {
  const primary = variant.metadata.is_primary === true;
  return {
    id: variant.variant_id,
    generation_id: variant.generation_id,
    media_id: variant.object_id ?? '',
    variant_type: variant.variant_type,
    name: typeof variant.metadata.name === 'string' ? variant.metadata.name : null,
    params: variant.metadata.params && typeof variant.metadata.params === 'object' && !Array.isArray(variant.metadata.params)
      ? variant.metadata.params as Record<string, unknown>
      : {},
    is_primary: primary,
    starred: false,
    viewed_at: null,
    created_at: variant.created_at,
  };
}

export class AstridLocalGalleryRoutes {
  private readonly transport: AstridBridgeTransport;
  private readonly projectSlug: string;

  constructor(transport: AstridBridgeTransport, options: GalleryRoutesOptions) {
    this.transport = transport;
    this.projectSlug = options.projectSlug;
  }

  private base(): string {
    return `/projects/${encodeURIComponent(this.projectSlug)}/generations`;
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      observeAstridCapabilityFailure('generations', error);
      throw error;
    }
  }

  /**
   * One bounded gallery page (`limit`, opaque `cursor`, optional `starred`
   * filter). Ordered `created_at DESC, id ASC` by the bridge.
   */
  async list(options: { limit?: number; cursor?: string; starred?: boolean } = {}): Promise<BridgeGenerationList> {
    if (isAstridWorkspaceV1) {
      const query = new URLSearchParams();
      query.set('limit', String(options.limit ?? 50));
      if (options.cursor !== undefined) query.set('cursor', options.cursor);
      const page = await this.request(() => this.transport.requestJson(
        `/v1/projects/${encodeURIComponent(this.projectSlug)}/generations?${query.toString()}`,
        {},
        workspaceGenerationPageSchema,
        'workspace.v1 generation list',
      ));
      const generations = await Promise.all(page.items.map(async (generation) => {
        const variants = await this.listWorkspaceVariants(generation.generation_id);
        const primary = variants.find((variant) => variant.metadata.is_primary === true) ?? variants[0];
        return {
          generation_id: generation.generation_id,
          name: null,
          type: generation.type,
          starred: false,
          created_at: generation.created_at,
          updated_at: generation.updated_at,
          ...(metadataParams(generation) ? { params: metadataParams(generation) } : {}),
          primary: primary && primary.object_id
            ? { media_id: primary.object_id, variant_type: primary.variant_type }
            : null,
          variant_count: variants.length,
        };
      }));
      return {
        generations: options.starred === true ? generations.filter((generation) => generation.starred) : generations,
        next_cursor: page.next_cursor,
      };
    }
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.cursor !== undefined) params.set('cursor', options.cursor);
    if (options.starred !== undefined) params.set('starred', String(options.starred));
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return await this.request(() => this.transport.requestJson(
      this.base() + query,
      {},
      bridgeGenerationListSchema,
      'generation list',
    ));
  }

  /** Generation detail including its full variant rows. */
  async get(generationId: string): Promise<BridgeGenerationDetailPayload['generation']> {
    if (isAstridWorkspaceV1) {
      const generation = await this.request(() => this.transport.requestJson(
        `/v1/generations/${encodeURIComponent(generationId)}`,
        {},
        workspaceGenerationSchema,
        'workspace.v1 generation detail',
      ));
      const variants = await this.listWorkspaceVariants(generationId);
      return {
        generation_id: generation.generation_id,
        project_id: this.projectSlug,
        task_id: generation.source_task_id ?? null,
        type: generation.type,
        name: null,
        params: metadataParams(generation) ?? {},
        starred: false,
        deleted_at: null,
        created_at: generation.created_at,
        updated_at: generation.updated_at,
        variants: variants.map(variantToBridge),
      };
    }
    const payload = await this.request(() => this.transport.requestJson(
      `${this.base()}/${encodeURIComponent(generationId)}`,
      {},
      bridgeGenerationDetailPayloadSchema,
      'generation detail',
    ));
    return payload.generation;
  }

  /** Mark one variant, or all variants when `variantId` is omitted, viewed. */
  async markViewed(
    generationId: string,
    variantId?: string,
  ): Promise<BridgeGenerationViewedResponse> {
    if (isAstridWorkspaceV1) {
      throw new BridgeContractError(
        'generation viewed mutation',
        'workspace.v1 does not expose a viewed-generation mutation',
      );
    }
    return await this.request(() => this.transport.requestJson(
      `${this.base()}/${encodeURIComponent(generationId)}/viewed`,
      {
        method: 'POST',
        body: variantId === undefined ? {} : { variant_id: variantId },
      },
      bridgeGenerationViewedResponseSchema,
      'mark generation variant viewed',
    ));
  }

  private async listWorkspaceVariants(generationId: string): Promise<WorkspaceGenerationVariant[]> {
    const variants: WorkspaceGenerationVariant[] = [];
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    while (true) {
      if (cursor !== undefined) {
        if (seenCursors.has(cursor)) throw new Error('workspace.v1 generation cursor cycle detected');
        seenCursors.add(cursor);
      }
      const query = new URLSearchParams({ limit: '200' });
      if (cursor !== undefined) query.set('cursor', cursor);
      const page = await this.request(() => this.transport.requestJson(
        `/v1/generations/${encodeURIComponent(generationId)}/variants?${query.toString()}`,
        {},
        workspaceGenerationVariantPageSchema,
        'workspace.v1 generation variants',
      ));
      variants.push(...page.items);
      if (page.next_cursor === null) return variants;
      cursor = page.next_cursor ?? undefined;
    }
  }
}
