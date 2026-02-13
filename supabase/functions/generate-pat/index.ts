/* eslint-disable */
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { SystemLogger } from "../_shared/systemLogger.ts";

// Helper for standard JSON responses with CORS headers
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

// Generate a cryptographically secure random 32-character token
function generateToken(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (v) => charset[v % charset.length]).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  const logger = new SystemLogger(supabaseAdmin, 'generate-pat');

  try {
    const auth = await authenticateRequest(req, supabaseAdmin, "[GENERATE-PAT]", { allowJwtUserAuth: true });
    if (!auth.success || !auth.userId) {
      return jsonResponse({ error: auth.error || 'Authentication failed' }, auth.statusCode || 401);
    }

    // Rate limit: max 10 PAT generations per minute per user
    const rateLimitResult = await checkRateLimit(
      supabaseAdmin,
      'generate-pat',
      auth.userId,
      { maxRequests: 10, windowSeconds: 60, identifierType: 'user' },
      '[GENERATE-PAT]'
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, { maxRequests: 10, windowSeconds: 60, identifierType: 'user' });
    }

    const { label } = await req.json();

    // Generate a cryptographically secure 32-character token
    const apiToken = generateToken();

    // Store token metadata
    const { error: insertError } = await supabaseAdmin
      .from('user_api_tokens')
      .insert({
        user_id: auth.userId,
        token: apiToken,
        label: label || 'API Token',
      });

    if (insertError) {
      logger.error('Error storing token metadata', { error: insertError.message, user_id: auth.userId });
      await logger.flush();
      return jsonResponse({ error: 'Failed to store token metadata', details: insertError.message }, 500);
    }

    return jsonResponse({ 
      token: apiToken,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in generate-pat', { error: message });
    await logger.flush();
    return jsonResponse({ error: message }, 500);
  }
}); 