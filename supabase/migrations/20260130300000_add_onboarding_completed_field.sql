-- Add onboarding_completed field separate from given_credits
-- This allows us to track onboarding completion independently from credit grants

-- Add the new column
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Set onboarding_completed = true for users who already completed the old welcome bonus flow
UPDATE users SET onboarding_completed = true WHERE given_credits = true;

-- Add comment explaining the field
COMMENT ON COLUMN users.onboarding_completed IS 'Tracks whether user has completed the onboarding flow. Separate from given_credits which tracks welcome bonus.';
