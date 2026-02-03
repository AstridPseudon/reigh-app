# `any` Type Cleanup Plan

## Master Checklist

### Phase 1: Foundation Types (define before fixing consumers)
- [ ] 1A. Create `src/shared/types/generationRow.ts` — extend `GenerationRow` with all the ad-hoc fields accessed via `as any` (`parent_generation_id`, `child_order`, `pair_shot_generation_id`, `shot_generations`, `generation_variants`, `based_on`, `name`, `derivedCount`, `hasUnviewedVariants`, `unviewedVariantCount`, `_variant_id`, `_optimistic`, `starred`, `created_at`/`createdAt`, `thumbnail_url`, `url`, `video_url`, `width`, `height`)
- [ ] 1B. Create `src/shared/types/supabaseQueryResult.ts` — typed wrappers for Supabase query shapes (`PaginatedResult<T>` with `.items` and `.total`, `ShotWithImages`, `GenerationWithRelations`)
- [ ] 1C. Create `src/shared/types/realtimePayloads.ts` — payload types for each broadcast channel event (`TaskUpdatePayload`, `NewTaskPayload`, `ShotGenerationChangePayload`, `VariantChangePayload`, `GenerationUpdatePayload`)
- [ ] 1D. Extend `src/shared/types/phaseConfig.ts` — ensure `PhaseConfig` includes `phases[].loras` array type
- [ ] 1E. Create `src/shared/types/presetMetadata.ts` — `PresetMetadata` with `sample_generations`, `phase_config`, etc.
- [ ] 1F. Create `src/shared/types/lightboxMedia.ts` — union type `LightboxMediaItem` covering all the fields the lightbox accesses (`shot_id`, `position`, `all_shot_associations`, `timeline_frame`, `generation_id`, `starred`, `url`, `thumbnail_url`, `params`, `metadata`, `based_on`, `name`, `video_url`)
- [ ] 1G. Extend `src/shared/types/taskDetailsTypes.ts` — replace `task: any` with `Task` import
- [ ] 1H. Audit `Record<string, any>` in settings — create `ToolSettings`, `ShotSettings`, `ProjectSettings` discriminated types in `src/shared/types/settings.ts`

### Phase 2: Realtime & Provider Layer (~55 `any`) ✅ DONE
- [x] 2A. `src/shared/realtime/SimpleRealtimeManager.ts` — type `channel`, `eventBatchQueue`, all `payload: any` callbacks, `batchEvent`, `dispatchBatched*` methods using 1C types
- [x] 2B. `src/shared/providers/SimpleRealtimeProvider.tsx` — type all `(p: any)` callbacks in event handlers using 1C types
- [x] 2C. `src/shared/contexts/AuthContext.tsx` — type `session` param using Supabase `Session` type

