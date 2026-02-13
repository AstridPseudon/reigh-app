-- ============================================================================
-- REMOVE APPLICATION_NAME BYPASS FROM CREDIT SYSTEM
-- ============================================================================
-- The prevent_direct_credit_updates trigger was already cleaned up in
-- 20250910220010 to remove the application_name bypass. However,
-- refresh_user_balance still sets application_name as dead code.
--
-- This migration:
-- 1. Cleans up refresh_user_balance to remove vestigial application_name usage
-- 2. Re-asserts the clean trigger definition (defense in depth)
-- ============================================================================

-- 1. Clean up refresh_user_balance: remove dead application_name set/reset
--    The function has SECURITY DEFINER because it's a trigger on credits_ledger
--    that needs to UPDATE users.credits. The credits_ledger table has RLS
--    restricting writes to service_role, so this trigger always fires in a
--    service_role context, which the credit protection trigger allows.
CREATE OR REPLACE FUNCTION refresh_user_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users SET credits = (
    SELECT COALESCE(SUM(amount), 0)
    FROM credits_ledger
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  ) WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Re-assert the clean credit protection trigger (no application_name bypass).
--    This is identical to the version from 20250910220010 but re-stated here
--    as defense in depth: if a migration between then and now somehow
--    reintroduced the bypass, this corrects it.
CREATE OR REPLACE FUNCTION prevent_direct_credit_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow if called by service role (edge functions using supabaseAdmin,
  -- and SECURITY DEFINER functions triggered from service_role context)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block direct credit changes from any other role
  IF OLD.credits IS DISTINCT FROM NEW.credits THEN
    RAISE EXCEPTION 'Direct credit updates are not allowed. Use the credits_ledger table.';
  END IF;

  RETURN NEW;
END;
$$;
