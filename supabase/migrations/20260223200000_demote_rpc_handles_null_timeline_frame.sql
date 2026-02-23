-- Fix demote_orphaned_video_variants to also demote when the paired
-- shot_generation has been removed from the timeline (timeline_frame IS NULL).
--
-- Previously, removing an image set timeline_frame = NULL but kept the record.
-- The RPC only checked if generation_id changed, not if the slot was still
-- on the timeline. Videos with pair_shot_generation_id pointing to a nulled
-- record were never demoted, causing stale videos to persist at wrong positions.

CREATE OR REPLACE FUNCTION demote_orphaned_video_variants(p_shot_id UUID)
RETURNS INTEGER AS $$
DECLARE
  demoted_count INTEGER := 0;
  video_record RECORD;
  stored_gen_id UUID;
  current_gen_id UUID;
  current_timeline_frame INTEGER;
BEGIN
  -- Find all primary video variants linked to this shot via pair_shot_generation_id
  -- These are child video segments (is_child = true) with a slot link
  FOR video_record IN
    SELECT
      g.id as generation_id,
      g.pair_shot_generation_id,
      g.params->'orchestrator_details'->'input_image_generation_ids' as parent_stored_ids,
      g.params->'individual_segment_params'->>'start_image_generation_id' as child_stored_id,
      g.child_order,
      gv.id as variant_id
    FROM generations g
    JOIN generation_variants gv ON gv.generation_id = g.id
    WHERE g.is_child = true
      AND g.type = 'video'
      AND g.pair_shot_generation_id IS NOT NULL
      AND gv.is_primary = true
      AND EXISTS (
        SELECT 1 FROM shot_generations sg
        WHERE sg.id = g.pair_shot_generation_id
          AND sg.shot_id = p_shot_id
      )
  LOOP
    -- Get current generation_id AND timeline_frame at the shot_generations slot
    SELECT sg.generation_id, sg.timeline_frame
    INTO current_gen_id, current_timeline_frame
    FROM shot_generations sg
    WHERE sg.id = video_record.pair_shot_generation_id;

    -- If the slot's image has been removed from the timeline, demote immediately.
    -- The shot_generation record still exists (with NULL frame) but the image
    -- is no longer on the timeline, so the video is orphaned.
    IF current_timeline_frame IS NULL THEN
      UPDATE generation_variants
      SET is_primary = false
      WHERE id = video_record.variant_id;

      UPDATE generations
      SET
        location = NULL,
        thumbnail_url = NULL,
        primary_variant_id = NULL,
        updated_at = NOW()
      WHERE id = video_record.generation_id;

      demoted_count := demoted_count + 1;

      RAISE NOTICE 'Demoted variant % and cleared generation % (slot removed from timeline)',
        video_record.variant_id, video_record.generation_id;
      CONTINUE;
    END IF;

    -- Get stored generation_id for this segment's start image
    -- Child segments store it in individual_segment_params.start_image_generation_id
    -- Parent segments store it in orchestrator_details.input_image_generation_ids[child_order]
    IF video_record.child_stored_id IS NOT NULL THEN
      stored_gen_id := video_record.child_stored_id::UUID;
    ELSIF video_record.parent_stored_ids IS NOT NULL AND video_record.child_order IS NOT NULL THEN
      stored_gen_id := (video_record.parent_stored_ids->>video_record.child_order)::UUID;
    ELSE
      CONTINUE;
    END IF;

    -- If generation_id changed, demote the variant AND clear the generation
    IF stored_gen_id IS NOT NULL AND current_gen_id IS DISTINCT FROM stored_gen_id THEN
      UPDATE generation_variants
      SET is_primary = false
      WHERE id = video_record.variant_id;

      UPDATE generations
      SET
        location = NULL,
        thumbnail_url = NULL,
        primary_variant_id = NULL,
        updated_at = NOW()
      WHERE id = video_record.generation_id;

      demoted_count := demoted_count + 1;

      RAISE NOTICE 'Demoted variant % and cleared generation % (stored: %, current: %)',
        video_record.variant_id, video_record.generation_id, stored_gen_id, current_gen_id;
    END IF;
  END LOOP;

  RETURN demoted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
