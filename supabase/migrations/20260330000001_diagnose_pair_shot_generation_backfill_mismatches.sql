-- Diagnostic: detect legacy pair_shot_generation_id mis-backfills.
--
-- Strategy:
-- Compare the current pair_shot_generation_id's linked image generation
-- (shot_generations.generation_id) against the segment's recorded start image
-- generation. That catches both:
--   1. cross-shot mismatches (pair points at a different shot)
--   2. same-shot positional mismatches (pair points at the wrong image after a reorder)
--
-- The result set also flags rows that still look like Step B candidates from
-- _applied_20260225000000_backfill_pair_shot_generation_id.sql, meaning they had
-- no valid Step A JSON source and therefore relied on child_order positional inference.

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
    g.created_at,
    g.pair_shot_generation_id,
    COALESCE(
      NULLIF(g.params->>'start_image_generation_id', ''),
      NULLIF(g.params->'individual_segment_params'->>'start_image_generation_id', ''),
      NULLIF(g.params->'orchestrator_details'->'input_image_generation_ids'->>(g.child_order::int), '')
    ) AS expected_start_generation_id_raw,
    NULLIF(
      g.params->'orchestrator_details'->'pair_shot_generation_ids'->>(g.child_order::int),
      ''
    ) AS step_a_pair_shot_generation_id_raw
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
    END AS expected_start_generation_id,
    CASE
      WHEN cs.step_a_pair_shot_generation_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN cs.step_a_pair_shot_generation_id_raw::uuid
      ELSE NULL
    END AS step_a_pair_shot_generation_id
  FROM child_segments cs
),
paired AS (
  SELECT
    n.generation_id,
    n.parent_generation_id,
    ps.parent_shot_id,
    n.child_order,
    n.created_at,
    n.pair_shot_generation_id,
    n.expected_start_generation_id_raw,
    n.expected_start_generation_id,
    actual_sg.shot_id AS actual_pair_shot_id,
    actual_sg.generation_id AS actual_pair_generation_id,
    (n.step_a_pair_shot_generation_id IS NULL) AS looks_like_step_b_backfill
  FROM normalized n
  LEFT JOIN parent_shots ps
    ON ps.parent_generation_id = n.parent_generation_id
  LEFT JOIN shot_generations actual_sg
    ON actual_sg.id = n.pair_shot_generation_id
),
mismatches AS (
  SELECT
    p.*,
    CASE
      WHEN p.expected_start_generation_id IS NULL THEN 'missing_expected_start_generation_id'
      WHEN p.actual_pair_generation_id IS NULL THEN 'dangling_pair_shot_generation_id'
      WHEN p.actual_pair_shot_id IS DISTINCT FROM p.parent_shot_id THEN 'cross_shot_mismatch'
      WHEN p.actual_pair_generation_id <> p.expected_start_generation_id THEN 'same_shot_position_mismatch'
      ELSE NULL
    END AS mismatch_kind
  FROM paired p
)
SELECT
  generation_id,
  parent_generation_id,
  parent_shot_id,
  child_order,
  created_at,
  pair_shot_generation_id,
  actual_pair_shot_id,
  actual_pair_generation_id,
  expected_start_generation_id,
  expected_start_generation_id_raw,
  looks_like_step_b_backfill,
  mismatch_kind
FROM mismatches
WHERE mismatch_kind IS NOT NULL
ORDER BY looks_like_step_b_backfill DESC, mismatch_kind, created_at, generation_id;

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
    g.created_at,
    g.pair_shot_generation_id,
    COALESCE(
      NULLIF(g.params->>'start_image_generation_id', ''),
      NULLIF(g.params->'individual_segment_params'->>'start_image_generation_id', ''),
      NULLIF(g.params->'orchestrator_details'->'input_image_generation_ids'->>(g.child_order::int), '')
    ) AS expected_start_generation_id_raw,
    NULLIF(
      g.params->'orchestrator_details'->'pair_shot_generation_ids'->>(g.child_order::int),
      ''
    ) AS step_a_pair_shot_generation_id_raw
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
    END AS expected_start_generation_id,
    CASE
      WHEN cs.step_a_pair_shot_generation_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN cs.step_a_pair_shot_generation_id_raw::uuid
      ELSE NULL
    END AS step_a_pair_shot_generation_id
  FROM child_segments cs
),
paired AS (
  SELECT
    n.generation_id,
    n.parent_generation_id,
    ps.parent_shot_id,
    n.child_order,
    n.created_at,
    n.pair_shot_generation_id,
    n.expected_start_generation_id_raw,
    n.expected_start_generation_id,
    actual_sg.shot_id AS actual_pair_shot_id,
    actual_sg.generation_id AS actual_pair_generation_id,
    (n.step_a_pair_shot_generation_id IS NULL) AS looks_like_step_b_backfill
  FROM normalized n
  LEFT JOIN parent_shots ps
    ON ps.parent_generation_id = n.parent_generation_id
  LEFT JOIN shot_generations actual_sg
    ON actual_sg.id = n.pair_shot_generation_id
),
mismatches AS (
  SELECT
    p.*,
    CASE
      WHEN p.expected_start_generation_id IS NULL THEN 'missing_expected_start_generation_id'
      WHEN p.actual_pair_generation_id IS NULL THEN 'dangling_pair_shot_generation_id'
      WHEN p.actual_pair_shot_id IS DISTINCT FROM p.parent_shot_id THEN 'cross_shot_mismatch'
      WHEN p.actual_pair_generation_id <> p.expected_start_generation_id THEN 'same_shot_position_mismatch'
      ELSE NULL
    END AS mismatch_kind
  FROM paired p
)
SELECT
  mismatch_kind,
  looks_like_step_b_backfill,
  COUNT(*) AS row_count
FROM mismatches
WHERE mismatch_kind IS NOT NULL
GROUP BY mismatch_kind, looks_like_step_b_backfill
ORDER BY mismatch_kind, looks_like_step_b_backfill DESC;
