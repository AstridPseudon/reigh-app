import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { bootstrapEdgeHandler } from "../_shared/edgeHandler.ts";
import { jsonResponse } from "../_shared/http.ts";
import { toErrorMessage } from "../_shared/errorMessage.ts";
import {
  generateThumbnailFilename,
  generateUniqueFilename,
  MEDIA_BUCKET,
  storagePaths,
} from "../_shared/storagePaths.ts";
import {
  DEFAULT_IMAGE_TRANSFORM,
  decodeImageTransform,
  describeImageTransform,
  hasImageTransformChanges,
  type ImageTransform,
} from "../../../src/shared/lib/media/imageTransform.ts";

type ApplyImageTransformBody = {
  generation_id?: unknown;
  source_image_url?: unknown;
  source_variant_id?: unknown;
  user_id?: unknown;
  create_as_generation?: unknown;
  make_primary?: unknown;
  variant_name?: unknown;
  tool_type?: unknown;
  transform?: unknown;
};

type GenerationRow = {
  id: string;
  project_id: string;
  location: string | null;
  primary_variant_id: string | null;
};

type StorageCapableSupabaseClient = SupabaseClient & {
  storage: SupabaseClient["storage"];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function buildTransformMetadata(input: {
  transform: ImageTransform;
  generationId: string;
  sourceVariantId: string | null;
  toolType: string;
  sourceImageUrl: string;
}): Record<string, unknown> {
  return {
    transform_applied: input.transform,
    saved_at: new Date().toISOString(),
    tool_type: input.toolType,
    repositioned_from: input.generationId,
    source_image_url: input.sourceImageUrl,
    ...(input.sourceVariantId ? { source_variant_id: input.sourceVariantId } : {}),
    applied_via: "apply-image-transform",
  };
}

async function uploadBlob(
  supabaseAdmin: StorageCapableSupabaseClient,
  blob: Blob,
  path: string,
  contentType: string,
): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed for ${path}: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

async function fetchSourceGeneration(
  supabaseAdmin: StorageCapableSupabaseClient,
  generationId: string,
): Promise<GenerationRow> {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, project_id, location, primary_variant_id")
    .eq("id", generationId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load generation ${generationId}: ${error?.message ?? "missing generation"}`);
  }

  return data as GenerationRow;
}

async function resolveSourceVariantId(input: {
  supabaseAdmin: StorageCapableSupabaseClient;
  generationId: string;
  explicitSourceVariantId: string | null;
  sourceImageUrl: string;
}): Promise<string | null> {
  if (input.explicitSourceVariantId) {
    return input.explicitSourceVariantId;
  }

  const { data, error } = await input.supabaseAdmin
    .from("generation_variants")
    .select("id")
    .eq("generation_id", input.generationId)
    .eq("location", input.sourceImageUrl)
    .maybeSingle();

  if (error) {
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

function createOutputCanvas(transformedCanvas: OffscreenCanvas): OffscreenCanvas {
  const outputCanvas = new OffscreenCanvas(transformedCanvas.width, transformedCanvas.height);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Failed to create output canvas context");
  }

  outputCtx.fillStyle = "#000000";
  outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.drawImage(transformedCanvas, 0, 0);
  return outputCanvas;
}

function createThumbnailCanvas(sourceCanvas: OffscreenCanvas): OffscreenCanvas {
  const thumbnailMaxSize = 300;
  const aspectRatio = sourceCanvas.width / sourceCanvas.height;
  const thumbWidth = aspectRatio > 1
    ? Math.min(sourceCanvas.width, thumbnailMaxSize)
    : Math.round(Math.min(sourceCanvas.height, thumbnailMaxSize) * aspectRatio);
  const thumbHeight = aspectRatio > 1
    ? Math.round(Math.min(sourceCanvas.width, thumbnailMaxSize) / aspectRatio)
    : Math.min(sourceCanvas.height, thumbnailMaxSize);

  const thumbnailCanvas = new OffscreenCanvas(thumbWidth, thumbHeight);
  const thumbCtx = thumbnailCanvas.getContext("2d");
  if (!thumbCtx) {
    throw new Error("Failed to create thumbnail canvas context");
  }

  thumbCtx.drawImage(sourceCanvas, 0, 0, thumbWidth, thumbHeight);
  return thumbnailCanvas;
}

async function createTransformedCanvas(sourceImageUrl: string, transform: ImageTransform): Promise<OffscreenCanvas> {
  const imageResponse = await fetch(sourceImageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch source image: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBlob = new Blob([imageBuffer]);
  const imageBitmap = await createImageBitmap(imageBlob);

  const sourceWidth = imageBitmap.width;
  const sourceHeight = imageBitmap.height;
  const transformedCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const transformedCtx = transformedCanvas.getContext("2d");
  if (!transformedCtx) {
    throw new Error("Failed to create transformed canvas context");
  }

  transformedCtx.clearRect(0, 0, sourceWidth, sourceHeight);
  transformedCtx.save();
  transformedCtx.translate(sourceWidth / 2, sourceHeight / 2);

  const translateXPx = (transform.translateX / 100) * sourceWidth;
  const translateYPx = (transform.translateY / 100) * sourceHeight;
  transformedCtx.translate(translateXPx, translateYPx);

  const scaleX = transform.flipH ? -transform.scale : transform.scale;
  const scaleY = transform.flipV ? -transform.scale : transform.scale;
  transformedCtx.scale(scaleX, scaleY);
  transformedCtx.rotate((transform.rotation * Math.PI) / 180);

  transformedCtx.drawImage(
    imageBitmap,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight,
  );
  transformedCtx.restore();

  return transformedCanvas;
}

serve(async (req) => {
  const bootstrap = await bootstrapEdgeHandler<ApplyImageTransformBody>(req, {
    functionName: "apply-image-transform",
    logPrefix: "[APPLY-IMAGE-TRANSFORM]",
    method: "POST",
    parseBody: "strict",
    auth: {
      required: true,
      requireServiceRole: true,
    },
  });

  if (!bootstrap.ok) {
    return bootstrap.response;
  }

  const { body, supabaseAdmin, logger } = bootstrap.value;

  try {
    const generationId = asString(body.generation_id);
    if (!generationId) {
      return jsonResponse({ error: "generation_id is required" }, 400);
    }

    const sourceGeneration = await fetchSourceGeneration(supabaseAdmin as StorageCapableSupabaseClient, generationId);
    const userId = asString(body.user_id);
    if (!userId) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    const transform = decodeImageTransform(body.transform) ?? DEFAULT_IMAGE_TRANSFORM;
    if (!hasImageTransformChanges(transform)) {
      return jsonResponse({ error: "transform must include at least one change" }, 400);
    }

    const createAsGeneration = asBoolean(body.create_as_generation, false);
    const makePrimary = createAsGeneration ? true : asBoolean(body.make_primary, true);
    const sourceImageUrl = asString(body.source_image_url) ?? sourceGeneration.location;
    if (!sourceImageUrl) {
      return jsonResponse({ error: "source_image_url is required when the generation has no location" }, 400);
    }

    const explicitSourceVariantId = asString(body.source_variant_id);
    const sourceVariantId = await resolveSourceVariantId({
      supabaseAdmin,
      generationId,
      explicitSourceVariantId,
      sourceImageUrl,
    });

    const toolType = asString(body.tool_type) ?? "video-editor";
    const variantName = asString(body.variant_name) ?? describeImageTransform(transform);

    logger.info("Applying image transform", {
      generation_id: generationId,
      create_as_generation: createAsGeneration,
      make_primary: makePrimary,
      source_variant_id: sourceVariantId,
      source_image_url: sourceImageUrl,
      transform,
    });

    const transformedCanvas = await createTransformedCanvas(sourceImageUrl, transform);
    const outputCanvas = createOutputCanvas(transformedCanvas);
    const thumbnailCanvas = createThumbnailCanvas(outputCanvas);

    const transformedBlob = await outputCanvas.convertToBlob({ type: "image/png" });
    const thumbnailBlob = await thumbnailCanvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });

    const outputPath = storagePaths.upload(userId, generateUniqueFilename("png"));
    const thumbnailPath = storagePaths.thumbnail(userId, generateThumbnailFilename());

    const [outputUrl, thumbnailUrl] = await Promise.all([
      uploadBlob(supabaseAdmin as StorageCapableSupabaseClient, transformedBlob, outputPath, "image/png"),
      uploadBlob(supabaseAdmin as StorageCapableSupabaseClient, thumbnailBlob, thumbnailPath, "image/jpeg"),
    ]);

    const metadata = buildTransformMetadata({
      transform,
      generationId,
      sourceVariantId,
      toolType,
      sourceImageUrl,
    });

    if (createAsGeneration) {
      const { data: insertedGeneration, error: generationError } = await supabaseAdmin
        .from("generations")
        .insert({
          project_id: sourceGeneration.project_id,
          location: outputUrl,
          thumbnail_url: thumbnailUrl,
          type: "image",
          based_on: generationId,
          params: metadata,
        })
        .select("id")
        .single();

      if (generationError || typeof insertedGeneration?.id !== "string") {
        throw new Error(`Failed to create transformed generation: ${generationError?.message ?? "missing generation id"}`);
      }

      const { data: insertedVariant, error: variantError } = await supabaseAdmin
        .from("generation_variants")
        .insert({
          generation_id: insertedGeneration.id,
          location: outputUrl,
          thumbnail_url: thumbnailUrl,
          is_primary: true,
          variant_type: "original",
          name: "Original",
          params: metadata,
        })
        .select("id")
        .single();

      if (variantError || typeof insertedVariant?.id !== "string") {
        throw new Error(`Failed to create original variant for transformed generation: ${variantError?.message ?? "missing variant id"}`);
      }

      return jsonResponse({
        success: true,
        create_as_generation: true,
        generation_id: insertedGeneration.id,
        variant_id: insertedVariant.id,
        location: outputUrl,
        thumbnail_url: thumbnailUrl,
      });
    }

    const { data: insertedVariant, error: insertError } = await supabaseAdmin
      .from("generation_variants")
      .insert({
        generation_id: generationId,
        location: outputUrl,
        thumbnail_url: thumbnailUrl,
        is_primary: makePrimary,
        variant_type: "repositioned",
        name: variantName,
        params: metadata,
      })
      .select("id")
      .single();

    if (insertError || typeof insertedVariant?.id !== "string") {
      throw new Error(`Failed to create transformed variant: ${insertError?.message ?? "missing variant id"}`);
    }

    return jsonResponse({
      success: true,
      create_as_generation: false,
      generation_id: generationId,
      variant_id: insertedVariant.id,
      location: outputUrl,
      thumbnail_url: thumbnailUrl,
      is_primary: makePrimary,
      variant_name: variantName,
    });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    logger.error("Failed to apply image transform", { error: message });
    await logger.flush();
    return jsonResponse({ error: message }, 500);
  }
});
