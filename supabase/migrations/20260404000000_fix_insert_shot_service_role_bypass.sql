-- Fix insert_shot_at_position to allow service-role calls (matching
-- create_shot_with_image pattern).  The agent's supabaseAdmin client uses
-- the service role, so auth.uid() is NULL and the ownership check fails.
CREATE OR REPLACE FUNCTION public.insert_shot_at_position(
  p_project_id uuid,
  p_shot_name text,
  p_position integer
)
RETURNS TABLE(shot_id uuid, shot_name text, shot_position integer, success boolean)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_shot_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to insert shot into this project';
  END IF;

  UPDATE public.shots
  SET position = position + 1
  WHERE project_id = p_project_id
    AND position >= p_position;

  INSERT INTO public.shots (name, project_id, position)
  VALUES (p_shot_name, p_project_id, p_position)
  RETURNING id INTO v_shot_id;

  PERFORM public.ensure_shot_parent_generation(v_shot_id, p_project_id);

  RETURN QUERY
  SELECT v_shot_id, p_shot_name, p_position, TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY
  SELECT NULL::uuid, NULL::text, NULL::integer, FALSE;
END;
$function$;