### Phase 3: Core Data Hooks (~120 `any`) ✅ DONE
- [x] 3A. `src/shared/hooks/useProjectGenerations.ts` — type `applyGenerationFilters` generic, `(variant: any)` and `(item: any)` in `.map()`, `(data as any).items`, `(shot: any)`, `(gen: any)` callbacks, `generationParams` return type
- [x] 3B. `src/shared/hooks/useTasks.ts` — type `mapDbTaskToTask(row: any)` with DB row type, `task.params as any`
- [x] 3C. `src/shared/hooks/segments/useSegmentOutputsForShot.ts` — type `transformToGenerationRow(gen: any)`, all `(gen as any).parent_generation_id` accesses, `(child as any).child_order`, `(v.params as any)` using 1A extended type
- [x] 3D. `src/shared/hooks/shots/useShotGenerationMutations.ts` — type `items: any[]`, `createOptimisticItem`, `sourceParams`
- [x] 3E. `src/shared/hooks/useShareGeneration.ts` — type `sanitizeTaskDataForSharing`, `redactDeep`, `taskResult`, `cachedShotData`, `(sg: any)` callbacks, `(creatorRow as any)`
- [x] 3F. `src/shared/hooks/useDemoteOrphanedVariants.ts` — type `(v: any)` and `(g: any)` callbacks (use variant type)
- [x] 3G. `src/shared/hooks/useBackgroundThumbnailGenerator.ts` — type `(oldData: any)` and `(item: any)` in setQueryData
- [x] 3H. `src/shared/hooks/useAutoSaveSettings.ts` — type `(dbSettings as any)` and `(clonedSettings as any)` accesses
- [x] 3I. `src/shared/hooks/useTimelinePositionUtils.ts` — type `(gen as any).metadata`, `.update({ metadata: ... as any })`, `setQueryData<any[]>`
- [x] 3J. `src/shared/hooks/useAdjacentPagePreloading.ts` — type `queryClient` param, `(query: any)`, `cachedData`, `allImages`
- [x] 3K. `src/shared/hooks/useUserUIState.ts` — type settings cache, `normalizeIfGenerationMethods(val: any)`, all the `as any` spread merges
- [x] 3L. `src/shared/hooks/usePersistentToolState.ts` — type `inferEmptyValue`, `setter(... as any)`, `currentState: any`
- [x] 3M. `src/shared/hooks/usePendingGenerationTasks.ts` — type `taskReferencesGeneration(params: any)`, `(task: any)` callbacks
- [x] 3N. `src/shared/hooks/usePendingSegmentTasks.ts` — type `extractPairShotGenId(params: any)`, `(task: any)` in map
- [x] 3O. `src/shared/hooks/useVariants.ts` — type `params: Record<string, any> | null`
- [x] 3P. `src/shared/hooks/useLineageChain.ts` — type `data.params as Record<string, any>`
- [x] 3Q. `src/shared/hooks/useResources.ts` — type `allData: any[]`, `(metadata as any).is_public`
- [x] 3R. `src/shared/hooks/useCredits.ts` — type `useMutation<any, ...>` generic
- [x] 3S. `src/shared/hooks/useAutoTopup.ts` — type `.from('users' as any)`, `row` data, `(data as any)?.error`
- [x] 3T. `src/shared/hooks/useTaskCost.ts` — type `(data as any).error`
- [x] 3U. `src/shared/hooks/useOnboarding.ts` — type `(userData as any).onboarding_completed`
- [x] 3V. `src/shared/hooks/useAIInteractionService.ts` — type `invokeWithTimeout<any>` calls with response types
- [x] 3W. `src/shared/hooks/useEnhancedShotImageReorder.ts` — type `shotGenerations: any[]`, `getImagesForMode` return
- [x] 3X. `src/shared/hooks/useShotImages.ts` — type `(shotGen.generation as any)?.type`, `(r as any)._optimistic`
- [x] 3Y. `src/shared/hooks/shots/useShotsCrud.ts` — type `(newShot as any).position`
- [x] 3Z. `src/shared/hooks/shots/useShotCreation.ts` — type `(projectData?.settings as any)?.upload`
- [x] 3AA. `src/shared/hooks/shots/mappers.ts` — type `mapShotGenerationToRow(sg: any)`
- [x] 3AB. `src/shared/hooks/useSourceImageChanges.ts` — type `params: Record<string, any>`, `startSlot: any`
- [x] 3AC. `src/shared/hooks/usePromoteVariantToGeneration.ts` — type `params: Record<string, any>`, `(variant.params as any)`
- [x] 3AD. `src/shared/hooks/useGalleryPageState.ts` — type `(item as any).generation_id`
- [x] 3AE. `src/shared/hooks/useHydratedReferences.ts` — type `(resource as any).userId`
- [x] 3AF. `src/shared/hooks/useVideoGalleryPreloader.ts` — type `(sg: any)` callbacks
- [x] 3AG. `src/shared/hooks/useTaskLog.ts` — type `costsData: any[]`
- [x] 3AH. `src/shared/hooks/useSmartPolling.ts` — type `diagnostics: any`

### Phase 4: Task Creation Functions (~30 `any`) ✅ DONE
- [x] 4A. `src/shared/lib/tasks/imageGeneration.ts` — define `ImageGenerationTaskResult` type, replace `Promise<any>` returns
- [x] 4B. `src/shared/lib/tasks/characterAnimate.ts` — define result type, replace `Promise<any>`
- [x] 4C. `src/shared/lib/tasks/magicEdit.ts` — define result type, replace `Promise<any>` and `Promise<any[]>`
- [x] 4D. `src/shared/lib/tasks/imageUpscale.ts` — define result type, replace `Promise<any>`
- [x] 4E. `src/shared/lib/tasks/joinClips.ts` — define result type, replace `Promise<any>`
- [x] 4F. `src/shared/lib/tasks/zImageTurboI2I.ts` — define result type, replace `Promise<any>` and `Promise<any[]>`
- [x] 4G. `src/shared/lib/tasks/travelBetweenImages.ts` — type `pair_motion_settings`, `(parsedParams as any).steps`, `task: any` in result
- [x] 4H. `src/shared/lib/tasks/individualTravelSegment.ts` — type `originalParams`, `structure_videos as any`, `orchestratorDetails`
- [x] 4I. `src/shared/lib/tasks/videoEnhance.ts` — type `task: any` in result
- [x] 4J. `src/shared/lib/taskCreation.ts` — type `validateRequiredFields` param more narrowly

