-- Fix: allow cascade deletion of original variants when the parent generation is deleted.
--
-- The prior trigger (20260330000000_protect_original_variant_deletion) unconditionally
-- blocked deletion of any variant whose variant_type = 'original'. That broke gallery
-- delete: DELETE FROM generations cascades to generation_variants via the FK, fires this
-- trigger on the original variant, and aborts the whole statement.
--
-- The intended invariant is narrower: "a generation must always have an original variant
-- *while the generation exists*." Once the parent generation is gone, the original
-- variant should go with it.
--
-- Postgres implements ON DELETE CASCADE via AFTER ROW triggers on the parent. By the
-- time the RI action fires the child DELETE and the child's BEFORE DELETE trigger runs,
-- the parent row has already been removed within the current transaction. So an EXISTS
-- check against the parent cleanly distinguishes the two cases:
--   - direct DELETE FROM generation_variants WHERE id = <original> → parent exists → reject
--   - cascade from DELETE FROM generations WHERE id = <parent>      → parent gone   → allow

CREATE OR REPLACE FUNCTION prevent_original_variant_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM generations WHERE id = OLD.generation_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Cannot delete the original variant (id: %). Original variants are protected while their generation exists.', OLD.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_original_variant_deletion() IS
  'Blocks direct deletion of an original variant while its parent generation exists. Cascade deletes from the parent are allowed because the parent row is already gone by the time this BEFORE DELETE fires.';
