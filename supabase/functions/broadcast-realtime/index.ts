import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withEdgeRequest } from "../_shared/edgeHandler.ts";
import { jsonResponse } from "../_shared/http.ts";

serve((req) => {
  return withEdgeRequest(
    req,
    {
      functionName: "broadcast-realtime",
      logPrefix: "[BROADCAST-REALTIME]",
      parseBody: "strict",
      auth: {
        required: true,
        requireServiceRole: true,
      },
    },
    async ({ supabaseAdmin, logger, body }) => {
      const channel = typeof body.channel === "string" ? body.channel : "";
      const event = typeof body.event === "string" ? body.event : "";
      const payload = body.payload;

      if (!channel || !event || !payload) {
        return jsonResponse({ error: "Missing required fields: channel, event, payload" }, 400);
      }

      const broadcastChannel = supabaseAdmin.channel(channel);
      const result = await broadcastChannel.send({
        type: "broadcast",
        event,
        payload,
      });

      if (result === "ok") {
        logger.info("Successfully broadcast", { channel });
        return jsonResponse({ success: true }, 200);
      }

      logger.error("Broadcast failed", { channel, result });
      return jsonResponse({ error: "Broadcast failed", result }, 500);
    },
  );
});