### Phase 5: Shared Libraries (~50 `any`) ✅ DONE
- [x] 5A. `src/shared/lib/generationTransformers.ts` — type `params?: any`, `tasks?: any[]`, `metadata?: any`, `extractPrompt(params: any)`, `extractTaskId`, `(genData as any).derivedCount`
- [x] 5B. `src/shared/lib/generationTaskBridge.ts` — type `queryClient` param (use `QueryClient`), `taskData?: any`, `(gen as any).tasks`
- [x] 5C. `src/shared/lib/shotSettingsInheritance.ts` — type `mainSettings`, `uiSettings`, `joinSegmentsSettings` with proper settings types
- [x] 5D. `src/shared/lib/settingsWriteQueue.ts` — type `resolvers` array, `writeFunction`, `flushTarget` return
- [x] 5E. `src/shared/lib/settingsResolution.ts` — narrow `Record<string, any>` to typed settings shapes
- [x] 5F. `src/shared/lib/galleryUtils.ts` — type `extractSegmentImages(params: any)`
- [x] 5G. `src/shared/lib/imageUploader.ts` — type `lastError`, `data`/`error` variables
- [x] 5H. `src/shared/lib/imageCacheManager.ts` — type `isImageCached(urlOrImage: string | any)`, `markImageAsCached`
- [x] 5I. `src/shared/lib/debugPolling.ts` — type `queryClient` params
- [x] 5J. `src/shared/lib/dragDrop.ts` — type `const types: any`
- [x] 5K. `src/shared/utils/settingsMigration.ts` — narrow all `Record<string, any>` params using `SegmentSettings`/`ShotVideoSettings`
- [x] 5L. `src/shared/utils/taskParamsUtils.ts` — type `parseTaskParams(params: any)`, all `.filter((x: any) =>` callbacks, `(lora: any)` in map
- [x] 5M. `src/shared/utils/autoplayMonitor.ts` — type `changes: any[]`
- [x] 5N. `src/shared/components/segmentSettingsUtils.ts` — type `(pairMetadata as any)` accesses, narrow return types

### Phase 6: Lightbox System (~180 `any`) ✅ DONE
- [x] 6A. `src/shared/components/MediaLightbox/hooks/useLightboxLayoutProps.ts` — replace all ~50 `any` props with types from 1F, create proper `LightboxLayoutProps` interface
- [x] 6B. `src/shared/components/MediaLightbox/hooks/useSharedLightboxState.ts` — type `list: any[]`, `primaryVariant`, `activeVariant`, `derivedItems`, `paginatedDerived`, `quickCreateSuccess`, `data`, `toggleStarMutation`
- [x] 6C. `src/shared/components/MediaLightbox/hooks/useLightboxStateValue.ts` — type `variants: any[]`, `activeVariant`, `primaryVariant`, `swipeHandlers`
- [x] 6D. `src/shared/components/MediaLightbox/hooks/useShotPositioning.ts` — replace all `(media as any)` accesses with 1F union type
- [x] 6E. `src/shared/components/MediaLightbox/hooks/useUpscale.ts` — type `(media as any).name`, `.url`, `.variant_type`
- [x] 6F. `src/shared/components/MediaLightbox/hooks/useStarToggle.ts` — type `toggleStarMutation: any`, `(media as any).starred`, `.generation_id`
- [x] 6G. `src/shared/components/MediaLightbox/hooks/useSourceGeneration.ts` — type `(media as any).based_on`, `(data as any).shot_generations`, `.generation_variants`
- [x] 6H. `src/shared/components/MediaLightbox/hooks/useGenerationLineage.ts` — type `(media as any).based_on`
- [x] 6I. `src/shared/components/MediaLightbox/hooks/useReferences.ts` — type `useToolSettings<any>`, `(media as any).url`, `(r: any).id`
- [x] 6J. `src/shared/components/MediaLightbox/hooks/useImg2ImgMode.ts` — type `(media as any)?.params`
- [x] 6K. `src/shared/components/MediaLightbox/hooks/useLightboxVideoMode.ts` — type `activeVariant: any`
- [x] 6L. `src/shared/components/MediaLightbox/hooks/useMagicEditMode.ts` — type `brushStrokes: any[]`
- [x] 6M. `src/shared/components/MediaLightbox/hooks/useVideoRegenerateMode.ts` — type `taskParams as Record<string, any>`, `variantParamsToLoad`
- [x] 6N. `src/shared/components/MediaLightbox/hooks/useGenerationEditSettings.ts` — type `(data?.params as any)?.ui`
- [x] 6O. `src/shared/components/MediaLightbox/hooks/inpainting/useEditModePersistence.ts` — type `(data?.params as any)?.ui`
- [x] 6P. `src/shared/components/MediaLightbox/hooks/inpainting/useTaskGeneration.ts` — type `(media as any).url`
- [x] 6Q. `src/shared/components/MediaLightbox/hooks/reposition/types.ts` — type `activeVariantParams`
- [x] 6R. `src/shared/components/MediaLightbox/hooks/reposition/useRepositionVariantSave.ts` — type `transform as any`, `(media as any).shot_id`
- [x] 6S. `src/shared/components/MediaLightbox/hooks/useMakeMainVariant.ts` — type `(media as any).thumbnail_url`
- [x] 6T. `src/shared/components/MediaLightbox/components/layouts/types.ts` — replace all `any` in interface fields (topLeft/Right, bottomLeft/Right, handlers, refs)
- [x] 6U. `src/shared/components/MediaLightbox/components/*.tsx` — update all component prop types to use new interfaces from 6T
- [x] 6V. `src/shared/components/MediaLightbox/ImageLightbox.tsx` — type `useState<any>`, `(mediaObj as any)`, media dimension access
- [x] 6W. `src/shared/components/MediaLightbox/VideoLightbox.tsx` — type `useState<any>`, `(mediaObj as any)`, `(media as any)?.url`, variant filtering
- [x] 6X. `src/shared/components/MediaLightbox/MediaLightbox.tsx` — type `onApplySettings`, task/error props
- [x] 6Y. `src/shared/components/MediaLightbox/hooks/useJoinClips.ts` — type `(media as any).url`, `.thumbnail_url`
- [x] 6Z. `src/shared/components/MediaLightbox/contexts/LightboxStateContext.tsx` — type context value fields

