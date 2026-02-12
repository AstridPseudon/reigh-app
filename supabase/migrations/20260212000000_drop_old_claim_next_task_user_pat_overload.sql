-- Drop the old 2-parameter overload of claim_next_task_user_pat.
--
-- The Jan 2026 migration (20260121000000_support_multiple_dependencies) added a
-- 3-parameter version with p_run_type, but CREATE OR REPLACE only replaces
-- functions with identical signatures. Since the new version has a different
-- signature (UUID, BOOLEAN, TEXT) vs the old (UUID, BOOLEAN), Postgres created
-- a second overload. PostgREST can't disambiguate between them when the caller
-- omits p_run_type (both accept 2 args due to DEFAULT values), causing 500s.
--
-- Fix: drop the old 2-param version. The 3-param version with
-- p_run_type DEFAULT NULL is a strict superset.

DROP FUNCTION IF EXISTS public.claim_next_task_user_pat(UUID, BOOLEAN);
