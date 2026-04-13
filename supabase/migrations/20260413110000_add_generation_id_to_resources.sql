-- Add an optional generation pointer to resources so style references can
-- resolve through generations while keeping resources as the owning record.

ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS generation_id uuid
REFERENCES public.generations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_resources_generation_id
ON public.resources (generation_id);