### Phase 7: ShotImageManager System (~80 `any`) ✅ DONE
- [x] 7A. `src/shared/components/ShotImageManager/ShotImageManagerDesktop.tsx` — type `selection`, `dragAndDrop`, `lightbox`, `batchOps`, `optimistic`, `externalGens` props, all `(currentImage as any)` accesses, `(img: any)` callbacks
- [x] 7B. `src/shared/components/ShotImageManager/ShotImageManagerMobileWrapper.tsx` — same prop types as 7A, all `(currentImage as any)` accesses
- [x] 7C. `src/shared/components/ShotImageManager/ShotImageManagerMobile.tsx` — type `optimisticOrder: any[]`, `(image as any).generation_id`
- [x] 7D. `src/shared/components/ShotImageManager/ShotBatchItemDesktop.tsx` — type `image as any` for aspect ratio and derived counts
- [x] 7E. `src/shared/components/ShotImageManager/ShotBatchItemMobile.tsx` — same as 7D
- [x] 7F. `src/shared/components/ShotImageManager/ShotImageManagerContainer.tsx` — type `(img as any)` id access, `(currentSegmentMedia as any).starred`
- [x] 7G. `src/shared/components/ShotImageManager/components/ImageGrid.tsx` — type `child.params as Record<string, any>`, `(image as any).timeline_frame`, `.imageUrl`, `.thumbUrl`
- [x] 7H. `src/shared/components/ShotImageManager/hooks/useExternalGenerations.ts` — type `handleGenerationUpdate` event, `(data as any).shot_generations`, custom event listener casts
- [x] 7I. `src/shared/components/ShotImageManager/hooks/useDragAndDrop.ts` — type `(event as any)?.activatorEvent`
- [x] 7J. `src/shared/components/ShotImageManager/utils/external-generation-utils.ts` — type `buildShotAssociations(shotGenerations: any[])`, transform function
- [x] 7K. `src/shared/components/ShotImageManager/components/PairPromptIndicator.tsx` — check for any remaining `any`

### Phase 8: ShotEditor System (~90 `any`) ✅ DONE
- [x] 8A. `src/tools/travel-between-images/components/ShotEditor/services/generateVideoService.ts` — type `selectedShot: any`, `(shotGen.generation as any)`, `pairMotionSettingsArray`, `requestBody: any`
- [x] 8B. `src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts` — type all interface fields (`params`, `orchestrator`, `phaseConfig`, `details`, callbacks, `availableLoras`, `selectedShot`, `simpleFilteredImages`, mutation params)
- [x] 8C. `src/tools/travel-between-images/components/ShotEditor/hooks/useSettingsFromContext.ts` — type `phaseConfig`, `steerableMotionSettings`, `selectedLoras`, `availableLoras`, setter callbacks
- [x] 8D. `src/tools/travel-between-images/components/ShotEditor/hooks/useShotActions.ts` — type `selectedShotRef`, `addToShotMutationRef`, `shots`, `navigateToShot`, `selectedShot`, `updateGenerationsPaneSettings`
- [x] 8E. `src/tools/travel-between-images/components/ShotEditor/hooks/useImageManagement.ts` — type `selectedShotRef`, `updateShotImageOrderMutation`, `actionsRef`, `(img as any)`, `(error: any)` in onError
- [x] 8F. `src/tools/travel-between-images/components/ShotEditor/hooks/useApplySettingsHandler.ts` — type `metadata: any`, `loraManager`, `addImageToShotMutation`, `removeImageFromShotMutation`, `(row as any)?.generation`
- [x] 8G. `src/tools/travel-between-images/components/ShotEditor/hooks/useGenerateBatch.ts` — type the 3 `[key: string]: any` interfaces, `selectedShot`, `onShotImagesUpdate`, `joinPhaseConfig`
- [x] 8H. `src/tools/travel-between-images/components/ShotEditor/hooks/useJoinSegmentsSetup.ts` — type `phaseConfig`, `updateField`, `handleAddLora`, `joinPhaseConfig`
- [x] 8I. `src/tools/travel-between-images/components/ShotEditor/hooks/useJoinSegmentsHandler.ts` — type `phaseConfig`, `updateField`, `updateFields`, `(slot.child as any)?.location`
- [x] 8J. `src/tools/travel-between-images/components/ShotEditor/hooks/useShotSettingsValue.ts` — type `queryClient: any`
- [x] 8K. `src/tools/travel-between-images/components/ShotEditor/hooks/useSteerableMotionHandlers.ts` — type `updateShotUISettings`, `setSteerableMotionSettings`
- [x] 8L. `src/tools/travel-between-images/components/ShotEditor/hooks/useShotEditorSetup.ts` — type `v.params as any`
- [x] 8M. `src/tools/travel-between-images/components/ShotEditor/hooks/useGenerationActions.ts` — type `(originalImage as any).timeline_frame`, `(img as any).timeline_frame` comparisons
- [x] 8N. `src/tools/travel-between-images/components/ShotEditor/state/types.ts` — type `phaseConfig`, `pairConfigs`, `optimisticShotData`
- [x] 8O. `src/tools/travel-between-images/components/ShotEditor/ShotSettingsContext.tsx` — type context `settings`, `updateField`, `updateFields`, `queryClient`
- [x] 8P. `src/tools/travel-between-images/components/ShotEditor/index.tsx` — type `(shotGen.generation as any)?.type`, `.created_at`, `.location`, `(seg as any)` accesses, `{} as any`
- [x] 8Q. `src/tools/travel-between-images/components/ShotEditor/ui/Header.tsx` — type `(oldData: any)` in setQueryData, `(currentShot?.settings as any)`
- [x] 8R. `src/tools/travel-between-images/components/ShotEditor/sections/ModalsSection.tsx` — type `} as any` cast

