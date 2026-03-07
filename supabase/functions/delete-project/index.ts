import { toErrorMessage } from "../_shared/errorMessage.ts";
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { bootstrapEdgeHandler, NO_SESSION_RUNTIME_OPTIONS } from "../_shared/edgeHandler.ts"
import { checkRateLimit, isRateLimitExceededFailure, rateLimitFailureResponse } from "../_shared/rateLimit.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const bootstrap = await bootstrapEdgeHandler(req, {
    functionName: 'delete-project',
    logPrefix: '[DELETE-PROJECT]',
    method: 'POST',
    corsPreflight: false,
    auth: {
      required: true,
      options: { allowJwtUserAuth: true },
    },
    ...NO_SESSION_RUNTIME_OPTIONS,
  })
  if (!bootstrap.ok) {
    return bootstrap.response
  }

  const { supabaseAdmin, logger, auth } = bootstrap.value

  try {
    if (!auth?.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit: 10 requests per minute for this destructive operation
    const deleteProjectLimit = { maxRequests: 10, windowSeconds: 60 }
    const rateLimitResult = await checkRateLimit({
      supabaseAdmin,
      functionName: 'delete-project',
      identifier: auth.userId,
      config: deleteProjectLimit,
      logPrefix: '[DELETE-PROJECT]',
    })
    if (!rateLimitResult.ok) {
      if (isRateLimitExceededFailure(rateLimitResult)) {
        logger.warn("Rate limit exceeded", { user_id: auth.userId })
        await logger.flush()
        return rateLimitFailureResponse(rateLimitResult, deleteProjectLimit)
      }

      logger.error("Rate limit check failed", {
        user_id: auth.userId,
        error_code: rateLimitResult.errorCode,
        message: rateLimitResult.message,
      })
      await logger.flush()
      return new Response(
        JSON.stringify({ error: 'Rate limit service unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (rateLimitResult.policy === 'fail_open') {
      logger.warn("Rate limit check degraded; allowing request", {
        user_id: auth.userId,
        reason: rateLimitResult.value.degraded?.reason,
        message: rateLimitResult.value.degraded?.message,
      })
    }

    // Parse request body
    const { projectId } = await req.json()
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logger.info('Starting deletion', { projectId, user_id: auth.userId })

    // Call the PostgreSQL function with extended timeout (5 minutes)
    // This handles large projects that would otherwise timeout due to CASCADE deletes
    const { error: deleteError } = await supabaseAdmin.rpc(
      'delete_project_with_extended_timeout',
      { p_project_id: projectId, p_user_id: auth.userId }
    )

    if (deleteError) {
      logger.error('Error deleting project', { projectId, error: deleteError.message })
      await logger.flush()
      return new Response(
        JSON.stringify({ error: `Failed to delete project: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logger.info('Successfully deleted project', { projectId })

    await logger.flush()
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = toErrorMessage(err)
    logger.error('Unexpected error', { error: message })
    await logger.flush()
    return new Response(
      JSON.stringify({ error: message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
