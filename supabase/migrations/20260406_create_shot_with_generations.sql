BEGIN;

CREATE OR REPLACE FUNCTION public.create_shot_with_generations(
  p_project_id uuid,
  p_shot_name text,
  p_generation_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_shot_id uuid;
  v_shot_position integer;
  v_generation_id uuid;
  v_frame integer := 0;
  v_shot_generations jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to insert shot into this project';
  END IF;

  SELECT COALESCE(MAX(s.position), -1) + 1
  INTO v_shot_position
  FROM public.shots s
  WHERE s.project_id = p_project_id;

  INSERT INTO public.shots (name, project_id, position)
  VALUES (p_shot_name, p_project_id, v_shot_position)
  RETURNING id INTO v_shot_id;

  FOREACH v_generation_id IN ARRAY COALESCE(p_generation_ids, ARRAY[]::uuid[])
  LOOP
    INSERT INTO public.shot_generations (shot_id, generation_id, timeline_frame, metadata)
    VALUES (
      v_shot_id,
      v_generation_id,
      v_frame,
      jsonb_build_object('auto_positioned', true)
    );

    v_frame := v_frame + 50;
  END LOOP;

  PERFORM public.ensure_shot_parent_generation(v_shot_id, p_project_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sg.id,
        'generation_id', sg.generation_id,
        'timeline_frame', sg.timeline_frame,
        'location', COALESCE(gv.location, g.location),
        'thumbnail_url', COALESCE(gv.thumbnail_url, g.thumbnail_url, gv.location, g.location),
        'type', g.type,
        'created_at', g.created_at,
        'starred', g.starred,
        'name', g.name,
        'based_on', g.based_on,
        'params', g.params,
        'primary_variant_id', g.primary_variant_id
      )
      ORDER BY sg.timeline_frame
    ),
    '[]'::jsonb
  )
  INTO v_shot_generations
  FROM public.shot_generations sg
  JOIN public.generations g ON g.id = sg.generation_id
  LEFT JOIN public.generation_variants gv ON gv.id = g.primary_variant_id
  WHERE sg.shot_id = v_shot_id
    AND sg.timeline_frame IS NOT NULL;

  RETURN jsonb_build_object(
    'shot_id', v_shot_id,
    'shot_name', p_shot_name,
    'shot_position', v_shot_position,
    'shot_generations', v_shot_generations,
    'success', TRUE
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'shot_id', NULL,
    'shot_name', NULL,
    'shot_position', NULL,
    'shot_generations', '[]'::jsonb,
    'success', FALSE
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_shot_with_generations(uuid, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.create_shot_with_generations(uuid, text, uuid[]) IS
'Creates a shot and all requested shot_generations atomically, ensures the canonical parent generation exists, and returns fully joined generation payloads for cache hydration.';

COMMIT;