### Phase 9: Timeline & Video Gallery (~70 `any`) ✅ DONE
- [x] 9A. `src/tools/travel-between-images/components/Timeline.tsx` — type `} as any`, `shotGen as any as RawShotGeneration` double assertion, `(img: any)` find callbacks, `onAddToShot(... as any)`, `(currentLightboxImage as any)` accesses
- [x] 9B. `src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx` — type `child.params as Record<string, any>`, `getPairShotGenIdFromParams`, `(oldData: any)` in setQueryData, `(slot as any).isTrailingSegment`, `(parentVideoRow as any).starred`
- [x] 9C. `src/tools/travel-between-images/components/Timeline/TimelineItem.tsx` — type `(image as any).metadata`, `.timeline_frame`, `.derivedCount`, `.unviewedVariantCount`, `.hasUnviewedVariants`
- [x] 9D. `src/tools/travel-between-images/components/Timeline/SegmentSettingsModal.tsx` — type `initialParams`, `(old: any)` in setQueryData, `(current?.metadata as Record<string, any>)`
- [x] 9E. `src/tools/travel-between-images/components/Timeline/TimelineContainer/TimelineContainer.tsx` — type `undefined as any` (onTrailingEndFrameChange)
- [x] 9F. `src/tools/travel-between-images/components/Timeline/hooks/useTimelinePositions.ts` — type `metadata?: Record<string, any>`, `(img as any)._optimistic`
- [x] 9G. `src/tools/travel-between-images/components/Timeline/hooks/useTimelineOrchestrator.ts` — type `(current?.metadata as Record<string, any>)`
- [x] 9H. `src/tools/travel-between-images/components/Timeline/hooks/usePositionManagement.ts` — type `metadata?: any`, `significantChanges`, `filteredOut`, `allChanges` arrays
- [x] 9I. `src/tools/travel-between-images/components/Timeline/utils/timeline-debug.ts` — type debug log interfaces
- [x] 9J. `src/tools/travel-between-images/components/VideoGallery/index.tsx` — type `(video as any).url`, `(video: any)` in findIndex
- [x] 9K. `src/tools/travel-between-images/components/VideoGallery/components/VideoItem.tsx` — type `gen.params as any`, `(gen as any).child_order`, `(child as any).child_order`, `sanitizeTaskDataForSharing`, `.from('shared_generations' as any)`, `(creatorRow as any)`, `(e as any).nativeEvent`, `(video as any).derivedCount`
- [x] 9L. `src/tools/travel-between-images/components/VideoGallery/utils/video-loading-utils.ts` — type `transformUnifiedGenerationsData(items: any[])`, `(item: any)` in map
- [x] 9M. `src/tools/travel-between-images/components/VideoGallery/components/VideoHoverPreview.tsx` — type `hoverTaskMapping`, `hoverTask`

### Phase 10: MediaGallery & Gallery Components (~40 `any`) ✅ DONE
- [x] 10A. `src/shared/components/MediaGallery/components/MediaGalleryLightbox.tsx` — type `onApplySettings`, `task`, `taskError`, `lightboxTaskMapping`, `(data as any)` accesses in enrichment, `(sg: any)` callbacks
- [x] 10B. `src/shared/components/MediaGallery/hooks/useMediaGalleryStateOptimized.ts` — type `(updatedImage as any).name`, `(state.activeLightboxMedia as any).name`
- [x] 10C. `src/shared/components/MediaGallery/hooks/useMediaGalleryFiltersOptimized.ts` — type `(image.metadata as any)?.originalParams`
- [x] 10D. `src/shared/components/MediaGallery/types.ts` — narrow `DisplayableMetadata extends Record<string, any>`
- [x] 10E. `src/shared/components/MediaGallery/utils/mediaGallery-utils.ts` — type `deriveInputImages(task: any)`, `(metadata as any).originalParams` accesses
- [x] 10F. `src/shared/components/MediaGallery/components/MediaGalleryGrid.tsx` — type `[key: string]: any` pass-through props
- [x] 10G. `src/shared/components/MediaGallery/index.tsx` — type `(stateHook.state.activeLightboxMedia as any)?.generation_id`, destructuring cast
- [x] 10H. `src/shared/components/MediaGalleryItem.tsx` — type `(image.metadata as any)?.taskId`, `.tool_type`, `.originalParams`, `(e as any).nativeEvent`, `(image as any).name`

