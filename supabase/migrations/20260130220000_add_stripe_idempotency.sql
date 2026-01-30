-- ============================================================================
-- STRIPE WEBHOOK IDEMPOTENCY - Prevent double-crediting from replay attacks
-- ============================================================================
-- Issue: Stripe webhooks can be replayed (by attackers or network retries)
-- Without idempotency checks, this could credit a user multiple times
--
-- Fix: Add unique partial indexes on stripe_session_id and stripe_payment_intent_id
-- ============================================================================

BEGIN;

-- Create unique index for checkout.session.completed events
-- This prevents duplicate credits from the same Stripe checkout session
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_ledger_stripe_session_unique
  ON credits_ledger ((metadata->>'stripe_session_id'))
  WHERE type = 'stripe'
    AND metadata->>'stripe_session_id' IS NOT NULL;

-- Create unique index for payment_intent.succeeded events (auto-topup)
-- This prevents duplicate credits from the same payment intent
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_ledger_stripe_payment_intent_unique
  ON credits_ledger ((metadata->>'stripe_payment_intent_id'))
  WHERE type = 'auto_topup'
    AND metadata->>'stripe_payment_intent_id' IS NOT NULL;

-- Add comments
COMMENT ON INDEX idx_credits_ledger_stripe_session_unique IS
  'Idempotency: Prevents duplicate credits from Stripe checkout session replays';

COMMENT ON INDEX idx_credits_ledger_stripe_payment_intent_unique IS
  'Idempotency: Prevents duplicate credits from Stripe payment intent replays (auto-topup)';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ STRIPE IDEMPOTENCY PROTECTION ADDED:';
  RAISE NOTICE '   - Unique index on stripe_session_id for checkout events';
  RAISE NOTICE '   - Unique index on stripe_payment_intent_id for auto-topup events';
  RAISE NOTICE '   - Webhook replays will now fail with unique constraint violation';
END $$;

COMMIT;
