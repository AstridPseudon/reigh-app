/* eslint-disable */
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth.ts";

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Create Supabase client with service role for admin operations
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

    const auth = await authenticateRequest(req, supabaseAdmin, "[REVOKE-PAT]", { allowJwtUserAuth: true });
    if (!auth.success || !auth.userId) {
      return jsonResponse({ error: auth.error || 'Authentication failed' }, auth.statusCode || 401);
    }

    // Get request body
    const { tokenId } = await req.json();

    if (!tokenId) {
      return jsonResponse({ error: 'tokenId is required' }, 400);
    }

    // Delete the token (RLS will ensure user can only delete their own)
    const { error: deleteError } = await supabaseAdmin
      .from('user_api_tokens')
      .delete()
      .eq('id', tokenId)
      .eq('user_id', auth.userId); // Extra safety check

    if (deleteError) {
      console.error('Error deleting token:', deleteError);
      return jsonResponse({ error: 'Failed to revoke token' }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error: unknown) {
    console.error('Error in revoke-pat function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}); 