### Phase 11: TasksPane System (~45 `any`) ✅ DONE
- [x] 11A. `src/shared/components/TasksPane/hooks/useImageGeneration.ts` — type `taskParams`, `(actualGeneration as any)` accesses (based_on, shot_generations, created_at, thumbnail_url, etc.)
- [x] 11B. `src/shared/components/TasksPane/hooks/useVideoGenerations.ts` — type `taskParams`, `(childGen as any).generation_variants`, `(v: any)` callbacks, `(task as any).created_at`, `gen as any`
- [x] 11C. `src/shared/components/TasksPane/hooks/useTasksLightbox.ts` — type all `(data as any)` accesses for generation enrichment, `(sg: any)` callbacks
- [x] 11D. `src/shared/components/TasksPane/hooks/useTaskContentType.ts` — type `taskParams`, `task.taskType as any`
- [x] 11E. `src/shared/components/TasksPane/utils/task-utils.ts` — type `task.params as Record<string, any>`, `parseTaskParamsForDisplay`, `extractSourceGenerationId`, `extractTaskParentGenerationId`
- [x] 11F. `src/shared/components/TasksPane/TaskItem.tsx` — type `(task as any).created_at`, `(videoOutputs[0] as any)?._variant_id`, `(oldData: any)` in setQueryData, `(generationData as any)?._variant_id`, `task.taskType as any`
- [x] 11G. `src/shared/components/TasksPane/TasksPane.tsx` — type `(paginatedData as any)?.total`, `(oldData: any)` in setQueryData, `paginatedData as any`
- [x] 11H. `src/shared/components/TasksPane/TaskList.tsx` — type `(t as any).created_at`
- [x] 11I. `src/shared/components/TasksPane/components/TaskItemTooltip.tsx` — type `(videoOutputs[0] as any)?._variant_id`, `(generationData as any)?._variant_id`
- [x] 11J. `src/shared/components/TasksPane/components/TaskItemActions.tsx` — type `task.taskType as any`

### Phase 12: Tool Pages (~50 `any`) ✅ DONE
- [x] 12A. `src/tools/edit-images/pages/EditImagesPage.tsx` — type `(data as any)` accesses, `transformVariantToGeneration(media: any)`, `handleResultClick(media: any)`, `(resultsData as any)?.items`, `(generationsData as any)`
- [x] 12B. `src/tools/edit-video/pages/EditVideoPage.tsx` — type same patterns as 12A
- [x] 12C. `src/tools/image-generation/pages/ImageGenerationToolPage.tsx` — type `(window as any).__PROJECT_CONTEXT__`, `invokeWithTimeout<any>`, `(t: any) => t.id`
- [x] 12D. `src/tools/travel-between-images/pages/ShotListView.tsx` — type `(image as any).params`, `vd: any`
- [x] 12E. `src/tools/travel-between-images/pages/ShotEditorView.tsx` — type `availableLoras: any[]`
- [x] 12F. `src/tools/travel-between-images/components/ShotImagesEditor.tsx` — type `(beforeData.params as any)`, `(child.params as any)`, `(oldData: any)` in setQueryData, `undefined as any`, `} as any`
- [x] 12G. `src/tools/travel-between-images/components/ShotImagesEditor/components/TimelineModeContent.tsx` — type `images: any[]`, `memoizedShotGenerations: any[]`, `allShots: any[]`, `segmentSlots: any[]`
- [x] 12H. `src/tools/travel-between-images/components/ShotImagesEditor/components/BatchModeContent.tsx` — same array types
- [x] 12I. `src/tools/travel-between-images/components/ShotImagesEditor/hooks/*` — type across all sub-hooks
- [x] 12J. `src/tools/travel-between-images/components/VideoGenerationModal.tsx` — type `(firstImage as any).metadata`, lora mapping
- [x] 12K. `src/tools/travel-between-images/components/SharedGenerationView.tsx` — type `generation: any`, `(img as any).parent_generation_id`, `.child_order`
- [x] 12L. `src/tools/travel-between-images/components/FinalVideoSection.tsx` — type `parentGenerations: any[]`, `(task as any)`, `(parent as any).createdAt`
- [x] 12M. `src/tools/travel-between-images/components/VideoTravelVideosGallery.tsx` — type `videosData: any`, `vd: any`
- [x] 12N. `src/tools/travel-between-images/components/MotionControl.tsx` — type `preset: any`, `allPresets.map((preset: any) =>`, `(gen: any)` callbacks
- [x] 12O. `src/tools/travel-between-images/components/ShotListDisplay.tsx` — type `handleDragStart(event: any)`, `handleDragMove(event: any)`
- [x] 12P. `src/tools/travel-between-images/utils/shareDataTransformers.ts` — type function params more narrowly
- [x] 12Q. `src/tools/training-data-helper/hooks/useTrainingData.ts` — type all `metadata: any` fields (6 occurrences)
- [x] 12R. `src/tools/join-clips/components/JoinClipsSettingsForm.tsx` — type `presetMetadata?: any` callback

