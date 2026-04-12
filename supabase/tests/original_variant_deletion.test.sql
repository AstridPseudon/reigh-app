-- Verification for the original-variant deletion trigger.
--
-- Invariant under test:
--   A generation must always have an original variant *while the generation exists*.
--   - Direct deletion of an original variant whose parent still exists → REJECTED.
--   - Cascade deletion triggered by deleting the parent generation     → ALLOWED,
--     and the original variant is removed along with the parent.
--
-- Run locally (safe — everything is rolled back at the end):
--   psql "$SUPABASE_DB_URL" -f supabase/tests/original_variant_deletion.test.sql
-- or against a linked project:
--   npx supabase db execute --linked --file supabase/tests/original_variant_deletion.test.sql

BEGIN;

DO $$
DECLARE
  test_user_id    uuid := gen_random_uuid();
  test_project_id uuid := gen_random_uuid();
  test_gen_id     uuid := gen_random_uuid();
  test_var_id     uuid := gen_random_uuid();
  caught_message  text;
  parent_count    integer;
  variant_count   integer;
BEGIN
  -- Fixtures
  INSERT INTO users (id, name, email)
    VALUES (test_user_id, 'trigger-test', 'trigger-test@example.invalid');

  INSERT INTO projects (id, name, user_id)
    VALUES (test_project_id, 'trigger-test-project', test_user_id);

  INSERT INTO generations (id, project_id, location, type)
    VALUES (test_gen_id, test_project_id, 'https://example.invalid/orig.png', 'image');

  INSERT INTO generation_variants (id, generation_id, location, is_primary, variant_type, name)
    VALUES (test_var_id, test_gen_id, 'https://example.invalid/orig.png', true, 'original', 'Original');

  -- ------------------------------------------------------------------
  -- Case 1: direct delete of the original variant must be REJECTED
  --         (parent generation still exists)
  -- ------------------------------------------------------------------
  BEGIN
    DELETE FROM generation_variants WHERE id = test_var_id;
    RAISE EXCEPTION 'FAIL: direct delete of original variant was not blocked';
  EXCEPTION
    WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS caught_message = MESSAGE_TEXT;
      IF caught_message NOT LIKE 'Cannot delete the original variant%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'PASS: direct delete rejected (%)', caught_message;
  END;

  -- Variant should still be present.
  SELECT count(*) INTO variant_count
    FROM generation_variants WHERE id = test_var_id;
  IF variant_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: original variant missing after rejected delete (count=%)', variant_count;
  END IF;

  -- ------------------------------------------------------------------
  -- Case 2: deleting the parent generation must CASCADE and remove the
  --         original variant along with it.
  -- ------------------------------------------------------------------
  DELETE FROM generations WHERE id = test_gen_id;

  SELECT count(*) INTO parent_count
    FROM generations WHERE id = test_gen_id;
  IF parent_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: parent generation not deleted (count=%)', parent_count;
  END IF;

  SELECT count(*) INTO variant_count
    FROM generation_variants WHERE id = test_var_id;
  IF variant_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: original variant not cascaded (count=%)', variant_count;
  END IF;
  RAISE NOTICE 'PASS: cascade delete removed parent and original variant';

  RAISE NOTICE 'ALL CASES PASSED';
END $$;

ROLLBACK;
