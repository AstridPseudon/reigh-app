-- Function to delete a project with extended timeout
-- This handles large projects that would otherwise timeout due to CASCADE deletes
CREATE OR REPLACE FUNCTION delete_project_with_extended_timeout(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5min'
AS $$
DECLARE
  v_project_user_id UUID;
BEGIN
  -- Verify the project exists and belongs to the user
  SELECT user_id INTO v_project_user_id
  FROM projects
  WHERE id = p_project_id;

  IF v_project_user_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_project_user_id != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to delete this project';
  END IF;

  -- Delete the project (CASCADE will handle related records)
  DELETE FROM projects WHERE id = p_project_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_project_with_extended_timeout(UUID, UUID) TO authenticated;