### Phase 13: Remaining Components (~30 `any`) ✅ DONE
- [x] 13A. `src/shared/components/GenerationDetails/index.tsx` — type `task?: any`, `availableLoras?: any[]`
- [x] 13B. `src/shared/components/GenerationDetails/useGenerationDetails.ts` — type `task?: Task | any`
- [x] 13C. `src/shared/components/TaskDetailsPanel.tsx` — type `error: any`
- [x] 13D. `src/shared/components/TaskDetailsModal.tsx` — type `(task as any)?.params`
- [x] 13E. `src/shared/components/TaskDetails/VideoTravelDetails.tsx` — type `(phase: any)` callbacks, `(lora: any)` callbacks
- [x] 13F. `src/shared/components/TaskDetails/JoinClipsDetails.tsx` — type `(clip: any)`, `(settings: any)` callbacks
- [x] 13G. `src/shared/components/VariantSelector/index.tsx` — type `variant.params as any`, `(variant.params as any)?.source_variant_id`
- [x] 13H. `src/shared/components/SegmentSettingsForm/SegmentSettingsForm.tsx` — type `(lora as any).id`, `.name`, `handleSaveFieldAsDefault`
- [x] 13I. `src/shared/components/PhaseConfigSelectorModal/components/AddNewPresetTab.tsx` — type `handleFormChange`, `presetMetadata as any`
- [x] 13J. `src/shared/components/PhaseConfigSelectorModal/components/sections/PhaseConfigSection.tsx` — type `(lora as any).huggingface_url`
- [x] 13K. `src/shared/components/PhaseConfigVertical.tsx` — type callback, `(lora as any).huggingface_url`
- [x] 13L. `src/shared/components/LoraSelectorModal/components/MyLorasTab.tsx` — type `handleFormChange`, `loraMetadata as any`, `editingLora: any`, `(sample: any)` callbacks
- [x] 13M. `src/shared/components/ActiveLoRAsDisplay.tsx` — type `availableLoras?: any[]`
- [x] 13N. `src/shared/components/ProgressiveLoadingManager.tsx` — type `images: any[]`
- [x] 13O. `src/shared/components/ImagePreloadManager.tsx` — type `allImages?: any[]`
- [x] 13P. `src/shared/components/InlineSegmentVideo.tsx` — type `(slot.child as any).created_at`
- [x] 13Q. `src/tools/edit-images/components/InlineEditView.tsx` — type `media as any` accesses
- [x] 13R. `src/tools/edit-video/components/InlineEditVideoView.tsx` — type `(media as any).url`, `.thumbnail_url`
- [x] 13S. `src/shared/contexts/ProjectContext.tsx` — type `initialSettings?: any`, `mapDbProjectToProject(row: any)`, `catch (error: any)` (×4), `dbUpdates: any`, `filteredToolSettings as any`, `(settingsToInherit as any)`
- [x] 13T. `src/shared/contexts/UserSettingsContext.tsx` — type `(data?.settings as any)`
- [x] 13U. `src/shared/contexts/GenerationTaskContext.tsx` — type `taskData?: any` in return
- [x] 13V. `src/shared/hooks/useLoraManager.tsx` — type `handleAddLora(lora: any)`, `availableLoras: any[]`
- [x] 13W. `src/shared/hooks/useRenderLogger.ts` — type `propsSnapshot?: any`
- [x] 13X. `src/shared/hooks/useModal.ts` — type `style: Record<string, any>`, `props: Record<string, any>`
- [x] 13Y. `src/shared/hooks/useContentResponsive.ts` — type `(panes as any).contentBreakpoints`
- [x] 13Z. `src/shared/hooks/useProjectGenerationModesCache.ts` — type `(shot: any)` callback
- [x] 13AA. `src/shared/hooks/useProjectVideoCountsCache.ts` — narrow if needed
- [x] 13AB. `src/shared/hooks/useShotGenerationMetadata.ts` — type `[key: string]: any`
- [x] 13AC. `src/tools/travel-between-images/hooks/useVideoTravelSettingsHandlers.ts` — type `presetMetadata?: any`, `(loras: any[])`, `updates: Record<string, any>`
- [x] 13AD. `src/tools/travel-between-images/hooks/useVideoTravelDropHandlers.ts` — type `metadata?: any`, `Promise<any>` returns
- [x] 13AE. `src/tools/travel-between-images/hooks/useVideoTravelAddToShot.ts` — type `Promise<any>` returns
- [x] 13AF. `src/tools/travel-between-images/hooks/useShotSettings.ts` — type `(data?.settings as any)` accesses
- [x] 13AG. `src/tools/training-data-helper/components/BatchSelector.tsx` — type `(blob as any).fileExtension`

