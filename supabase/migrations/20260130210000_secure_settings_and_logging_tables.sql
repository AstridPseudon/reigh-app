-- ============================================================================
-- CRITICAL SECURITY FIX: settings and timeline_update_log tables
-- ============================================================================
-- Found in security audit:
-- 1. settings table - NO RLS, any user can read/modify system settings
-- 2. timeline_update_log - Has GRANT SELECT but no RLS (debug table)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SETTINGS TABLE - Add RLS (CRITICAL)
-- ============================================================================
-- This table stores system-wide settings like disable_timeline_standardization
-- Users should be able to READ settings but NOT modify them

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (none exist, but be safe)
DROP POLICY IF EXISTS "settings_select_all" ON settings;
DROP POLICY IF EXISTS "settings_service_role_all" ON settings;

-- Policy: Anyone can READ settings (needed for feature flags)
CREATE POLICY "settings_select_all" ON settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Only service_role can modify settings
CREATE POLICY "settings_service_role_all" ON settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: No INSERT/UPDATE/DELETE for authenticated/anon
-- This prevents users from modifying system settings

COMMENT ON TABLE settings IS
  'System-wide settings. RLS: Read-only for users, service_role can modify.';

-- ============================================================================
-- 2. TIMELINE_UPDATE_LOG TABLE - Add RLS for consistency
-- ============================================================================
-- This is a debug/logging table. Current state:
-- - Has GRANT SELECT to authenticated
-- - No RLS enabled
--
-- Decision: Keep read access for debugging but add RLS for consistency
-- with other logging tables (system_logs is service_role only)

-- Enable RLS
ALTER TABLE timeline_update_log ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "timeline_update_log_select_authenticated" ON timeline_update_log;
DROP POLICY IF EXISTS "timeline_update_log_service_role_all" ON timeline_update_log;

-- Policy: Authenticated users can SELECT (for debugging)
-- This maintains backward compatibility with existing GRANT
CREATE POLICY "timeline_update_log_select_authenticated" ON timeline_update_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role has full access (for triggers/cleanup)
CREATE POLICY "timeline_update_log_service_role_all" ON timeline_update_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: INSERT happens via trigger (runs as table owner), so no user INSERT policy needed
-- The trigger function log_timeline_frame_updates() inserts rows automatically

COMMENT ON TABLE timeline_update_log IS
  'Debug logging for timeline_frame changes. RLS: Authenticated can SELECT for debugging.';

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  settings_rls boolean;
  timeline_log_rls boolean;
BEGIN
  SELECT relrowsecurity INTO settings_rls
  FROM pg_class WHERE relname = 'settings';

  SELECT relrowsecurity INTO timeline_log_rls
  FROM pg_class WHERE relname = 'timeline_update_log';

  IF NOT settings_rls THEN
    RAISE EXCEPTION 'CRITICAL: RLS not enabled on settings table';
  END IF;

  IF NOT timeline_log_rls THEN
    RAISE EXCEPTION 'RLS not enabled on timeline_update_log table';
  END IF;

  RAISE NOTICE '✅ SECURITY FIX APPLIED:';
  RAISE NOTICE '   - settings: RLS enabled, read-only for users';
  RAISE NOTICE '   - timeline_update_log: RLS enabled, read-only for authenticated';
END $$;

COMMIT;
