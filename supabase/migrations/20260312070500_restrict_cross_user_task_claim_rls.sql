BEGIN;

DROP POLICY IF EXISTS "Allow task claiming for queued tasks" ON tasks;
DROP POLICY IF EXISTS "Allow viewing queued tasks for claiming" ON tasks;

COMMIT;
