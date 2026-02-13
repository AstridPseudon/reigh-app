-- =====================================================================
-- Add idempotency key to tasks table
-- Created: 2026-02-13
-- Purpose: Prevent duplicate task creation from client retries or
--          double-clicks. Nullable so existing tasks are unaffected.
-- =====================================================================

-- Add nullable idempotency_key column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: only enforce uniqueness for non-null keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idempotency_key
  ON tasks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Verify
SELECT 'idempotency_key column and index added to tasks' AS status;
