import Stripe from "https://esm.sh/stripe@14.21.0";

export const AUTO_TOPUP_MIN_AMOUNT_USD = 5;
export const AUTO_TOPUP_MAX_AMOUNT_USD = 100;
export const AUTO_TOPUP_MIN_THRESHOLD_USD = 1;
const STRIPE_API_VERSION = "2024-06-20";

export interface AutoTopupValidationInput {
  autoTopupEnabled: boolean;
  autoTopupAmount?: unknown;
  autoTopupThreshold?: unknown;
}

export type AutoTopupErrorCode =
  | "invalid_credit_purchase_amount"
  | "invalid_auto_topup_amount"
  | "invalid_auto_topup_threshold"
  | "invalid_auto_topup_threshold_relation"
  | "invalid_persisted_auto_topup_amount"
  | "invalid_persisted_auto_topup_threshold"
  | "invalid_persisted_auto_topup_threshold_relation"
  | "stripe_secret_key_missing"
  | "frontend_url_missing";

export interface AutoTopupDomainError {
  code: AutoTopupErrorCode;
  message: string;
  logMessage: string;
}

export type AutoTopupResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AutoTopupDomainError };

function success<T>(value: T): AutoTopupResult<T> {
  return { ok: true, value };
}

function failure(
  code: AutoTopupErrorCode,
  message: string,
  logMessage: string = message,
): AutoTopupResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      logMessage,
    },
  };
}

export function validateCreditPurchaseAmount(amount: unknown): AutoTopupResult<void> {
  if (
    typeof amount !== 'number'
    || Number.isNaN(amount)
    || amount < AUTO_TOPUP_MIN_AMOUNT_USD
    || amount > AUTO_TOPUP_MAX_AMOUNT_USD
  ) {
    return failure(
      'invalid_credit_purchase_amount',
      `Amount must be a number between $${AUTO_TOPUP_MIN_AMOUNT_USD} and $${AUTO_TOPUP_MAX_AMOUNT_USD}`,
    );
  }

  return success(undefined);
}

export function validateAutoTopupConfig(input: AutoTopupValidationInput): AutoTopupResult<void> {
  const { autoTopupEnabled, autoTopupAmount, autoTopupThreshold } = input;
  if (!autoTopupEnabled) {
    return success(undefined);
  }

  if (
    typeof autoTopupAmount !== 'number'
    || Number.isNaN(autoTopupAmount)
    || autoTopupAmount < AUTO_TOPUP_MIN_AMOUNT_USD
    || autoTopupAmount > AUTO_TOPUP_MAX_AMOUNT_USD
  ) {
    return failure(
      'invalid_auto_topup_amount',
      `autoTopupAmount must be a number between $${AUTO_TOPUP_MIN_AMOUNT_USD} and $${AUTO_TOPUP_MAX_AMOUNT_USD}`,
    );
  }

  if (
    typeof autoTopupThreshold !== 'number'
    || Number.isNaN(autoTopupThreshold)
    || autoTopupThreshold < AUTO_TOPUP_MIN_THRESHOLD_USD
  ) {
    return failure(
      'invalid_auto_topup_threshold',
      'autoTopupThreshold must be a positive number',
    );
  }

  if (autoTopupThreshold >= autoTopupAmount) {
    return failure(
      'invalid_auto_topup_threshold_relation',
      'autoTopupThreshold must be less than autoTopupAmount',
    );
  }

  return success(undefined);
}

export function dollarsToCents(amountUsd: number): number {
  return Math.round(amountUsd * 100);
}

export function validatePersistedAutoTopupConfig(
  autoTopupAmountCents: unknown,
  autoTopupThresholdCents: unknown,
): AutoTopupResult<void> {
  if (
    typeof autoTopupAmountCents !== "number"
    || Number.isNaN(autoTopupAmountCents)
    || autoTopupAmountCents <= 0
  ) {
    return failure(
      'invalid_persisted_auto_topup_amount',
      'Auto-top-up amount is not configured correctly',
    );
  }

  if (
    typeof autoTopupThresholdCents !== "number"
    || Number.isNaN(autoTopupThresholdCents)
    || autoTopupThresholdCents <= 0
  ) {
    return failure(
      'invalid_persisted_auto_topup_threshold',
      'Auto-top-up threshold is not configured correctly',
    );
  }

  if (autoTopupThresholdCents >= autoTopupAmountCents) {
    return failure(
      'invalid_persisted_auto_topup_threshold_relation',
      'Auto-top-up threshold must be less than auto-top-up amount',
    );
  }

  return success(undefined);
}

export function requireStripeSecretKey(): AutoTopupResult<string> {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return failure(
      'stripe_secret_key_missing',
      'Stripe not configured',
      'Missing Stripe configuration',
    );
  }
  return success(stripeSecretKey);
}

export function requireFrontendUrl(): AutoTopupResult<string> {
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  if (!frontendUrl) {
    return failure(
      'frontend_url_missing',
      'Frontend URL not configured',
      'FRONTEND_URL not set in environment',
    );
  }
  return success(frontendUrl);
}

export function createStripeClient(): AutoTopupResult<Stripe> {
  const keyResult = requireStripeSecretKey();
  if (!keyResult.ok) {
    return keyResult;
  }

  return success(new Stripe(keyResult.value, {
    apiVersion: STRIPE_API_VERSION,
  }));
}
