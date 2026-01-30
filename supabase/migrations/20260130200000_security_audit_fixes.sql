-- ============================================================================
-- SECURITY AUDIT FIXES - January 2026
-- ============================================================================
-- This migration addresses findings from the database security audit:
-- 1. task_types table - Add RLS to ensure read-only access (no modifications)
-- 2. shot_generations - Add optimized indexes for RLS policy joins
--
-- Note: shared_generations INSERT policy was already fixed in
-- 20251016000001_add_missing_rls_policies.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TASK_TYPES TABLE - Enable RLS with read-only access
-- ============================================================================
-- The task_types table contains pricing configuration. Users need to READ
-- this data (to see pricing) but should NEVER be able to modify it.
-- Only service_role should be able to modify pricing.

ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "task_types_select_authenticated" ON task_types;
DROP POLICY IF EXISTS "task_types_service_role_all" ON task_types;

-- Policy: Authenticated users can only SELECT (read pricing data)
CREATE POLICY "task_types_select_authenticated" ON task_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "task_types_service_role_all" ON task_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: No INSERT/UPDATE/DELETE policies for authenticated users
-- This means they cannot modify the table at all

COMMENT ON POLICY "task_types_select_authenticated" ON task_types IS
  'Security: Users can read pricing data but cannot modify it';

-- ============================================================================
-- 2. SHOT_GENERATIONS RLS PERFORMANCE - Optimized index for ownership joins
-- ============================================================================
-- The RLS policy on shot_generations does:
--   EXISTS (
--     SELECT 1 FROM shots s
--     JOIN projects p ON s.project_id = p.id
--     WHERE s.id = shot_generations.shot_id
--     AND p.user_id = auth.uid()
--   )
-- This requires efficient lookup from shot_id -> project_id -> user_id
--
-- We already have idx_shot_generations_shot_id_position, but let's add
-- a covering index that includes just what the RLS check needs.

-- Check if the index already exists before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_shot_generations_rls_check'
  ) THEN
    CREATE INDEX idx_shot_generations_rls_check
      ON shot_generations(shot_id);
  END IF;
END $$;

-- Also ensure shots table has efficient project_id lookup for the join
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_shots_project_id_for_rls'
  ) THEN
    CREATE INDEX idx_shots_project_id_for_rls
      ON shots(project_id, id);
  END IF;
END $$;

-- And projects needs efficient user_id lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_projects_user_id_for_rls'
  ) THEN
    CREATE INDEX idx_projects_user_id_for_rls
      ON projects(user_id, id);
  END IF;
END $$;

COMMENT ON INDEX idx_shot_generations_rls_check IS
  'Optimizes RLS policy ownership check joins';
COMMENT ON INDEX idx_shots_project_id_for_rls IS
  'Optimizes RLS policy ownership check: shots -> projects join';
COMMENT ON INDEX idx_projects_user_id_for_rls IS
  'Optimizes RLS policy ownership check: projects -> user_id filter';

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================
-- Note: shared_generations INSERT policy was already fixed in
-- 20251016000001_add_missing_rls_policies.sql to verify generation ownership

DO $$
DECLARE
  task_types_rls boolean;
BEGIN
  -- Check RLS is enabled on task_types
  SELECT relrowsecurity INTO task_types_rls
  FROM pg_class WHERE relname = 'task_types';

  IF NOT task_types_rls THEN
    RAISE EXCEPTION 'CRITICAL: RLS not enabled on task_types table';
  END IF;

  RAISE NOTICE '✅ SECURITY AUDIT FIXES APPLIED:';
  RAISE NOTICE '   - task_types: RLS enabled, read-only for users';
  RAISE NOTICE '   - RLS join indexes added for shot_generations, shots, and projects';
END $$;

COMMIT;
