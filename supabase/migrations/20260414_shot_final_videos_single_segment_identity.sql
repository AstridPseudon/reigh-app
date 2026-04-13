-- For shots with <=2 positioned timeline images, the segment video IS the
-- final video.  The view resolves location/thumbnail from the single child
-- generation while keeping the parent ID as the canonical handle.
--
-- "Positioned timeline image" mirrors the client-side selectTimelineImages
-- filter: timeline_frame >= 0, not a video type, has a non-empty location
-- that isn't the placeholder.

BEGIN;

-- Helper: count positioned (timeline) images for a shot.
-- Mirrors isTimelineImageGeneration() in shotImageSelectors.ts.
CREATE OR REPLACE VIEW shot_statistics
WITH (security_invoker = true)
AS
SELECT
  s.id as shot_id,
  s.project_id,
  COUNT(sg.id) as total_generations,
  COUNT(sg.id) FILTER (WHERE sg.timeline_frame IS NOT NULL) as positioned_count,
  COUNT(sg.id) FILTER (WHERE sg.timeline_frame IS NULL AND (g.type IS NULL OR g.type NOT LIKE '%video%')) as unpositioned_count,
  COUNT(sg.id) FILTER (WHERE g.params->>'tool_type' = 'travel-between-images' AND g.type LIKE '%video%') as video_count,
  COUNT(sg.id) FILTER (
    WHERE g.type = 'video'
    AND g.parent_generation_id IS NULL
    AND (
      -- Parent has its own location (legacy or multi-segment joined)
      (
        g.location IS NOT NULL
        AND g.location != ''
      )
      -- OR single-child parent in a <=2-image shot where child has the video
      OR (
        timeline_img.positioned_image_count <= 2
        AND child_agg.child_count = 1
        AND child_agg.child_location IS NOT NULL
        AND child_agg.child_location != ''
      )
    )
    AND (
      g.params->'orchestrator_details' IS NOT NULL
      OR child_agg.child_count > 0
    )
  ) as final_video_count
FROM shots s
LEFT JOIN shot_generations sg ON sg.shot_id = s.id
LEFT JOIN generations g ON g.id = sg.generation_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer as child_count,
    MAX(c.location) as child_location
  FROM generations c
  WHERE c.parent_generation_id = g.id
) child_agg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer as positioned_image_count
  FROM shot_generations sg2
  JOIN generations g2 ON g2.id = sg2.generation_id
  WHERE sg2.shot_id = s.id
    AND sg2.timeline_frame >= 0
    AND (g2.type IS NULL OR g2.type NOT LIKE '%video%')
    AND g2.location IS NOT NULL
    AND g2.location != ''
    AND g2.location != '/placeholder.svg'
) timeline_img ON true
GROUP BY s.id, s.project_id;

GRANT SELECT ON shot_statistics TO authenticated;

COMMENT ON VIEW shot_statistics IS
'Shot-level statistics including video counts.
- positioned_count: generations with a timeline position
- final_video_count: parent videos shown in FinalVideoSection, including
  single-child parents in <=2-image shots whose playable URL lives on the child';

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
  sg.shot_id
FROM generations g
JOIN shot_generations sg ON sg.generation_id = g.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer as child_count,
    MAX(c.location) as child_location,
    MAX(c.thumbnail_url) as child_thumbnail_url
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
when the shot has <=2 positioned timeline images (matching the client-side
selectTimelineImages filter). When the user adds a 3rd image, the view
automatically falls back to the parent''s own location.';

COMMIT;
