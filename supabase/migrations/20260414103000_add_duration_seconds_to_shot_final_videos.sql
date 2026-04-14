-- Expose a best-effort computed duration for shot final videos so clients can
-- avoid deriving it from generation params for the common final-video paths.

BEGIN;

CREATE OR REPLACE VIEW shot_final_videos
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (g.id)
  g.id,
  CASE
    WHEN timeline_img.positioned_image_count <= 2
      AND child_agg.child_count = 1
      AND child_agg.child_location IS NOT NULL
      AND child_agg.child_location != ''
      THEN child_agg.child_location
    ELSE g.location
  END as location,
  CASE
    WHEN timeline_img.positioned_image_count <= 2
      AND child_agg.child_count = 1
      AND child_agg.child_location IS NOT NULL
      AND child_agg.child_location != ''
      THEN child_agg.child_thumbnail_url
    ELSE g.thumbnail_url
  END as thumbnail_url,
  g.type,
  g.created_at,
  g.updated_at,
  g.params,
  g.starred,
  g.project_id,
  sg.shot_id,
  CASE
    WHEN timeline_img.positioned_image_count <= 2
      AND child_agg.child_count = 1
      AND child_agg.child_location IS NOT NULL
      AND child_agg.child_location != ''
      THEN child_agg.child_id
    ELSE g.id
  END as variant_fetch_generation_id,
  CASE
    WHEN timeline_img.positioned_image_count <= 2
      AND child_agg.child_count = 1
      AND child_agg.child_location IS NOT NULL
      AND child_agg.child_location != ''
      THEN child_agg.child_duration_seconds
    ELSE COALESCE(
      (g.params->>'duration_seconds')::numeric,
      (g.params->'metadata'->>'duration_seconds')::numeric,
      (g.params->>'trimmed_duration')::numeric,
      (g.params->>'duration')::numeric,
      (g.params->>'video_duration')::numeric,
      (g.params->>'original_duration')::numeric,
      (g.params->'orchestrator_details'->'metadata'->>'duration_seconds')::numeric,
      (g.params->'full_orchestrator_payload'->'metadata'->>'duration_seconds')::numeric,
      CASE
        WHEN COALESCE(
          (g.params->'full_orchestrator_payload'->>'total_frames')::numeric,
          (g.params->>'total_frames')::numeric
        ) IS NOT NULL
          AND COALESCE(
            (g.params->'full_orchestrator_payload'->>'frame_rate')::numeric,
            (g.params->'full_orchestrator_payload'->>'fps')::numeric,
            (g.params->>'frame_rate')::numeric,
            (g.params->>'fps')::numeric
          ) IS NOT NULL
          THEN COALESCE(
            (g.params->'full_orchestrator_payload'->>'total_frames')::numeric,
            (g.params->>'total_frames')::numeric
          ) / NULLIF(COALESCE(
            (g.params->'full_orchestrator_payload'->>'frame_rate')::numeric,
            (g.params->'full_orchestrator_payload'->>'fps')::numeric,
            (g.params->>'frame_rate')::numeric,
            (g.params->>'fps')::numeric
          ), 0)
        ELSE NULL
      END
    )
  END as duration_seconds
FROM generations g
JOIN shot_generations sg ON sg.generation_id = g.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer as child_count,
    MAX(c.id::text)::uuid as child_id,
    MAX(c.location) as child_location,
    MAX(c.thumbnail_url) as child_thumbnail_url,
    MAX(COALESCE(
      (c.params->>'duration_seconds')::numeric,
      (c.params->'metadata'->>'duration_seconds')::numeric,
      (c.params->>'trimmed_duration')::numeric,
      (c.params->>'duration')::numeric,
      (c.params->>'video_duration')::numeric,
      (c.params->>'original_duration')::numeric,
      (c.params->'orchestrator_details'->'metadata'->>'duration_seconds')::numeric,
      (c.params->'full_orchestrator_payload'->'metadata'->>'duration_seconds')::numeric,
      CASE
        WHEN COALESCE(
          (c.params->'full_orchestrator_payload'->>'total_frames')::numeric,
          (c.params->>'total_frames')::numeric
        ) IS NOT NULL
          AND COALESCE(
            (c.params->'full_orchestrator_payload'->>'frame_rate')::numeric,
            (c.params->'full_orchestrator_payload'->>'fps')::numeric,
            (c.params->>'frame_rate')::numeric,
            (c.params->>'fps')::numeric
          ) IS NOT NULL
          THEN COALESCE(
            (c.params->'full_orchestrator_payload'->>'total_frames')::numeric,
            (c.params->>'total_frames')::numeric
          ) / NULLIF(COALESCE(
            (c.params->'full_orchestrator_payload'->>'frame_rate')::numeric,
            (c.params->'full_orchestrator_payload'->>'fps')::numeric,
            (c.params->>'frame_rate')::numeric,
            (c.params->>'fps')::numeric
          ), 0)
        ELSE NULL
      END
    )) as child_duration_seconds
  FROM generations c
  WHERE c.parent_generation_id = g.id
) child_agg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer as positioned_image_count
  FROM shot_generations sg2
  JOIN generations g2 ON g2.id = sg2.generation_id
  WHERE sg2.shot_id = sg.shot_id
    AND sg2.timeline_frame >= 0
    AND (g2.type IS NULL OR g2.type NOT LIKE '%video%')
    AND g2.location IS NOT NULL
    AND g2.location != ''
    AND g2.location != '/placeholder.svg'
) timeline_img ON true
WHERE g.type = 'video'
  AND g.parent_generation_id IS NULL
  AND (
    g.params->'orchestrator_details' IS NOT NULL
    OR child_agg.child_count > 0
  );

GRANT SELECT ON shot_final_videos TO authenticated;

COMMENT ON VIEW shot_final_videos IS
'Final/parent video generations for each shot. Preserves the parent generation
ID while resolving the playable URL and thumbnail from the single child segment
when the shot has <=2 positioned timeline images. variant_fetch_generation_id
points at the generation whose variants should be shown for the currently
playable media.';

COMMIT;
