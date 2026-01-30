-- Make task_id nullable in shared_generations table
-- This allows sharing generations that don't have an associated task
-- (e.g., final videos from join_clips where the generation->task mapping isn't set)

ALTER TABLE shared_generations
ALTER COLUMN task_id DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN shared_generations.task_id IS 'Optional task ID - share can work without task details';
