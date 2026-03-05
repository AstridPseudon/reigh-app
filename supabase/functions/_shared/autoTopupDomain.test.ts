import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStripeClient,
  dollarsToCents,
  requireFrontendUrl,
  requireStripeSecretKey,
  validateAutoTopupConfig,
  validateCreditPurchaseAmount,
  validatePersistedAutoTopupConfig,
} from './autoTopupDomain.ts';

type DenoEnvLike = {
  get: (key: string) => string | undefined;
};

describe('autoTopupDomain', () => {
  const originalDeno = (globalThis as Record<string, unknown>).Deno;
  let env: Record<string, string | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {};
    (globalThis as Record<string, unknown>).Deno = {
      env: {
        get: (key: string) => env[key],
      } satisfies DenoEnvLike,
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).Deno = originalDeno;
  });

  it('validates purchase amount and auto-top-up config ranges', () => {
    expect(validateCreditPurchaseAmount(10).ok).toBe(true);
    const invalidAmount = validateCreditPurchaseAmount(1);
    expect(invalidAmount.ok).toBe(false);
    if (!invalidAmount.ok) {
      expect(invalidAmount.error.message).toContain('between $5 and $100');
    }

    expect(validateAutoTopupConfig({
      autoTopupEnabled: false,
    }).ok).toBe(true);

    expect(validateAutoTopupConfig({
      autoTopupEnabled: true,
      autoTopupAmount: 20,
      autoTopupThreshold: 5,
    }).ok).toBe(true);

    const invalidThresholdRelation = validateAutoTopupConfig({
      autoTopupEnabled: true,
      autoTopupAmount: 20,
      autoTopupThreshold: 20,
    });
    expect(invalidThresholdRelation.ok).toBe(false);
    if (!invalidThresholdRelation.ok) {
      expect(invalidThresholdRelation.error.message).toBe('autoTopupThreshold must be less than autoTopupAmount');
    }
  });

  it('normalizes cents and validates persisted config values', () => {
    expect(dollarsToCents(12.345)).toBe(1235);
    expect(validatePersistedAutoTopupConfig(2000, 500).ok).toBe(true);

    const invalidAmount = validatePersistedAutoTopupConfig(0, 500);
    expect(invalidAmount.ok).toBe(false);
    if (!invalidAmount.ok) {
      expect(invalidAmount.error.message).toBe('Auto-top-up amount is not configured correctly');
    }

    const invalidThresholdRelation = validatePersistedAutoTopupConfig(2000, 2500);
    expect(invalidThresholdRelation.ok).toBe(false);
    if (!invalidThresholdRelation.ok) {
      expect(invalidThresholdRelation.error.message).toBe(
        'Auto-top-up threshold must be less than auto-top-up amount',
      );
    }
  });

  it('resolves env values and reports missing config through result errors', () => {
    env.STRIPE_SECRET_KEY = 'sk_test_123';
    env.FRONTEND_URL = 'https://example.com';

    const stripeKey = requireStripeSecretKey();
    expect(stripeKey.ok).toBe(true);
    if (stripeKey.ok) {
      expect(stripeKey.value).toBe('sk_test_123');
    }

    const frontendUrl = requireFrontendUrl();
    expect(frontendUrl.ok).toBe(true);
    if (frontendUrl.ok) {
      expect(frontendUrl.value).toBe('https://example.com');
    }

    const stripeClient = createStripeClient();
    expect(stripeClient.ok).toBe(true);

    delete env.STRIPE_SECRET_KEY;
    const missingStripe = requireStripeSecretKey();
    expect(missingStripe).toEqual({
      ok: false,
      error: {
        code: 'stripe_secret_key_missing',
        message: 'Stripe not configured',
        logMessage: 'Missing Stripe configuration',
      },
    });

    delete env.FRONTEND_URL;
    const missingFrontend = requireFrontendUrl();
    expect(missingFrontend).toEqual({
      ok: false,
      error: {
        code: 'frontend_url_missing',
        message: 'Frontend URL not configured',
        logMessage: 'FRONTEND_URL not set in environment',
      },
    });
  });
});