### Phase 14: Misc & Debug (LOW PRIORITY — skip or do last)
- [ ] 14A. `src/shared/hooks/useQueryDebugLogging.ts` — type all debug config callbacks (low value, debug-only)
- [ ] 14B. `src/shared/hooks/shots/debug.ts` — type debug interfaces
- [ ] 14C. `src/shared/components/ShotImageManager/utils/selection-debug.ts` — type `logSelectionEvent`
- [ ] 14D. `src/shared/components/debug/RefactorMetricsCollector.tsx` — type window attachment
- [ ] 14E. Test files (`__tests__/*.ts`) — skip, test `any` is acceptable

---

## DO NOT TOUCH (Necessary `any`)

These are legitimately necessary and should be left alone:

### Browser API gaps (no TS types exist)
- `(navigator as any).connection?.effectiveType` — Network Information API not in TS lib
- `(navigator as any).maxTouchPoints`, `.platform`, `.userAgent` — available but typed differently across libs
- `(navigator as any).standalone` — iOS Safari PWA detection
- `(navigator as any).getInstalledRelatedApps()` — Chrome PWA API
- `(navigator as any).deviceMemory` — Device Memory API
- `(performance as any).memory` — Chrome-specific memory API
- `(import.meta as any)?.env` — Vite env typing (use `ImportMetaEnv` augmentation if desired but not required)

### Window debug attachments (dev-only instrumentation)
- `(window as any).__RECONNECT_SCHEDULER__`
- `(window as any).__REALTIME_SNAPSHOT__`
- `(window as any).__VISIBILITY_MANAGER__`
- `(window as any).__NETWORK_STATUS_MANAGER__`
- `(window as any).__DATA_FRESHNESS_MANAGER__`
- ~~`(window as any).__PROJECT_CONTEXT__`~~ — FIXED: typed in `browser-extensions.d.ts`, now uses `window.__PROJECT_CONTEXT__`
- ~~`(window as any).__AUTH_MANAGER__`~~ — FIXED: typed in `browser-extensions.d.ts`, now uses `window.__AUTH_MANAGER__`
- `(window as any).__projectDebugLog`
- `(window as any).__REFACTOR_METRICS`
- `(window as any).debugConfig`
- `(window as any).debugPolling`
- `(window as any).validateImageCache` and related cache debug functions
- `(window as any).checkNetworkStatus`, `.simulateNetworkChange`
- `(document.querySelector('#root') as any)?._reactInternalFiber` / `_reactInternals`

### Supabase auth types (fixed)
- ~~`AuthStateManager.ts:30` — `session: any`~~ — FIXED: now `Session | null`
- ~~`AuthStateManager.ts:71` — `(event: any, session: any)`~~ — FIXED: inferred from `onAuthStateChange`

### Supabase internal instrumentation
- `(window as any).WebSocket = function(...)` — WebSocket monkey-patching for realtime debugging
- `(window as any).__SUPABASE_WEBSOCKET_INSTANCES__` — tracking WS instances
- `(console as any).__WARN_INTERCEPTED__` — console.warn interception for Supabase noise
- `_socket = value as any` / `_transport = value as any` — Supabase realtime internal property traps
- `(supabase as any)?.realtime?.socket` — accessing internal Supabase realtime state

### Generic utility functions (truly polymorphic)
- `log(tag: string, ...args: any[])` — logger must accept anything
- `reactProfilerOnRender(...rawArgs: any[])` — React Profiler callback signature
- `safeStringify(obj: any)` — must stringify anything
- `withErrorHandling<T extends (...args: any[]) => Promise<any>>` — generic wrapper
- `useStableCallback<T extends (...args: any[]) => any>` — generic callback stabilizer
- `QueryKeyOf<T> = T extends (...args: any[]) => infer R` — type extraction utility
- `addCorruptionEvent(event: string, data: any = {})` — corruption timeline logging

### Tests
- All `any` usage in `__tests__/` files — test mocking legitimately needs `any`

---

## Execution Strategy

### Ordering rationale
Phases 1 → 2-5 → 6-13 → 14. Foundation types must exist before consumers can use them. Within each phase, items are independent and can be done in any order.

### Per-file approach
1. Read the file to understand context
2. Identify which foundation type(s) from Phase 1 apply
3. Replace `any` with the proper type
4. If no existing type fits, check if a type from Phase 1 needs extending — extend it rather than creating a new one
5. Run `npx tsc --noEmit` on the file to verify
6. Never change runtime behavior — only type annotations

### Rules
- **Don't create interfaces for one-time use** — if a type is only used in one place and is simple, inline it
- **Use `unknown` for catch blocks** — with proper narrowing (`if (error instanceof Error)`)
- **Use `QueryClient` from `@tanstack/react-query`** — not `any` for queryClient params
- **Prefer extending existing types** (e.g., add `parent_generation_id` to `GenerationRow`) over creating parallel types
- **`Record<string, any>` for truly dynamic JSON** is acceptable at system boundaries (Supabase `.params` columns, user settings) — but narrow as much as possible within the app
- **Don't break working code** — if typing something properly would require a large refactor beyond the scope, add a `// TODO: type properly when X is refactored` comment and use a narrower type than `any` (e.g., `Record<string, unknown>`)
