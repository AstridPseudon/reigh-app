-- Corrective follow-up for the pair_shot_generation_id backfill.
--
-- Null out only rows where we can prove the stored pair FK is wrong by comparing
-- it to the segment's recorded start image generation. This intentionally
-- converts wrong-slotted rows into unslotted rows, which is safer than keeping a
-- stale position mapping alive.

WITH parent_shots AS (
  SELECT DISTINCT ON (sg.generation_id)
    sg.generation_id AS parent_generation_id,
    sg.shot_id AS parent_shot_id
  FROM shot_generations sg
  WHERE sg.generation_id IN (
    SELECT DISTINCT g.parent_generation_id
    FROM generations g
    WHERE g.type = 'video'
      AND g.is_child = true
      AND g.child_order IS NOT NULL
      AND g.pair_shot_generation_id IS NOT NULL
  )
  ORDER BY sg.generation_id, sg.timeline_frame DESC NULLS LAST
),
child_segments AS (
  SELECT
    g.id AS generation_id,
    g.parent_generation_id,
    g.child_order,
    g.pair_shot_generation_id,
    COALESCE(
      NULLIF(g.params->>'start_image_generation_id', ''),
      NULLIF(g.params->'individual_segment_params'->>'start_image_generation_id', ''),
      NULLIF(g.params->'orchestrator_details'->'input_image_generation_ids'->>(g.child_order::int), '')
    ) AS expected_start_generation_id_raw
  FROM generations g
  WHERE g.type = 'video'
    AND g.is_child = true
    AND g.child_order IS NOT NULL
    AND g.pair_shot_generation_id IS NOT NULL
),
normalized AS (
  SELECT
    cs.*,
    CASE
      WHEN cs.expected_start_generation_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN cs.expected_start_generation_id_raw::uuid
      ELSE NULL
    END AS expected_start_generation_id
  FROM child_segments cs
),
confirmed_mismatches AS (
  SELECT
    n.generation_id
  FROM normalized n
  LEFT JOIN parent_shots ps
    ON ps.parent_generation_id = n.parent_generation_id
  LEFT JOIN shot_generations actual_sg
    ON actual_sg.id = n.pair_shot_generation_id
  WHERE n.expected_start_generation_id IS NOT NULL
    AND (
      actual_sg.generation_id IS NULL
      OR actual_sg.shot_id IS DISTINCT FROM ps.parent_shot_id
      OR actual_sg.generation_id <> n.expected_start_generation_id
    )
)
UPDATE generations g
SET pair_shot_generation_id = NULL
FROM confirmed_mismatches mm
WHERE g.id = mm.generation_id;
