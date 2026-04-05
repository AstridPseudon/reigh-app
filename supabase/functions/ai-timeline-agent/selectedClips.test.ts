import { describe, expect, it, vi } from 'vitest';
import { enrichClipsWithPrompts, normalizeSelectedClips } from './selectedClips.ts';

function createSupabaseAdmin(rows: unknown, error: { message: string } | null = null) {
  const inMock = vi.fn().mockResolvedValue({ data: rows, error });
  const selectMock = vi.fn(() => ({ in: inMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    supabaseAdmin: {
      from: fromMock,
    } as unknown as import('./types.ts').SupabaseAdmin,
    fromMock,
    selectMock,
    inMock,
  };
}

describe('normalizeSelectedClips', () => {
  it('keeps clip ids for timeline attachments and includes generation_id when present', () => {
    expect(normalizeSelectedClips([{
      clip_id: 'clip-1',
      generation_id: 'gen-1',
      url: 'https://example.com/image.png',
      media_type: 'image',
    }])).toEqual([{
      clip_id: 'clip-1',
      generation_id: 'gen-1',
      url: 'https://example.com/image.png',
      media_type: 'image',
    }]);
  });

  it('accepts gallery attachments with generation_id and synthesizes clip ids', () => {
    expect(normalizeSelectedClips([{
      clip_id: '',
      generation_id: 'gen-2',
      url: 'https://example.com/video.mp4',
      media_type: 'video',
    }])).toEqual([{
      clip_id: 'gallery-gen-2',
      generation_id: 'gen-2',
      url: 'https://example.com/video.mp4',
      media_type: 'video',
    }]);
  });

  it('rejects attachments without a usable clip or generation id', () => {
    expect(normalizeSelectedClips([{
      clip_id: '',
      url: 'https://example.com/image.png',
      media_type: 'image',
    }])).toEqual([]);
  });

  it('keeps prompt metadata when present on the incoming payload', () => {
    expect(normalizeSelectedClips([{
      clip_id: 'clip-3',
      generation_id: 'gen-3',
      url: 'https://example.com/image.png',
      media_type: 'image',
      prompt: '  moody portrait lighting  ',
    }])).toEqual([{
      clip_id: 'clip-3',
      generation_id: 'gen-3',
      url: 'https://example.com/image.png',
      media_type: 'image',
      prompt: 'moody portrait lighting',
    }]);
  });
});

describe('enrichClipsWithPrompts', () => {
  it('adds prompt metadata for clips with generation_id using one batched generations query', async () => {
    const { supabaseAdmin, fromMock, selectMock, inMock } = createSupabaseAdmin([
      {
        id: 'gen-1',
        params: {
          originalParams: {
            orchestrator_details: {
              prompt: 'style prompt',
            },
          },
        },
      },
      {
        id: 'gen-2',
        params: {
          prompt: 'fallback prompt',
        },
      },
    ]);

    await expect(enrichClipsWithPrompts(supabaseAdmin, [
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'video' },
      { clip_id: 'clip-3', generation_id: 'gen-1', url: 'https://example.com/3.png', media_type: 'image' },
    ])).resolves.toEqual([
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image', prompt: 'style prompt' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'video', prompt: 'fallback prompt' },
      { clip_id: 'clip-3', generation_id: 'gen-1', url: 'https://example.com/3.png', media_type: 'image', prompt: 'style prompt' },
    ]);

    expect(fromMock).toHaveBeenCalledWith('generations');
    expect(selectMock).toHaveBeenCalledWith('id, params');
    expect(inMock).toHaveBeenCalledTimes(1);
    expect(inMock).toHaveBeenCalledWith('id', ['gen-1', 'gen-2']);
  });

  it('passes clips through unchanged when none have generation_id', async () => {
    const clips = [{ clip_id: 'clip-1', url: 'https://example.com/1.png', media_type: 'image' as const }];
    const { supabaseAdmin, fromMock } = createSupabaseAdmin([]);

    await expect(enrichClipsWithPrompts(supabaseAdmin, clips)).resolves.toEqual(clips);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('leaves prompt undefined when params are missing or null', async () => {
    const { supabaseAdmin } = createSupabaseAdmin([
      { id: 'gen-1', params: null },
      { id: 'gen-2' },
    ]);

    await expect(enrichClipsWithPrompts(supabaseAdmin, [
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'video' },
    ])).resolves.toEqual([
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'video' },
    ]);
  });

  it('returns early for an empty clip list without hitting the database', async () => {
    const { supabaseAdmin, fromMock } = createSupabaseAdmin([]);

    await expect(enrichClipsWithPrompts(supabaseAdmin, [])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('uses orchestrator prompt before params.prompt and metadata.prompt', async () => {
    const { supabaseAdmin } = createSupabaseAdmin([
      {
        id: 'gen-1',
        params: {
          prompt: 'params prompt',
          metadata: { prompt: 'metadata prompt' },
          originalParams: {
            orchestrator_details: {
              prompt: 'orchestrator prompt',
            },
          },
        },
      },
      {
        id: 'gen-2',
        params: {
          metadata: { prompt: 'metadata only prompt' },
        },
      },
    ]);

    await expect(enrichClipsWithPrompts(supabaseAdmin, [
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'image' },
    ])).resolves.toEqual([
      { clip_id: 'clip-1', generation_id: 'gen-1', url: 'https://example.com/1.png', media_type: 'image', prompt: 'orchestrator prompt' },
      { clip_id: 'clip-2', generation_id: 'gen-2', url: 'https://example.com/2.png', media_type: 'image', prompt: 'metadata only prompt' },
    ]);
  });
});
