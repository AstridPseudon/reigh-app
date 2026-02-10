# Cruft Cleanup Report — 2026-02-10

Scope: `src`

Instructions: Work through each section. Check off items as you complete them. 
For each item, verify the fix doesn't break anything before moving on.

## Summary

| Category | Count |
|----------|-------|
| Tagged logs | 2292 |
| Unused declarations | 729 |
| Dead exports | 343 |
| Stale deprecated | 47 |
| Large files (>300 LOC) | 205 |
| Complexity signals | 77 |
| God components | 59 |
| Mixed concerns | 47 |
| Bloated prop interfaces | 139 |
| Single-use abstractions | 321 |

---
## 1. Tagged Console Logs (quick wins)

Remove debug logging left behind. These are tagged `console.log('[Tag] ...')` calls.
Safe to remove — they're dev-only debug output.

- [ ] **`src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts`** — 70 logs (tags: ApplySettings)
  - Line 131: `console.log('[ApplySettings] Fetching task:', taskId.substring(0, 8));`
  - Line 145: `console.log('[ApplySettings] ✅ Task fetched successfully');`
  - Line 249: `console.log('[ApplySettings] 📋 Extracted settings:', {`
  - Line 267: `console.log('[ApplySettings] ⏭️  Skipping model (no change or undefined)');`
  - Line 271: `console.log('[ApplySettings] 🎨 Applying model:', {`
  - Line 287: `console.log('[ApplySettings] 💬 Applying main prompt');`
  - Line 293: `console.log('[ApplySettings] 📝 Applying', settings.prompts.length, 'individual p...`
  - Line 318: `console.log('[ApplySettings] 🚫 Applying negative prompt:', {`
  - ... and 62 more
- [ ] **`src/shared/components/PromptEditorModal.tsx`** — 49 logs (tags: EDIT_DEBUG:BULK_EDIT_CHANGE, EDIT_DEBUG:GENERATION_CHANGE, EDIT_DEBUG:MEMO, EDIT_DEBUG:RENDER, EDIT_DEBUG:RENDER_CAUSE)
  - Line 52: `console.log(`[EDIT_DEBUG:RENDER] PromptEditorModal rendered.`, {`
  - Line 63: `console.log('[PromptEditResetTrace] Modal MOUNT');`
  - Line 64: `return () => console.log('[PromptEditResetTrace] Modal UNMOUNT');`
  - Line 76: `console.log(`[PromptEditorModal:STATE_CHANGE] internalPrompts changed. Count: ${...`
  - Line 83: `console.log(`[EDIT_DEBUG:STATE] activeTab changed to: ${activeTab}`);`
  - Line 88: `console.log(`[EDIT_DEBUG:RENDER_CAUSE] Component re-rendered`);`
  - Line 115: `console.log(`[PromptEditorModal:MOBILE_STYLING_DEBUG] useExtraLargeModal result:...`
  - Line 155: `console.log('[PromptEditResetTrace] scroll', { y });`
  - ... and 41 more
- [ ] **`src/tools/travel-between-images/components/ShotEditor/hooks/useApplySettingsHandler.ts`** — 38 logs (tags: ApplySettings)
  - Line 97: `console.log('[ApplySettings] 🎬 Starting apply settings from task');`
  - Line 106: `console.warn('[ApplySettings] ⚠️  Some images missing shotImageEntryId (Phase 2 ...`
  - Line 111: `console.log('[ApplySettings] Context check:', {`
  - Line 139: `console.log('[ApplySettings] fetchTask returned:', { hasData: !!taskData, dataTy...`
  - Line 149: `console.log('[ApplySettings] ✅ Task data fetched successfully');`
  - Line 153: `console.log('[ApplySettings] ✅ Settings extracted:', Object.keys(settings));`
  - Line 156: `console.log('[ApplySettings] Building apply context...');`
  - Line 197: `console.log('[ApplySettings] ✅ Apply context built');`
  - ... and 30 more
- [ ] **`src/shared/contexts/ProjectContext.tsx`** — 34 logs (tags: Onboarding, ProjectContext, ProjectContext:CrossDeviceSync, ProjectContext:FastResume, ProjectContext:MobileDebug)
  - Line 45: `console.log('[Onboarding] Copying template content via RPC...');`
  - Line 54: `console.warn('[Onboarding] Template copy failed:', error.message);`
  - Line 58: `console.log('[Onboarding] Template content copied successfully');`
  - Line 153: `console.info('[ProjectContext:FastResume] 🚨 ProjectProvider MOUNTED', {`
  - Line 160: `console.info('[ProjectContext:FastResume] 🚨 ProjectProvider UNMOUNTING', {`
  - Line 176: `console.log('[ProjectContext:FastResume] ATTEMPTING localStorage restoration');`
  - Line 179: `console.log(`[ProjectContext:FastResume] localStorage result: ${stored}`);`
  - Line 181: `console.log(`[ProjectContext:FastResume] Restored selectedProjectId from localSt...`
  - ... and 26 more
- [ ] **`src/shared/hooks/segments/useSegmentOutputsForShot.ts`** — 34 logs (tags: BatchModeSelection, DemoteOrphaned, PairSlot, ParentAutoSelect, PreloadedDebug)
  - Line 169: `console.log('[TrailingDebug] 🎯 Hook called with trailingShotGenId:', trailingSho...`
  - Line 174: `console.log('[PairSlot] 📍 LOCAL POSITIONS received:',`
  - Line 194: `console.log('[BatchModeSelection] useSegmentOutputsForShot state:', {`
  - Line 218: `console.log('[PreloadedDebug] All preloaded generations:', preloadedGenerations....`
  - Line 247: `console.log('[PreloadedDebug] Found parent generations (sorted by most recent):'...`
  - Line 268: `console.log('[useSegmentOutputsForShot] Fetching parent generations for shot:', ...`
  - Line 284: `console.log('[useSegmentOutputsForShot] Found parent generations:', data?.length...`
  - Line 309: `console.log('[ParentAutoSelect] Auto-selecting most recent parent:', {`
  - ... and 26 more
- [ ] **`src/pages/Home/HomePage.tsx`** — 34 logs (tags: AuthDebug, EcosystemTooltip, Referral, VideoAutoplay, VideoDebug)
  - Line 157: `console.log('[VideoAutoplay] Autoplay success');`
  - Line 159: `console.log('[VideoAutoplay] Autoplay blocked, waiting for interaction');`
  - Line 165: `console.log('[VideoAutoplay] Interaction play failed:', err);`
  - Line 191: `console.log('[VideoPreload] Video A loaded, starting Video B preload');`
  - Line 197: `console.log('[VideoPreload] Video B ready to play');`
  - Line 223: `console.log('[AuthDebug] OAuth tokens detected in URL hash, processing...');`
  - Line 230: `console.log('[AuthDebug] Parsed tokens - access_token exists:', !!accessToken, '...`
  - Line 249: `console.log('[AuthDebug] Successfully set session from hash tokens');`
  - ... and 26 more
- [ ] **`src/shared/components/MediaLightbox/components/ShotSelectorControls.tsx`** — 33 logs (tags: AddWithoutPosDebug, VariantToShot)
  - Line 103: `console.log('[AddWithoutPosDebug] 1️⃣ handleAddWithoutPosition CALLED');`
  - Line 104: `console.log('[AddWithoutPosDebug] selectedShotId:', selectedShotId);`
  - Line 105: `console.log('[AddWithoutPosDebug] mediaId:', mediaId);`
  - Line 106: `console.log('[AddWithoutPosDebug] hasOnAddToShotWithoutPosition:', !!onAddToShot...`
  - Line 109: `console.log('[AddWithoutPosDebug] ❌ No selectedShotId, returning early');`
  - Line 116: `console.log('[AddWithoutPosDebug] 2️⃣ State check:');`
  - Line 117: `console.log('[AddWithoutPosDebug] isAlreadyAssociatedWithoutPosition:', isAlread...`
  - Line 118: `console.log('[AddWithoutPosDebug] showTickForSecondaryImageId:', showTickForSeco...`
  - ... and 25 more
- [ ] **`src/shared/components/MediaGallery/components/MediaGalleryLightbox.tsx`** — 33 logs (tags: DerivedNav:Gallery, EditModeDebug, MediaGalleryLightbox, ShotNavDebug, ShotSelectorDebug)
  - Line 134: `console.log('[EditModeDebug] MediaGalleryLightbox computing effective autoEnterE...`
  - Line 150: `console.log('[ShotNavDebug] [MediaGalleryLightbox] props snapshot', {`
  - Line 194: `console.log('[StarDebug:MediaGallery] MediaLightbox starred prop', {`
  - Line 248: `console.log('[StarPersist] 📡 Cache updated, forcing enhancedMedia recompute');`
  - Line 271: `console.log('[StarPersist] 📦 Found values in React Query cache:', {`
  - Line 284: `console.log('[StarPersist] 🎨 Enhanced media created:', {`
  - Line 305: `console.log('[ShotNavDebug] [MediaGalleryLightbox] sourceRecord lookup', {`
  - Line 323: `console.log('[ShotNavDebug] [MediaGalleryLightbox] positionedInSelectedShot: ear...`
  - ... and 25 more
- [ ] **`src/shared/components/ShotImageManager/hooks/useExternalGenerations.ts`** — 33 logs (tags: BasedOnLineage, BasedOnNav, ShotImageManager)
  - Line 48: `console.log('[BasedOnLineage] 🔄 Generation update batch received:', {`
  - Line 62: `console.log('[BasedOnLineage] ✅ Upscale completed for external/temp generation, ...`
  - Line 109: `console.warn('[ShotImageManager] Cannot add to shot - missing selected shot or p...`
  - Line 130: `console.warn('[ShotImageManager] Cannot add to shot without position');`
  - Line 154: `console.log('[BasedOnNav] 🌐 handleOpenExternalGeneration START:', {`
  - Line 168: `console.log('[BasedOnNav] 📊 Current array state:', {`
  - Line 177: `console.log('[BasedOnNav] ✅ Found in BASE images at index', existingIndex);`
  - Line 180: `console.log('[BasedOnNav] 🔄 Setting derived nav context (entering derived mode)'...`
  - ... and 25 more
- [ ] **`src/shared/components/MediaGallery/index.tsx`** — 32 logs (tags: BackfillV2, BasedOnDebug, CrossPageNav, MediaGallery, MobileDebug)
  - Line 149: `console.log('[VideoSkeletonDebug] MediaGallery props:', {`
  - Line 182: `console.log('[MobileDebug] Mobile detection changed:', { isMobile });`
  - Line 197: `console.log('[MobileDebug] Debug info:', debugInfo);`
  - Line 224: `console.log('[VideoLayoutFix] MediaGallery computing layout:', {`
  - Line 305: `console.log('[BackfillV2] Navigating to new last page:', newLastPage);`
  - Line 419: `console.log('[VisitShotDebug] 6. MediaGallery handleNavigateToShot called', {`
  - Line 427: `console.log('[VisitShotDebug] 7. MediaGallery calling navigateToShot');`
  - Line 429: `console.log('[VisitShotDebug] 8. MediaGallery navigateToShot completed, now clos...`
  - ... and 24 more
- [ ] **`src/tools/travel-between-images/components/ShotEditor/hooks/useGenerationActions.ts`** — 31 logs (tags: BATCH_DELETE, BatchDrop, DUPLICATE, DUPLICATE:useGenerationActions, DUPLICATE_DEBUG)
  - Line 129: `console.log('[DeleteDebug] 🗑️ STEP 1: handleDeleteImageFromShot called', {`
  - Line 149: `console.warn('[DeleteDebug] ⚠️ Attempted to delete optimistic item, ignoring', {`
  - Line 165: `console.log('[DeleteDebug] 🔍 STEP 2: Looking up generation ID', {`
  - Line 215: `console.log('[DeleteDebug] 📐 Deleting first item - will shift remaining items', ...`
  - Line 224: `console.log('[DeleteDebug] 📤 STEP 3: Calling removeImageFromShotMutation', {`
  - Line 260: `console.log('[DemoteOrphaned] 🎯 Triggering from handleDeleteImageFromShot', {`
  - Line 281: `console.log('[BATCH_DELETE] Removing multiple images from timeline', {`
  - Line 300: `console.log('[BATCH_DELETE] Batch removal completed successfully');`
  - ... and 23 more
- [ ] **`src/tools/travel-between-images/components/ShotEditor/hooks/timelineDropHelpers.ts`** — 27 logs (tags: AddImagesDebug, ImageCrop)
  - Line 83: `console.log('[ImageCrop] No aspect ratio found, skipping crop');`
  - Line 90: `console.warn('[ImageCrop] Invalid aspect ratio:', aspectRatioStr);`
  - Line 94: `console.log('[ImageCrop] Cropping images to aspect ratio:', aspectRatioStr);`
  - Line 123: `console.log('[AddImagesDebug] 🔍 Querying database for existing positions...');`
  - Line 141: `console.log('[AddImagesDebug] 📊 Database query result:', {`
  - Line 161: `console.log('[AddImagesDebug] 🆕 No shot generations data, starting at 0');`
  - Line 170: `console.log('[AddImagesDebug] 🔍 After filtering videos:', {`
  - Line 181: `console.log('[AddImagesDebug] 📍 Valid timeline_frame positions:', {`
  - ... and 19 more
- [ ] **`src/shared/lib/tasks/individualTravelSegment.ts`** — 27 logs (tags: IndividualTravelSegment, TrailingGen)
  - Line 142: `console.log(`[IndividualTravelSegment] Generated random seed: ${finalSeed}`);`
  - Line 154: `console.log('[IndividualTravelSegment] Using provided loras:', params.loras.leng...`
  - Line 157: `console.log('[IndividualTravelSegment] Using original additional_loras');`
  - Line 160: `console.log('[IndividualTravelSegment] Using orchestrator_details additional_lor...`
  - Line 223: `console.log('[IndividualTravelSegment] Model selection:', {`
  - Line 260: `console.log('[IndividualTravelSegment] [SegmentPromptDebug] Prompt resolution:',...`
  - Line 339: `console.log('[IndividualTravelSegment] Built structure_guidance from UI params.s...`
  - Line 381: `console.log('[IndividualTravelSegment] Converted legacy structure_videos to unif...`
  - ... and 19 more
- [ ] **`src/shared/hooks/useProgressiveImage.ts`** — 26 logs (tags: ThumbToFullTransition)
  - Line 72: `console.log(`[ThumbToFullTransition] ⚠️ Canceling session:`, {`
  - Line 194: `console.log('[ThumbToFullTransition] Skipping load:', {`
  - Line 204: `console.log('[ThumbToFullTransition] 🚀 Starting progressive load:', {`
  - Line 223: `console.log('[ThumbToFullTransition] URL analysis:', {`
  - Line 231: `console.log('[ThumbToFullTransition] No URLs available, staying idle');`
  - Line 238: `console.log('[ThumbToFullTransition] Created session:', session.id);`
  - Line 242: `console.log('[ThumbToFullTransition] No thumbnail, loading full image directly')...`
  - Line 251: `console.log('[ThumbToFullTransition] ✅ Full image loaded directly');`
  - ... and 18 more
- [ ] **`src/tools/edit-images/components/InlineEditView.tsx`** — 25 logs (tags: EDIT_DEBUG)
  - Line 249: `console.log('[EDIT_DEBUG] ██████████████████████████████████████████████████████...`
  - Line 250: `console.log('[EDIT_DEBUG] 🎨 InlineEditView BEFORE useImg2ImgMode:');`
  - Line 251: `console.log('[EDIT_DEBUG] 🎨 persistedImg2imgStrength:', persistedImg2imgStrength...`
  - Line 252: `console.log('[EDIT_DEBUG] 🎨 persistedImg2imgEnablePromptExpansion:', persistedIm...`
  - Line 253: `console.log('[EDIT_DEBUG] 🎨 editSettingsPersistence.isLoading:', editSettingsPer...`
  - Line 254: `console.log('[EDIT_DEBUG] 🎨 editSettingsPersistence.hasPersistedSettings:', edit...`
  - Line 255: `console.log('[EDIT_DEBUG] ██████████████████████████████████████████████████████...`
  - Line 290: `console.log('[EDIT_DEBUG] ██████████████████████████████████████████████████████...`
  - ... and 17 more
- [ ] **`src/shared/hooks/gallery/useGalleryFilterState.ts`** — 25 logs (tags: SkeletonCountDebug, StableFilter)
  - Line 130: `console.log('[StableFilter] Hook mounted, initial state:', {`
  - Line 137: `console.log('[StableFilter] Hook unmounted');`
  - Line 179: `console.log('[StableFilter] Set filter state:', {`
  - Line 197: `console.log('[StableFilter] Already have user override in map, skipping settings...`
  - Line 203: `console.log('[StableFilter] Populating map from persisted settings:', {`
  - Line 220: `console.log('[StableFilter] Effect running:', {`
  - Line 230: `console.log('[StableFilter] Shot changed but settings still loading - deferring ...`
  - Line 238: `console.log('[StableFilter] Skipping - already initialized and shot unchanged');`
  - ... and 17 more
- [ ] **`src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx`** — 23 logs (tags: FrameSyncDebug, PairSlot, SegmentClick, SegmentClickDebug, SegmentDelete)
  - Line 225: `console.log('[SegmentDisplay] 📺 CURRENT DISPLAY:', {`
  - Line 244: `console.log('[SegmentOutputStrip] Checking variants for generation:', generation...`
  - Line 252: `console.log('[SegmentOutputStrip] No primary variant found for generation:', gen...`
  - Line 267: `console.log('[SegmentOutputStrip] Marked variant as viewed, invalidating queries...`
  - Line 281: `console.log('[SegmentClick] 2️⃣ SegmentOutputStrip.handleSegmentClick called:', ...`
  - Line 303: `console.log('[FrameSyncDebug] 🎯 SegmentOutputStrip.handleSegmentClick:', {`
  - Line 317: `console.log('[SegmentClickDebug] Using local lightbox with slotIndex:', slotInde...`
  - Line 358: `console.log('[SegmentDelete] Start delete:', generationId.substring(0, 8));`
  - ... and 15 more
- [ ] **`src/tools/travel-between-images/components/Timeline/hooks/useUnifiedDrop.ts`** — 23 logs (tags: BatchDropPositionIssue)
  - Line 43: `console.log('[BatchDropPositionIssue] 🔍 getDragType:', {`
  - Line 57: `console.log('[BatchDropPositionIssue] 🚀 handleDragEnter:', {`
  - Line 65: `console.log('[BatchDropPositionIssue] 📁 FILE DRAG ENTER - Setting isFileOver=tru...`
  - Line 68: `console.log('[BatchDropPositionIssue] 🖼️ GENERATION DRAG ENTER - Setting isGener...`
  - Line 71: `console.log('[BatchDropPositionIssue] ⚠️ DRAG ENTER - No handler for this type')...`
  - Line 81: `console.log('[BatchDropPositionIssue] 🔄 handleDragOver:', {`
  - Line 98: `console.log('[BatchDropPositionIssue] 📁 FILE OVER - dropEffect=copy');`
  - Line 102: `console.log('[BatchDropPositionIssue] 🖼️ GENERATION OVER - dropEffect=copy');`
  - ... and 15 more
- [ ] **`src/shared/components/ImageGenerationForm/hooks/useReferenceManagement.ts`** — 23 logs (tags: useReferenceManagement)
  - Line 181: `console.warn('[useReferenceManagement] Found legacy base64 style reference, need...`
  - Line 199: `console.warn('[useReferenceManagement] Found legacy base64 style reference, need...`
  - Line 228: `console.log('[useReferenceManagement] Database caught up with pending mode updat...`
  - Line 238: `console.log('[useReferenceManagement] Syncing local state from reference:', sele...`
  - Line 257: `console.log('[useReferenceManagement] Updating reference settings:', { reference...`
  - Line 287: `console.log('[useReferenceManagement] Project settings updated successfully');`
  - Line 304: `console.warn('[useReferenceManagement] Cannot upload reference while settings ar...`
  - Line 404: `console.log('[useReferenceManagement] Creating new reference resource:', metadat...`
  - ... and 15 more
- [ ] **`src/tools/travel-between-images/components/Timeline/hooks/useTimelinePositions.ts`** — 22 logs (tags: PositionTrace, TimelinePositions)
  - Line 153: `console.log('[TimelinePositions] 🔒 Skipping sync - positions locked');`
  - Line 159: `console.log('[TimelinePositions] ⏳ Skipping sync - update in progress');`
  - Line 210: `console.warn('[TimelinePositions] ⏰ Pending update timed out, accepting server s...`
  - Line 224: `console.log('[TimelinePositions] 🛡️ Protected pending item from stale sync:', {`
  - Line 233: `console.log('[TimelinePositions] ✅ Verified/Cleared pending updates:', Array.fro...`
  - Line 248: `console.log('[PositionTrace] syncFromDatabase SETTING POSITIONS:', {`
  - Line 334: `console.log('[TimelinePositions] ✨ Applied optimistic update:', {`
  - Line 344: `console.log('[TimelinePositions] ⏪ Rolling back optimistic update');`
  - ... and 14 more
- [ ] **`src/shared/components/ShotImageManager/ShotImageManagerDesktop.tsx`** — 22 logs (tags: AddToShotDebug, AddWithoutPosDebug, BasedOnNav, LightboxTransition, PairIndicatorDebug)
  - Line 97: `console.log('[AddWithoutPosDebug] 🎯 setShowTickForSecondaryImageId CALLED with:'...`
  - Line 103: `console.log('[AddWithoutPosDebug] 📌 showTickForSecondaryImageId STATE VALUE:', s...`
  - Line 126: `console.log('[ShotSelectorDebug] ShotImageManagerDesktop received props', {`
  - Line 136: `console.log('[PairIndicatorDebug] ShotImageManagerDesktop received pair props', ...`
  - Line 250: `console.log('[SegmentNavDebug] ShotImageManager position-based matching:', {`
  - Line 266: `console.log('[LightboxTransition] ShotImageManager onNavigateToSegment: using tr...`
  - Line 545: `console.log('[AddToShotDebug] 📊 ShotImageManagerDesktop POSITION CHECK:');`
  - Line 546: `console.log('[AddToShotDebug] mediaId:', lightbox.currentImages[lightbox.lightbo...`
  - ... and 14 more
- [ ] **`src/shared/hooks/useEnhancedShotImageReorder.ts`** — 22 logs (tags: BatchModeReorderFlow, DataTrace, PositionSystemDebug, useEnhancedShotImageReorder)
  - Line 80: `console.log('[DataTrace] 🔄 handleReorder CALLED:', {`
  - Line 88: `console.warn('[DataTrace] handleReorder aborted - no shotId or empty array');`
  - Line 92: `console.log('[BatchModeReorderFlow] [HANDLE_REORDER] 🎯 useEnhancedShotImageReord...`
  - Line 99: `console.log('[useEnhancedShotImageReorder] Handling timeline-frame-based reorder...`
  - Line 110: `console.log('[DataTrace] 🔍 Analyzing reorder:', {`
  - Line 130: `console.log('[DataTrace] 🎯 Using explicit draggedItemId for detection:', {`
  - Line 174: `console.log('[DataTrace] 🔍 Item move detection:', {`
  - Line 187: `console.log('[DataTrace] ✅ Using MIDPOINT DISTRIBUTION logic for block move');`
  - ... and 14 more
- [ ] **`src/shared/lib/shotSettingsInheritance.ts`** — 22 logs (tags: ShotSettingsInherit)
  - Line 48: `console.warn('[ShotSettingsInherit] 🔍 Starting standardized inheritance check');`
  - Line 56: `console.warn('[ShotSettingsInherit] ✅ Inheriting main settings from project loca...`
  - Line 64: `console.warn('[ShotSettingsInherit] ⚠️ No main settings in project localStorage'...`
  - Line 71: `console.warn('[ShotSettingsInherit] ✅ Inheriting UI settings from project localS...`
  - Line 79: `console.warn('[ShotSettingsInherit] ✅ Inheriting Join Segments settings from pro...`
  - Line 92: `console.warn('[ShotSettingsInherit] 🌍 New project detected, checking global loca...`
  - Line 97: `console.warn('[ShotSettingsInherit] ✅ Inheriting main settings from GLOBAL local...`
  - Line 105: `console.warn('[ShotSettingsInherit] ⚠️ No global settings in localStorage');`
  - ... and 14 more
- [ ] **`src/shared/components/HoverScrubVideo.tsx`** — 21 logs (tags: MobileVideoAutoplay, VideoStallFix)
  - Line 174: `console.log('[VideoStallFix] Fallback priming video load on mouse move', {`
  - Line 184: `console.warn('[VideoStallFix] Failed to prime video load on mouse move', e);`
  - Line 210: `console.log('[VideoStallFix] Priming video load on hover (readyState=0)', {`
  - Line 220: `console.warn('[VideoStallFix] Failed to prime video load on hover', e);`
  - Line 242: `console.log('[MobileVideoAutoplay] Mouse leave detected on mobile (should be ign...`
  - Line 272: `console.warn('[MobileVideoAutoplay] Video was playing during metadata load, paus...`
  - Line 286: `console.log('[MobileVideoAutoplay] Set currentTime to show first frame (no poste...`
  - Line 295: `console.log(`[MobileVideoAutoplay] Skipping currentTime manipulation (${disableS...`
  - ... and 13 more
- [ ] **`src/shared/hooks/useVideoGalleryPreloader.ts`** — 21 logs (tags: VideoGalleryPreload)
  - Line 65: `console.log('[VideoGalleryPreload] Skipping preload due to saveData mode');`
  - Line 72: `console.log('[VideoGalleryPreload] Skipping preload due to slow connection:', ef...`
  - Line 104: `console.warn('[VideoGalleryPreload] Failed to fetch thumbnail URLs:', error);`
  - Line 120: `console.log(`[VideoGalleryPreload] Shot ${shotId.slice(0, 8)} URLs - Found ${url...`
  - Line 123: `console.warn('[VideoGalleryPreload] Error building thumbnail URLs:', error);`
  - Line 136: `console.log(`[VideoGalleryPreload] Page ${pageIndex} for shot ${shotId.slice(0, ...`
  - Line 140: `console.log(`[VideoGalleryPreload] Queueing preload for shot ${shotId.slice(0, 8...`
  - Line 148: `console.log(`[VideoGalleryPreload] All URLs already preloaded for shot ${shotId....`
  - ... and 13 more
- [ ] **`src/shared/hooks/useToolSettings.ts`** — 20 logs (tags: GenerationModeDebug, ShotNavPerf, ToolSettingsAuth, fetchToolSettingsSupabase, useToolSettings)
  - Line 64: `console.log('[GenerationModeDebug] ⚡ Using cached user (skipping getSession)');`
  - Line 80: `console.log('[GenerationModeDebug] ⏱️ getSession took:', sessionDuration + 'ms')...`
  - Line 125: `console.log('[GenerationModeDebug] ♻️ DEDUPE hit - reusing existing request:', {`
  - Line 138: `console.log('[GenerationModeDebug] 🚀 Query START:', {`
  - Line 154: `console.log('[GenerationModeDebug] ⏱️ Auth completed:', {`
  - Line 204: `console.log('[GenerationModeDebug] ⏱️ DB queries completed:', {`
  - Line 214: `console.warn('[fetchToolSettingsSupabase] User settings error:', userResult.erro...`
  - Line 217: `console.warn('[fetchToolSettingsSupabase] Project settings error:', projectResul...`
  - ... and 12 more
- [ ] **`src/shared/lib/styleReferenceProcessor.ts`** — 20 logs (tags: StyleRefDebug)
  - Line 15: `console.log('[StyleRefDebug] getScaledDimensions called with aspectRatioString:'...`
  - Line 16: `console.log('[StyleRefDebug] Available aspect ratios:', Object.keys(ASPECT_RATIO...`
  - Line 23: `console.log('[StyleRefDebug] Direct match found:', aspectRatioString, resolution...`
  - Line 29: `console.log('[StyleRefDebug] Target ratio parsed as:', targetRatio);`
  - Line 32: `console.log('[StyleRefDebug] Invalid aspect ratio string, using fallback 1:1');`
  - Line 36: `console.log('[StyleRefDebug] Fallback dimensions:', resolution, '->', scaled);`
  - Line 43: `console.log('[StyleRefDebug] Checking key:', key, 'keyRatio:', keyRatio, 'matche...`
  - Line 47: `console.log('[StyleRefDebug] Found aspectRatioKey:', aspectRatioKey);`
  - ... and 12 more
- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** — 19 logs (tags: BackfillV2, GalleryFilter, GenerationDiag:${generateId}, ImageGeneration, ImageGenerationToolPage)
  - Line 240: `console.log('[GalleryFilter] Restoring saved override for shot:', formAssociated...`
  - Line 244: `console.log('[GalleryFilter] No override, defaulting to shot:', formAssociatedSh...`
  - Line 260: `console.log('[GalleryFilter] User changed filter:', {`
  - Line 329: `console.log('[ShotFilterPagination] 📄 ANY filter changed, resetting to page 1:',...`
  - Line 453: `console.log(`[GenerationDiag:${generateId}] 🚀 GENERATION START:`, {`
  - Line 478: `console.log('[ImageGeneration] Using unified batch task creation for model:', ta...`
  - Line 490: `console.log(`[GenerationDiag:${generateId}] ✅ GENERATION COMPLETE:`, {`
  - Line 497: `console.log('[ImageGeneration] Image generation tasks created successfully');`
  - ... and 11 more
- [ ] **`src/shared/components/MediaLightbox/hooks/useReferences.ts`** — 19 logs (tags: AddToRefDebug, AddToReferences)
  - Line 61: `console.log('[AddToRefDebug] 🚀 Starting Add to References flow', {`
  - Line 69: `console.log('[AddToRefDebug] ❌ Early exit - no project or is video');`
  - Line 82: `console.log('[AddToReferences] Starting to add image to references:', imageUrl);`
  - Line 98: `console.log('[AddToReferences] Generating thumbnail for reference image...');`
  - Line 102: `console.log('[AddToReferences] Thumbnail generated:', {`
  - Line 132: `console.log('[AddToReferences] Thumbnail uploaded successfully:', thumbnailUrl);`
  - Line 151: `console.log('[AddToReferences] Processing for aspect ratio:', aspectRatio);`
  - Line 171: `console.log('[AddToRefDebug] 📊 Current project state', {`
  - ... and 11 more
- [ ] **`src/shared/components/VariantSelector/index.tsx`** — 18 logs (tags: VariantPrefetch, VariantRelationship)
  - Line 121: `console.log('[VariantPrefetch] Prefetching source task:', validSourceTaskId.subs...`
  - Line 124: `console.log('[VariantPrefetch] No source_task_id, prefetching via generation:', ...`
  - Line 131: `console.log('[VariantRelationship] Computing relationships:');`
  - Line 132: `console.log('[VariantRelationship] variantsCount:', variants.length);`
  - Line 133: `console.log('[VariantRelationship] activeVariantId:', activeVariantId);`
  - Line 145: `console.log('[VariantRelationship] No active variant found');`
  - Line 149: `console.log('[VariantRelationship] Active variant:');`
  - Line 150: `console.log('[VariantRelationship] - id:', activeVar.id);`
  - ... and 10 more

*Plus 265 more files with tagged logs.*

---
## 2. Unused Declarations

Reported by TypeScript compiler (TS6133). Remove unused imports and variables.
After removing, re-run `npx tsc --noEmit` to confirm no new errors.

- [ ] **`src/tools/travel-between-images/components/BatchSettingsForm.tsx`** — 37 unused (8 imports, 29 vars)
  - Line 3: `(entire import)` (imports)
  - Line 8: `Input` (imports)
  - Line 9: `Plus` (imports)
  - Line 9: `Sparkles` (imports)
  - Line 14: `(entire import)` (imports)
  - Line 16: `ASPECT_RATIO_TO_RESOLUTION` (imports)
  - Line 19: `SectionHeader` (imports)
  - Line 23: `getValidFrameCounts` (imports)
  - Line 109: `batchVideoSteps` (vars)
  - Line 110: `onBatchVideoStepsChange` (vars)
  - ... and 27 more
- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** — 29 unused (9 imports, 20 vars)
  - Line 3: `PromptEntry` (imports)
  - Line 6: `MetadataLora` (imports)
  - Line 11: `supabase` (imports)
  - Line 19: `uploadImageToStorage` (imports)
  - Line 20: `nanoid` (imports)
  - Line 35: `getDisplayUrl` (imports)
  - Line 36: `ShotFilter` (imports)
  - Line 40: `ChevronRight` (imports)
  - Line 41: `usePersistentToolState` (imports)
  - Line 73: `generatedImages` (vars)
  - ... and 19 more
- [ ] **`src/shared/components/MediaLightbox/ImageLightbox.tsx`** — 18 unused (0 imports, 18 vars)
  - Line 123: `showMagicEdit` (vars)
  - Line 142: `onShowTaskDetails` (vars)
  - Line 174: `setTasksPaneOpenContext` (vars)
  - Line 177: `setIsTasksPaneLocked` (vars)
  - Line 186: `cancellableTaskCount` (vars)
  - Line 197: `isSelectOpen` (vars)
  - Line 197: `setIsSelectOpen` (vars)
  - Line 330: `setEditModeLoRAs` (vars)
  - Line 340: `setPersistedPanelMode` (vars)
  - Line 427: `star` (vars)
  - ... and 8 more
- [ ] **`src/shared/components/MediaGalleryItem.tsx`** — 17 unused (1 imports, 16 vars)
  - Line 13: `GeneratedImageWithMetadata` (imports)
  - Line 43: `onApplySettings` (vars)
  - Line 47: `onDownloadImage` (vars)
  - Line 53: `showTickForSecondaryImageId` (vars)
  - Line 64: `downloadingImageId` (vars)
  - Line 69: `setMobilePopoverOpenImageId` (vars)
  - Line 75: `isGalleryLoading` (vars)
  - Line 81: `showDownload` (vars)
  - Line 143: `isImageTask` (vars)
  - Line 161: `lastAffectedShotId` (vars)
  - ... and 7 more
- [ ] **`src/shared/components/MediaLightbox/components/EditModePanel.tsx`** — 16 unused (3 imports, 13 vars)
  - Line 10: `SourceGenerationDisplay` (imports)
  - Line 12: `(entire import)` (imports)
  - Line 14: `ActiveLora` (imports)
  - Line 119: `sourceGenerationData` (vars)
  - Line 120: `onOpenExternalGeneration` (vars)
  - Line 121: `currentShotId` (vars)
  - Line 122: `allShots` (vars)
  - Line 123: `isCurrentMediaPositioned` (vars)
  - Line 124: `onReplaceInShot` (vars)
  - Line 125: `sourcePrimaryVariant` (vars)
  - ... and 6 more
- [ ] **`src/shared/hooks/useTasks.ts`** — 14 unused (4 imports, 10 vars)
  - Line 6: `useProject` (imports)
  - Line 7: `isTaskVisible` (imports)
  - Line 7: `getTaskDisplayName` (imports)
  - Line 7: `getTaskConfig` (imports)
  - Line 79: `useUpdateTaskStatus` (vars)
  - Line 80: `queryClient` (vars)
  - Line 97: `data` (vars)
  - Line 97: `variables` (vars)
  - Line 160: `queryContext` (vars)
  - Line 345: `queryDebugInfo` (vars)
  - ... and 4 more
- [ ] **`src/tools/edit-video/components/InlineEditVideoView.tsx`** — 14 unused (7 imports, 7 vars)
  - Line 1: `React` (imports)
  - Line 7: `Loader2` (imports)
  - Line 7: `Check` (imports)
  - Line 9: `Tooltip` (imports)
  - Line 9: `TooltipContent` (imports)
  - Line 9: `TooltipTrigger` (imports)
  - Line 14: `LoraModel` (imports)
  - Line 86: `onVideoSaved` (vars)
  - Line 87: `onNavigateToGeneration` (vars)
  - Line 144: `newVariantId` (vars)
  - ... and 4 more
- [ ] **`src/shared/components/TaskDetailsModal.tsx`** — 11 unused (10 imports, 1 vars)
  - Line 15: `DialogDescription` (imports)
  - Line 22: `(entire import)` (imports)
  - Line 23: `Badge` (imports)
  - Line 24: `Separator` (imports)
  - Line 29: `ScrollArea` (imports)
  - Line 30: `Task` (imports)
  - Line 31: `supabase` (imports)
  - Line 32: `useCreateGeneration` (imports)
  - Line 35: `X` (imports)
  - Line 38: `LoraModel` (imports)
  - ... and 1 more
- [ ] **`src/shared/components/MediaLightbox/VideoLightbox.tsx`** — 10 unused (0 imports, 10 vars)
  - Line 150: `onShowTaskDetails` (vars)
  - Line 224: `setTasksPaneOpenContext` (vars)
  - Line 227: `setIsTasksPaneLocked` (vars)
  - Line 234: `cancellableTaskCount` (vars)
  - Line 242: `isSelectOpen` (vars)
  - Line 242: `setIsSelectOpen` (vars)
  - Line 443: `star` (vars)
  - Line 444: `references` (vars)
  - Line 534: `handleExitVideoTrimMode` (vars)
  - Line 535: `isVideoTrimMode` (vars)
- [ ] **`src/shared/components/ShotImageManager/ShotImageManagerMobile.tsx`** — 10 unused (2 imports, 8 vars)
  - Line 9: `Trash2` (imports)
  - Line 16: `Checkbox` (imports)
  - Line 58: `currentDialogSkipChoiceRef` (vars)
  - Line 59: `skipConfirmationNextTimeVisual` (vars)
  - Line 59: `setSkipConfirmationNextTimeVisual` (vars)
  - Line 70: `reconciliationId` (vars)
  - Line 72: `isMobile` (vars)
  - Line 73: `imageDeletionSettings` (vars)
  - Line 425: `endImage` (vars)
  - Line 431: `prevEndImage` (vars)
- [ ] **`src/shared/components/PromptEditorModal.tsx`** — 9 unused (4 imports, 5 vars)
  - Line 4: `PromptInputRowProps` (imports)
  - Line 9: `AIPromptItem` (imports)
  - Line 9: `EditPromptParams` (imports)
  - Line 13: `(entire import)` (imports)
  - Line 131: `showScrollToTop` (vars)
  - Line 161: `scrollToTop` (vars)
  - Line 227: `isAISummarizing` (vars)
  - Line 317: `newlyAddedPromptIds` (vars)
  - Line 426: `toggleFullView` (vars)
- [ ] **`src/tools/travel-between-images/components/BatchGuidanceVideo.tsx`** — 9 unused (0 imports, 9 vars)
  - Line 43: `motionStrength` (vars)
  - Line 44: `structureType` (vars)
  - Line 47: `onMotionStrengthChange` (vars)
  - Line 48: `onStructureTypeChange` (vars)
  - Line 49: `uni3cEndPercent` (vars)
  - Line 50: `onUni3cEndPercentChange` (vars)
  - Line 51: `imageCount` (vars)
  - Line 54: `hideStructureSettings` (vars)
  - Line 74: `isVideoReady` (vars)
- [ ] **`src/shared/components/ImageGenerationForm/ImageGenerationForm.tsx`** — 8 unused (0 imports, 8 vars)
  - Line 589: `currentReferenceMode` (vars)
  - Line 596: `getTaskParams` (vars)
  - Line 601: `isGeneratingAutomatedPrompts` (vars)
  - Line 634: `effectiveSelectedReferenceId` (vars)
  - Line 647: `setEffectiveSelectedReferenceId` (vars)
  - Line 756: `handleLoadProjectLoras` (vars)
  - Line 783: `handleOpenMagicPrompt` (vars)
  - Line 826: `handleTextChange` (vars)
- [ ] **`src/shared/components/TaskDetailsPanel.tsx`** — 8 unused (5 imports, 3 vars)
  - Line 3: `(entire import)` (imports)
  - Line 4: `Badge` (imports)
  - Line 5: `Separator` (imports)
  - Line 8: `Label` (imports)
  - Line 15: `LoraModel` (imports)
  - Line 38: `error` (vars)
  - Line 47: `showUserImage` (vars)
  - Line 172: `isVideoTask` (vars)
- [ ] **`src/pages/Home/components/PhilosophyPane.tsx`** — 7 unused (2 imports, 5 vars)
  - Line 4: `AUTO_ADVANCE_ANIMATION_DURATION` (imports)
  - Line 5: `VideoWithPoster` (imports)
  - Line 58: `loraOptions` (vars)
  - Line 278: `loraVideosReadyRef` (vars)
  - Line 279: `loraVideosSyncedStartRef` (vars)
  - Line 283: `selectedLora` (vars)
  - Line 283: `setSelectedLora` (vars)
- [ ] **`src/pages/Home/HomePage.tsx`** — 7 unused (1 imports, 6 vars)
  - Line 2: `React` (imports)
  - Line 57: `openTipOpen` (vars)
  - Line 58: `openTipDisabled` (vars)
  - Line 60: `emergingTipOpen` (vars)
  - Line 61: `emergingTipDisabled` (vars)
  - Line 67: `setSelectedExampleStyle` (vars)
  - Line 466: `wrappedHandleExploringActivate` (vars)
- [ ] **`src/shared/components/GenerationsPane/GenerationsPane.tsx`** — 7 unused (7 imports, 0 vars)
  - Line 11: `LockIcon` (imports)
  - Line 11: `UnlockIcon` (imports)
  - Line 11: `Square` (imports)
  - Line 19: `Skeleton` (imports)
  - Line 22: `(entire import)` (imports)
  - Line 29: `toast` (imports)
  - Line 40: `PANE_CONFIG` (imports)
- [ ] **`src/shared/components/VideoPortionEditor/index.tsx`** — 7 unused (5 imports, 2 vars)
  - Line 8: `Tooltip` (imports)
  - Line 8: `TooltipContent` (imports)
  - Line 8: `TooltipTrigger` (imports)
  - Line 9: `X` (imports)
  - Line 15: `BuiltinPreset` (imports)
  - Line 282: `onClose` (vars)
  - Line 289: `totalFramesToGenerate` (vars)
- [ ] **`src/shared/components/VideoTrimEditor/components/TrimControlsPanel.tsx`** — 7 unused (1 imports, 6 vars)
  - Line 10: `X` (imports)
  - Line 20: `trimmedDuration` (vars)
  - Line 27: `onClose` (vars)
  - Line 42: `setIsExtractingFrames` (vars)
  - Line 266: `padding` (vars)
  - Line 267: `spacing` (vars)
  - Line 268: `headerSize` (vars)
- [ ] **`src/shared/hooks/shots/useShotGenerationMutations.ts`** — 7 unused (2 imports, 5 vars)
  - Line 8: `Shot` (imports)
  - Line 24: `updateShotGenerationsCache` (imports)
  - Line 295: `variables` (vars)
  - Line 333: `generation_id` (vars)
  - Line 523: `variables` (vars)
  - Line 604: `err` (vars)
  - Line 604: `variables` (vars)
- [ ] **`src/shared/lib/generationTaskBridge.ts`** — 7 unused (1 imports, 6 vars)
  - Line 1: `useQueryClient` (imports)
  - Line 90: `taskId` (vars)
  - Line 118: `useGenerationTaskMapping` (vars)
  - Line 131: `useTaskGenerationMapping` (vars)
  - Line 156: `useTaskData` (vars)
  - Line 244: `invalidateGenerationTaskCaches` (vars)
  - Line 263: `extractTaskIds` (vars)
- [ ] **`src/tools/travel-between-images/components/Timeline/PairRegion.tsx`** — 7 unused (0 imports, 7 vars)
  - Line 42: `contextStartPercent` (vars)
  - Line 43: `generationStartPercent` (vars)
  - Line 45: `visibleContextFrames` (vars)
  - Line 46: `isDragging` (vars)
  - Line 47: `numPairs` (vars)
  - Line 54: `defaultPrompt` (vars)
  - Line 55: `defaultNegativePrompt` (vars)
- [ ] **`src/tools/travel-between-images/components/Timeline/TimelineControls.tsx`** — 7 unused (1 imports, 6 vars)
  - Line 5: `Info` (imports)
  - Line 38: `shotId` (vars)
  - Line 39: `projectId` (vars)
  - Line 40: `structureVideoPath` (vars)
  - Line 41: `structureVideoTreatment` (vars)
  - Line 42: `structureVideoMotionStrength` (vars)
  - Line 43: `onStructureVideoChange` (vars)
- [ ] **`src/shared/components/LoraSelectorModal/components/CommunityLorasTab.tsx`** — 6 unused (1 imports, 5 vars)
  - Line 7: `Resource` (imports)
  - Line 23: `updateResource` (vars)
  - Line 25: `onClose` (vars)
  - Line 28: `setShowMyLorasOnly` (vars)
  - Line 30: `setShowAddedLorasOnly` (vars)
  - Line 103: `myLoraModelIds` (vars)
- [ ] **`src/shared/components/MediaGallery/components/MediaGalleryFilters.tsx`** — 6 unused (4 imports, 2 vars)
  - Line 2: `Download` (imports)
  - Line 2: `Loader2` (imports)
  - Line 4: `Label` (imports)
  - Line 5: `Checkbox` (imports)
  - Line 62: `onDownloadStarred` (vars)
  - Line 63: `isDownloadingStarred` (vars)
- [ ] **`src/shared/components/MediaLightbox/hooks/useInpainting.ts`** — 6 unused (1 imports, 5 vars)
  - Line 16: `GenerationRow` (imports)
  - Line 57: `imageContainerRef` (vars)
  - Line 65: `imageUrl` (vars)
  - Line 66: `thumbnailUrl` (vars)
  - Line 76: `setIsImageLoaded` (vars)
  - Line 77: `setImageLoadError` (vars)
- [ ] **`src/shared/lib/errorHandler.ts`** — 6 unused (2 imports, 4 vars)
  - Line 18: `NetworkError` (imports)
  - Line 19: `AuthError` (imports)
  - Line 129: `createErrorHandler` (vars)
  - Line 149: `withErrorHandling` (vars)
  - Line 166: `shouldRedirectToLogin` (vars)
  - Line 176: `isRetryableError` (vars)
- [ ] **`src/tools/edit-images/components/InlineEditView.tsx`** — 6 unused (2 imports, 4 vars)
  - Line 1: `React` (imports)
  - Line 8: `LoraModel` (imports)
  - Line 47: `contentRef` (vars)
  - Line 153: `showTextModeHint` (vars)
  - Line 233: `setTranslateX` (vars)
  - Line 234: `setTranslateY` (vars)
- [ ] **`src/tools/travel-between-images/components/MotionControl.tsx`** — 6 unused (0 imports, 6 vars)
  - Line 132: `structureVideoMotionStrength` (vars)
  - Line 133: `onStructureVideoMotionStrengthChange` (vars)
  - Line 134: `onStructureTypeChange` (vars)
  - Line 135: `uni3cEndPercent` (vars)
  - Line 136: `onUni3cEndPercentChange` (vars)
  - Line 161: `advancedMode` (vars)
- [ ] **`src/pages/Home/components/HeroSection.tsx`** — 5 unused (3 imports, 2 vars)
  - Line 2: `ChevronLeft` (imports)
  - Line 2: `ChevronRight` (imports)
  - Line 3: `TooltipContent` (imports)
  - Line 101: `barTransitionCompleted` (vars)
  - Line 108: `currentExample` (vars)

*Plus 220 more files.*

---
## 3. Dead Exports

Exports with no external importers. Either remove `export` keyword or delete entirely
if the symbol is also unused internally.

- [ ] **`src/tools/travel-between-images/components/VideoTravelVideosGallery.tsx`** — VideosQueryProps, VideosFiltersProps, AddToShotProps, DeleteProps, PreloadingProps, VideoTravelVideosGalleryProps
- [ ] **`src/tools/travel-between-images/components/ShotEditor/ShotSettingsContext.tsx`** — ShotCoreState, ShotLoraState, ShotImagesState, ShotManagementState
- [ ] **`src/tools/travel-between-images/components/ShotEditor/state/types.ts`** — SegmentGenerationParams, VideoPairConfig, ShotSettings, TaskSettings
- [ ] **`src/tools/travel-between-images/components/VideoTravelListHeader.tsx`** — ViewModeProps, SearchProps, SortProps, VideoTravelListHeaderProps
- [ ] **`src/types/database.ts`** — CreditLedgerType, CreditLedger, UserAPIToken, TrainingData
- [ ] **`src/shared/components/MediaLightbox/components/layouts/types.ts`** — LayoutButtonGroupProps, LayoutWorkflowBarProps, LayoutFloatingToolPropsSimple, LayoutWorkflowControlsProps
- [ ] **`src/shared/components/MediaGallery/hooks/useMediaGalleryFiltersOptimized.ts`** — MediaGalleryFiltersState, MediaGalleryFiltersAction, UseMediaGalleryFiltersOptimizedProps, UseMediaGalleryFiltersOptimizedReturn
- [ ] **`src/shared/components/MediaGallery/hooks/useMediaGalleryStateOptimized.ts`** — MediaGalleryState, MediaGalleryStateAction, UseMediaGalleryStateOptimizedProps, UseMediaGalleryStateOptimizedReturn
- [ ] **`src/shared/components/MediaGallery/hooks/useMediaGalleryPagination.ts`** — NavigationStatus, NavigationState, UseMediaGalleryPaginationProps, UseMediaGalleryPaginationReturn
- [ ] **`src/shared/lib/tasks/travelBetweenImages/defaults.ts`** — DEFAULT_VIDEO_MOTION_PARAMS, DEFAULT_PROMPT_CONFIG, DEFAULT_MOTION_CONFIG, DEFAULT_MODEL_CONFIG
- [ ] **`src/shared/lib/queryDefaults.ts`** — QueryPresetKey, classifyNetworkError, withCircuitBreaker, createQueryOptionsWithCircuitBreaker
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/types.ts`** — SegmentSlotState, StableCallbackDeps, UsePreviewStateReturn
- [ ] **`src/tools/travel-between-images/components/Timeline/utils/timeline-utils.ts`** — calculateMaxGap, validateGaps, VideoPlacementResult
- [ ] **`src/tools/travel-between-images/hooks/useVideoTravelViewMode.ts`** — VideoGalleryFilters, UseVideoTravelViewModeParams, UseVideoTravelViewModeReturn
- [ ] **`src/shared/components/ui/select.tsx`** — SelectTriggerProps, SelectContentProps, SelectItemProps
- [ ] **`src/shared/components/MediaLightbox/hooks/useVideoRegenerateMode.ts`** — CurrentSegmentImages, UseVideoRegenerateModeProps, UseVideoRegenerateModeReturn
- [ ] **`src/shared/hooks/useAsyncOperation.ts`** — AsyncOperationOptions, UseAsyncOperationReturn, UseAsyncOperationMapReturn
- [ ] **`src/shared/hooks/usePersistentToolState.ts`** — StateMapping, UsePersistentToolStateOptions, UsePersistentToolStateResult
- [ ] **`src/shared/hooks/useEntityState.ts`** — EntityStateStatus, UseEntityStateOptions, UseEntityStateReturn
- [ ] **`src/shared/hooks/useQuickShotCreate.ts`** — QuickCreateSuccessState, UseQuickShotCreateProps, UseQuickShotCreateReturn
- [ ] **`src/shared/hooks/usePromptFieldState.ts`** — PromptBadgeType, UsePromptFieldStateOptions, PromptFieldState
- [ ] **`src/shared/lib/tasks/joinClips.ts`** — JoinClipDescriptor, JoinClipsPerJoinSettings, PortionToRegenerate
- [ ] **`src/shared/lib/tasks/videoEnhance.ts`** — FilmInterpolationApiParams, FlashVsrUpscaleApiParams, VideoEnhanceTaskResult
- [ ] **`src/shared/lib/mediaTypeHelpers.ts`** — MediaWithGenerationId, MaybeHasGenerationId, MediaWithUrls
- [ ] **`src/shared/lib/NetworkStatusManager.ts`** — NetworkStatus, NetworkEventType, NetworkStatusSubscriber
- [ ] **`src/integrations/supabase/types.ts`** — TablesInsert, TablesUpdate, CompositeTypes
- [ ] **`src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts`** — TaskData, ExtractedSettings
- [ ] **`src/tools/travel-between-images/components/ShotEditor/services/generateVideoService.ts`** — GenerateVideoParams, GenerateVideoResult
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/hooks/usePairData.ts`** — UsePairDataProps, UsePairDataReturn
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/hooks/useFrameCountUpdater.ts`** — UseFrameCountUpdaterProps, UseFrameCountUpdaterReturn

*Plus 164 more files.*

---
## 4. Deprecated Symbols

Symbols marked `@deprecated`. Those with 0 importers can be deleted immediately.
For those with active importers, migrate callers first.

### Top-level (importable)

- [ ] `isGenerationVideo` in `src/tools/travel-between-images/components/ShotEditor/utils/generation-utils.ts` — 1 importers — migrate first
- [ ] `LegacyStructureVideoConfig` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts` — 1 importers — migrate first
- [ ] `VideoStructureApiParams` in `src/shared/lib/tasks/travelBetweenImages/types.ts` — 3 importers — migrate first
- [ ] `GenerationRow` in `src/types/shots.ts` — 139 importers — migrate first

### Deprecated properties

- [ ] `structureVideoConfig` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:60`
- [ ] `setStructureVideoConfig` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:62`
- [ ] `structureVideoPath` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:68`
- [ ] `structureVideoMetadata` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:70`
- [ ] `structureVideoTreatment` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:72`
- [ ] `structureVideoMotionStrength` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:74`
- [ ] `structureVideoType` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:76`
- [ ] `structureVideoResourceId` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:78`
- [ ] `handleStructureVideoChange` in `src/tools/travel-between-images/components/ShotEditor/hooks/useStructureVideo.ts:80`
- [ ] `onPrefetchAdjacentPages` in `src/tools/travel-between-images/components/VideoTravelVideosGallery.tsx:61`
- [ ] `shotImageEntryId` in `src/types/shots.ts:104`
- [ ] `shot_generation_id` in `src/types/shots.ts:106`
- [ ] `advancedMode` in `src/shared/types/segmentSettings.ts:131`
- [ ] `whiteText` in `src/shared/components/ShotFilter.tsx:22`
- [ ] `dismissHoverDelay` in `src/shared/components/VariantBadge.tsx:52`
- [ ] `GAP` in `src/shared/components/MediaGallery/utils/mediaGallery-constants.ts:41`
- [ ] `onPrefetchAdjacentPages` in `src/shared/components/MediaGallery/types.ts:170`
- [ ] `onPrefetchAdjacentPages` in `src/shared/components/MediaGallery/components/MediaGalleryGrid.tsx:50`
- [ ] `whiteText` in `src/shared/components/MediaTypeFilter.tsx:14`
- [ ] `pair_prompt` in `src/shared/components/segmentSettingsUtils.ts:239`

*Plus 23 more deprecated properties.*

---
## 5. Large Files (refactoring candidates)

Files over 300 lines. Consider extracting hooks, splitting components,
or moving types to dedicated files.

- [ ] **`src/integrations/supabase/types.ts`** — 2573 LOC, 0 imports, 6 functions
- [ ] **`src/shared/components/MediaLightbox/ImageLightbox.tsx`** — 1308 LOC, 21 imports, 47 functions
- [ ] **`src/tools/travel-between-images/components/ShotEditor/index.tsx`** — 1201 LOC, 26 imports, 25 functions
- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** — 1173 LOC, 40 imports, 65 functions
- [ ] **`src/shared/components/ImageGenerationForm/ImageGenerationForm.tsx`** — 1130 LOC, 34 imports, 30 functions
- [ ] **`src/pages/Home/components/PhilosophyPane.tsx`** — 1113 LOC, 6 imports, 50 functions
- [ ] **`src/shared/components/MediaLightbox/VideoLightbox.tsx`** — 1096 LOC, 21 imports, 71 functions
- [ ] **`src/shared/components/MediaGallery/index.tsx`** — 1094 LOC, 23 imports, 37 functions
- [ ] **`src/tools/edit-video/components/InlineEditVideoView.tsx`** — 1076 LOC, 31 imports, 48 functions
- [ ] **`src/shared/components/SegmentSettingsForm/SegmentSettingsForm.tsx`** — 1048 LOC, 24 imports, 32 functions
- [ ] **`src/tools/travel-between-images/components/Timeline/TimelineContainer/TimelineContainer.tsx`** — 1007 LOC, 20 imports, 38 functions
- [ ] **`src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx`** — 976 LOC, 18 imports, 55 functions
- [ ] **`src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts`** — 951 LOC, 6 imports, 43 functions
- [ ] **`src/tools/character-animate/pages/CharacterAnimatePage.tsx`** — 940 LOC, 27 imports, 56 functions
- [ ] **`src/tools/edit-images/components/InlineEditView.tsx`** — 929 LOC, 18 imports, 20 functions
- [ ] **`src/shared/components/ImageGenerationForm/hooks/useReferenceManagement.ts`** — 910 LOC, 16 imports, 26 functions
- [ ] **`src/shared/components/MediaLightbox/components/EditModePanel.tsx`** — 890 LOC, 24 imports, 22 functions
- [ ] **`src/tools/travel-between-images/components/ShotEditor/hooks/useGenerationActions.ts`** — 884 LOC, 17 imports, 15 functions
- [ ] **`src/shared/components/segmentSettingsUtils.ts`** — 880 LOC, 4 imports, 26 functions
- [ ] **`src/shared/hooks/shots/useShotGenerationMutations.ts`** — 858 LOC, 11 imports, 48 functions

*Plus 185 more files.*

---
## 6. Complexity Signals (deeper refactoring)

Files with structural issues that indicate need for refactoring.
Address these after quick wins above.

- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** (1173 LOC, score 44) — 40 imports, 11 useEffects
- [ ] **`src/shared/components/GenerationsPane/GenerationsPane.tsx`** (704 LOC, score 36) — 34 imports, destructure w/10 props, 8 useEffects
- [ ] **`src/shared/components/ImageGenerationForm/ImageGenerationForm.tsx`** (1130 LOC, score 34) — 34 imports, 8 useEffects
- [ ] **`src/app/Layout.tsx`** (419 LOC, score 31) — 28 imports, 9 useEffects
- [ ] **`src/shared/components/ShotImageManager/ShotImageManagerDesktop.tsx`** (694 LOC, score 28) — 31 imports, 7 useEffects
- [ ] **`src/tools/character-animate/pages/CharacterAnimatePage.tsx`** (940 LOC, score 27) — 27 imports, 8 useEffects
- [ ] **`src/pages/Home/HomePage.tsx`** (638 LOC, score 26) — 20 imports, 10 useEffects
- [ ] **`src/tools/travel-between-images/components/ShotListDisplay.tsx`** (821 LOC, score 22) — 19 imports, 9 useEffects
- [ ] **`src/shared/components/PromptEditorModal.tsx`** (772 LOC, score 21) — 19 imports, 8 useEffects, 5 inline types
- [ ] **`src/tools/travel-between-images/components/ShotEditor/index.tsx`** (1201 LOC, score 20) — 26 imports, 6 useEffects
- [ ] **`src/shared/components/TasksPane/TasksPane.tsx`** (624 LOC, score 20) — 29 imports, destructure w/11 props, 4 useEffects
- [ ] **`src/tools/edit-video/components/InlineEditVideoView.tsx`** (1076 LOC, score 18) — 31 imports, destructure w/10 props
- [ ] **`src/tools/travel-between-images/components/Timeline.tsx`** (810 LOC, score 18) — 25 imports, 5 useEffects, 1 TODOs
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/components/PreviewTogetherDialog.tsx`** (768 LOC, score 18) — 9 useEffects
- [ ] **`src/shared/components/ImageGenerationForm/components/PromptInputRow.tsx`** (369 LOC, score 18) — 9 useEffects
- [ ] **`src/shared/components/MediaGalleryItem.tsx`** (822 LOC, score 16) — 31 imports
- [ ] **`src/tools/join-clips/hooks/useClipManager.ts`** (740 LOC, score 15) — 8 useEffects
- [ ] **`src/tools/travel-between-images/components/VideoGenerationModal.tsx`** (556 LOC, score 15) — 30 imports
- [ ] **`src/shared/components/PhaseConfigSelectorModal/components/AddNewPresetTab.tsx`** (504 LOC, score 15) — 4 useEffects, 4 nested ternaries
- [ ] **`src/app/App.tsx`** (291 LOC, score 14) — 28 imports, destructure w/9 props

*Plus 57 more files.*

---
## 7. God Components (LLM review recommended)

Components with excessive hook usage — likely doing too many things at once.
Deploy an agent to read each file and identify distinct responsibilities to extract.

- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** (1173 LOC, 39 hooks) — 11 useEffects, 21 useStates, 64 custom hooks, 39 total hooks
- [ ] **`src/pages/Home/HomePage.tsx`** (638 LOC, 27 hooks) — 10 useEffects, 13 useStates, 32 custom hooks, 27 total hooks
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/components/PreviewTogetherDialog.tsx`** (768 LOC, 26 hooks) — 9 useEffects, 11 useStates, 18 custom hooks, 26 total hooks
- [ ] **`src/pages/Home/components/PhilosophyPane.tsx`** (1113 LOC, 26 hooks) — 4 useEffects, 13 useStates, 23 custom hooks, 26 total hooks
- [ ] **`src/tools/character-animate/pages/CharacterAnimatePage.tsx`** (940 LOC, 24 hooks) — 8 useEffects, 12 useStates, 30 custom hooks, 24 total hooks
- [ ] **`src/shared/components/VideoPortionTimeline/index.tsx`** (760 LOC, 24 hooks) — 5 useEffects, 8 useStates, 22 custom hooks, 24 total hooks
- [ ] **`src/shared/components/ImageGenerationForm/ImageGenerationForm.tsx`** (1130 LOC, 22 hooks) — 8 useEffects, 9 useStates, 48 custom hooks, 22 total hooks
- [ ] **`src/pages/Home/components/HeroSection.tsx`** (659 LOC, 22 hooks) — 6 useEffects, 12 useStates, 20 custom hooks, 22 total hooks
- [ ] **`src/shared/components/PromptEditorModal.tsx`** (772 LOC, 21 hooks) — 8 useEffects, 7 useStates, 28 custom hooks, 21 total hooks
- [ ] **`src/tools/travel-between-images/components/ShotListDisplay.tsx`** (821 LOC, 20 hooks) — 9 useEffects, 8 useStates, 35 custom hooks, 20 total hooks
- [ ] **`src/tools/travel-between-images/components/ShotEditor/index.tsx`** (1201 LOC, 20 hooks) — 6 useEffects, 66 custom hooks, 20 total hooks
- [ ] **`src/shared/contexts/ProjectContext.tsx`** (853 LOC, 20 hooks) — 7 useEffects, 6 useStates, 24 custom hooks, 20 total hooks
- [ ] **`src/shared/components/VideoTrimEditor/components/TrimControlsPanel.tsx`** (418 LOC, 20 hooks) — 5 useEffects, 12 custom hooks, 20 total hooks
- [ ] **`src/tools/edit-video/pages/EditVideoPage.tsx`** (749 LOC, 19 hooks) — 12 useStates, 31 custom hooks, 19 total hooks
- [ ] **`src/shared/components/GlobalHeader.tsx`** (840 LOC, 19 hooks) — 5 useEffects, 13 useStates, 22 custom hooks, 19 total hooks

*Plus 44 more.*

---
## 8. Mixed Concerns

Files that combine UI rendering with data fetching, direct API calls, or heavy transforms.
Each concern should live in a separate file (component, hook, service).

- [ ] **`src/tools/edit-video/components/InlineEditVideoView.tsx`** (1076 LOC) — jsx_rendering, data_fetching, data_transforms(13), handlers(9)
- [ ] **`src/tools/travel-between-images/components/ShotListDisplay.tsx`** (821 LOC) — jsx_rendering, data_fetching, data_transforms(17), handlers(12)
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor.tsx`** (728 LOC) — jsx_rendering, data_fetching, data_transforms(9), handlers(8)
- [ ] **`src/tools/travel-between-images/components/VideoGenerationModal.tsx`** (556 LOC) — jsx_rendering, data_fetching, data_transforms(9), handlers(6)
- [ ] **`src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx`** (976 LOC) — jsx_rendering, data_fetching, data_transforms(22), handlers(7)
- [ ] **`src/tools/travel-between-images/components/FinalVideoSection.tsx`** (602 LOC) — jsx_rendering, data_fetching, data_transforms(6), handlers(6)
- [ ] **`src/shared/components/TasksPane/TasksPane.tsx`** (624 LOC) — jsx_rendering, data_fetching, data_transforms(12), handlers(5)
- [ ] **`src/shared/components/TasksPane/TaskItem.tsx`** (702 LOC) — jsx_rendering, data_fetching, data_transforms(3), handlers(7)
- [ ] **`src/shared/components/ImageGenerationForm/ImageGenerationForm.tsx`** (1130 LOC) — jsx_rendering, data_fetching, data_transforms(3), handlers(5)
- [ ] **`src/pages/ShotsPage.tsx`** (279 LOC) — jsx_rendering, data_fetching, data_transforms(5), handlers(7)
- [ ] **`src/tools/training-data-helper/components/BatchSelector.tsx`** (615 LOC) — jsx_rendering, data_transforms(8), handlers(5)
- [ ] **`src/tools/image-generation/pages/ImageGenerationToolPage.tsx`** (1173 LOC) — jsx_rendering, data_fetching, handlers(15)
- [ ] **`src/tools/join-clips/pages/JoinClipsPage.tsx`** (488 LOC) — jsx_rendering, data_fetching, data_transforms(10)
- [ ] **`src/tools/character-animate/pages/CharacterAnimatePage.tsx`** (940 LOC) — jsx_rendering, data_fetching, handlers(15)
- [ ] **`src/tools/edit-video/pages/EditVideoPage.tsx`** (749 LOC) — jsx_rendering, data_fetching, handlers(8)

*Plus 32 more.*

---
## 9. Bloated Prop Interfaces (>10 props)

Interfaces with many props suggest the component does too much,
or needs composition (children/render props) or context instead of drilling.

- [ ] `UseLightboxLayoutPropsInput` in **`src/shared/components/MediaLightbox/hooks/useLightboxLayoutProps.ts`** — 203 props (line 24)
- [ ] `ShotImagesEditorProps` in **`src/tools/travel-between-images/components/ShotImagesEditor/types.ts`** — 76 props (line 14)
- [ ] `TimelineProps` in **`src/tools/travel-between-images/components/Timeline.tsx`** — 69 props (line 37)
- [ ] `ControlsPanelProps` in **`src/shared/components/MediaLightbox/components/ControlsPanel.tsx`** — 64 props (line 31)
- [ ] `TimelineContainerProps` in **`src/tools/travel-between-images/components/Timeline/TimelineContainer/types.ts`** — 63 props (line 16)
- [ ] `MediaGalleryProps` in **`src/shared/components/MediaGallery/types.ts`** — 58 props (line 121)
- [ ] `BatchModeContentProps` in **`src/tools/travel-between-images/components/ShotImagesEditor/components/BatchModeContent.tsx`** — 56 props (line 16)
- [ ] `MediaLightboxProps` in **`src/shared/components/MediaLightbox/MediaLightbox.tsx`** — 54 props (line 28)
- [ ] `UseSharedLightboxStateProps` in **`src/shared/components/MediaLightbox/hooks/useSharedLightboxState.ts`** — 52 props (line 56)
- [ ] `MediaGalleryItemProps` in **`src/shared/components/MediaGalleryItem/types.ts`** — 51 props (line 3)
- [ ] `JoinClipsSettingsFormProps` in **`src/shared/components/JoinClipsSettingsForm/types.ts`** — 50 props (line 20)
- [ ] `VideoEditPanelProps` in **`src/shared/components/MediaLightbox/components/VideoEditPanel.tsx`** — 47 props (line 30)
- [ ] `BatchSettingsFormProps` in **`src/tools/travel-between-images/components/BatchSettingsForm.tsx`** — 46 props (line 25)
- [ ] `VideoLightboxProps` in **`src/shared/components/MediaLightbox/VideoLightbox.tsx`** — 46 props (line 59)
- [ ] `ShotImageManagerProps` in **`src/shared/components/ShotImageManager/types.ts`** — 46 props (line 21)
- [ ] `ImageLightboxProps` in **`src/shared/components/MediaLightbox/ImageLightbox.tsx`** — 45 props (line 61)
- [ ] `EditModePanelProps` in **`src/shared/components/MediaLightbox/components/EditModePanel.tsx`** — 43 props (line 26)
- [ ] `MediaGalleryLightboxProps` in **`src/shared/components/MediaGallery/components/MediaGalleryLightbox.tsx`** — 41 props (line 16)
- [ ] `MediaDisplayWithCanvasProps` in **`src/shared/components/MediaLightbox/components/MediaDisplayWithCanvas.tsx`** — 39 props (line 7)
- [ ] `SegmentSettingsFormProps` in **`src/shared/components/SegmentSettingsForm/types.ts`** — 39 props (line 10)

*Plus 119 more.*

---
## 10. Single-Use Abstractions

Files exported but imported by exactly one other file.
Consider inlining into the sole consumer to reduce indirection.

- [ ] **`src/shared/components/MediaGallery/utils/mediaGallery-constants.ts`** (299 LOC) → only used by `src/shared/components/MediaGallery/utils/index.ts`
- [ ] **`src/tools/travel-between-images/components/ShotImagesEditor/components/BatchModeContent.tsx`** (294 LOC) → only used by `src/tools/travel-between-images/components/ShotImagesEditor/components/index.ts`
- [ ] **`src/shared/hooks/use-voice-recording.ts`** (292 LOC) → only used by `src/shared/components/ui/ai-input-button.tsx`
- [ ] **`src/app/App.tsx`** (291 LOC) → only used by `src/app/main.tsx`
- [ ] **`src/shared/lib/tasks/zImageTurboI2I.ts`** (288 LOC) → only used by `src/shared/components/MediaLightbox/hooks/useImg2ImgMode.ts`
- [ ] **`src/shared/components/ImageGenerationForm/hooks/useGenerationSource.ts`** (288 LOC) → only used by `src/shared/components/ImageGenerationForm/hooks/index.ts`
- [ ] **`src/shared/components/LoraSelectorModal/components/MyLorasTab/MyLorasTab.tsx`** (287 LOC) → only used by `src/shared/components/LoraSelectorModal/components/MyLorasTab/index.tsx`
- [ ] **`src/shared/components/PhaseConfigSelectorModal/PhaseConfigSelectorModal.tsx`** (286 LOC) → only used by `src/shared/components/PhaseConfigSelectorModal/index.tsx`
- [ ] **`src/tools/training-data-helper/components/VideoSegmentEditor/components/SegmentFormDialog.tsx`** (285 LOC) → only used by `src/tools/training-data-helper/components/VideoSegmentEditor/VideoSegmentEditor.tsx`
- [ ] **`src/shared/components/LoraSelectorModal/components/LoraCard.tsx`** (285 LOC) → only used by `src/shared/components/LoraSelectorModal/components/CommunityLorasTab.tsx`
- [ ] **`src/tools/training-data-helper/components/VideoSegmentEditor/components/VideoPlayerControls.tsx`** (284 LOC) → only used by `src/tools/training-data-helper/components/VideoSegmentEditor/VideoSegmentEditor.tsx`
- [ ] **`src/shared/components/ProjectSettingsModal.tsx`** (284 LOC) → only used by `src/shared/components/GlobalHeader.tsx`
- [ ] **`src/shared/components/ReferralModal.tsx`** (283 LOC) → only used by `src/shared/components/GlobalHeader.tsx`
- [ ] **`src/tools/join-clips/components/SortableClip.tsx`** (282 LOC) → only used by `src/tools/join-clips/pages/JoinClipsPage.tsx`
- [ ] **`src/shared/hooks/useVideoHoverPreview.ts`** (281 LOC) → only used by `src/tools/travel-between-images/components/Timeline/GuidanceVideoStrip.tsx`
- [ ] **`src/shared/components/SettingsModal/SettingsModal.tsx`** (281 LOC) → only used by `src/shared/components/SettingsModal/index.tsx`
- [ ] **`src/pages/Home/components/TravelSelector.tsx`** (280 LOC) → only used by `src/pages/Home/components/PhilosophyPane.tsx`
- [ ] **`src/tools/travel-between-images/hooks/useVideoTravelViewMode.ts`** (279 LOC) → only used by `src/tools/travel-between-images/hooks/index.ts`
- [ ] **`src/pages/ShotsPage.tsx`** (279 LOC) → only used by `src/app/routes.tsx`
- [ ] **`src/tools/travel-between-images/components/VideoTravelListHeader.tsx`** (278 LOC) → only used by `src/tools/travel-between-images/pages/ShotListView.tsx`

*Plus 301 more.*

---
## 11. Agent Analysis Targets (top files by cruft score)

These files have the highest concentration of issues. Each entry includes
a pre-written analysis prompt — feed each to an agent for detailed refactoring recommendations.

### 1. `src/shared/components/MediaLightbox/hooks/useLightboxLayoutProps.ts` (score 197)

**521 LOC** | Fan-in: 1 | Fan-out: 12 | 2 dead exports

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaLightbox/hooks/useLightboxLayoutProps.ts (521 lines)
- Dead exports: UseLightboxLayoutPropsInput, UseLightboxLayoutPropsReturn
- Bloated interfaces: UseLightboxLayoutPropsInput(203)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 2. `src/tools/travel-between-images/components/BatchSettingsForm.tsx` (score 111)

**493 LOC** | Fan-in: 3 | Fan-out: 21 | 1 logs, 37 unused

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/travel-between-images/components/BatchSettingsForm.tsx (493 lines)
- Has 1 tagged debug logs to remove
- Has 37 unused declarations
- Complexity: 23 imports
- Bloated interfaces: BatchSettingsFormProps(46)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 3. `src/tools/image-generation/pages/ImageGenerationToolPage.tsx` (score 95)

**1173 LOC** | Fan-in: 1 | Fan-out: 35 | 19 logs, 29 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/image-generation/pages/ImageGenerationToolPage.tsx (1173 lines)
- Has 19 tagged debug logs to remove
- Has 29 unused declarations
- Complexity: 40 imports, 11 useEffects
- God component: 11 useEffects, 21 useStates, 64 custom hooks, 39 total hooks
- Mixed concerns: jsx_rendering, data_fetching, handlers(15)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 4. `src/shared/components/MediaLightbox/ImageLightbox.tsx` (score 89)

**1308 LOC** | Fan-in: 1 | Fan-out: 20 | 18 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaLightbox/ImageLightbox.tsx (1308 lines)
- Has 18 unused declarations
- Complexity: 21 imports, 1 TODOs
- God component: 7 useStates, 36 custom hooks, 14 total hooks
- Mixed concerns: jsx_rendering, data_transforms(3), handlers(9)
- Bloated interfaces: ImageLightboxProps(45)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 5. `src/shared/components/MediaGallery/components/MediaGalleryLightbox.tsx` (score 88)

**723 LOC** | Fan-in: 1 | Fan-out: 12 | 33 logs, 3 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaGallery/components/MediaGalleryLightbox.tsx (723 lines)
- Has 33 tagged debug logs to remove
- Has 3 unused declarations
- Complexity: 6 useEffects, 2 TODOs
- God component: 6 useEffects, 20 custom hooks
- Mixed concerns: jsx_rendering, data_fetching, data_transforms(3)
- Bloated interfaces: MediaGalleryLightboxProps(41)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 6. `src/shared/components/PromptEditorModal.tsx` (score 87)

**772 LOC** | Fan-in: 0 | Fan-out: 17 | 49 logs, 9 unused, 1 dead exports, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/PromptEditorModal.tsx (772 lines)
- Has 49 tagged debug logs to remove
- Has 9 unused declarations
- Dead exports: PromptEditorModalProps
- Complexity: 19 imports, 8 useEffects, 5 inline types
- God component: 8 useEffects, 7 useStates, 28 custom hooks, 21 total hooks
- Mixed concerns: jsx_rendering, data_transforms(17), handlers(19)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 7. `src/tools/travel-between-images/components/Timeline.tsx` (score 87)

**810 LOC** | Fan-in: 0 | Fan-out: 22 | 4 unused, 1 dead exports, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/travel-between-images/components/Timeline.tsx (810 lines)
- Has 4 unused declarations
- Dead exports: TimelineProps
- Complexity: 25 imports, 5 useEffects, 1 TODOs
- God component: 5 useEffects, 30 custom hooks, 10 total hooks
- Mixed concerns: jsx_rendering, data_transforms(6), handlers(8)
- Bloated interfaces: TimelineProps(69)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 8. `src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts` (score 74)

**951 LOC** | Fan-in: 1 | Fan-out: 5 | 70 logs, 2 dead exports

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/travel-between-images/components/ShotEditor/services/applySettingsService.ts (951 lines)
- Has 70 tagged debug logs to remove
- Dead exports: TaskData, ExtractedSettings

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 9. `src/tools/travel-between-images/components/ShotImagesEditor/types.ts` (score 72)

**233 LOC** | Fan-in: 2 | Fan-out: 4 | 3 dead exports

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/travel-between-images/components/ShotImagesEditor/types.ts (233 lines)
- Dead exports: SegmentSlotState, StableCallbackDeps, UsePreviewStateReturn
- Bloated interfaces: ShotImagesEditorProps(76)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 10. `src/shared/components/MediaLightbox/components/EditModePanel.tsx` (score 66)

**890 LOC** | Fan-in: 2 | Fan-out: 22 | 1 logs, 16 unused

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaLightbox/components/EditModePanel.tsx (890 lines)
- Has 1 tagged debug logs to remove
- Has 16 unused declarations
- Complexity: 24 imports, destructure w/13 props
- Bloated interfaces: EditModePanelProps(43)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 11. `src/pages/Home/HomePage.tsx` (score 66)

**638 LOC** | Fan-in: 1 | Fan-out: 16 | 34 logs, 7 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/pages/Home/HomePage.tsx (638 lines)
- Has 34 tagged debug logs to remove
- Has 7 unused declarations
- Complexity: 20 imports, 10 useEffects
- God component: 10 useEffects, 13 useStates, 32 custom hooks, 27 total hooks
- Mixed concerns: jsx_rendering, data_fetching, handlers(6)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 12. `src/shared/components/MediaLightbox/VideoLightbox.tsx` (score 66)

**1096 LOC** | Fan-in: 1 | Fan-out: 19 | 10 unused, god component

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaLightbox/VideoLightbox.tsx (1096 lines)
- Has 10 unused declarations
- Complexity: 21 imports
- God component: 6 useStates, 30 custom hooks
- Bloated interfaces: VideoLightboxProps(46)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 13. `src/shared/components/ShotImageManager/types.ts` (score 65)

**163 LOC** | Fan-in: 8 | Fan-out: 5 | 2 dead exports

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/ShotImageManager/types.ts (163 lines)
- Dead exports: PairOverridesMap, ExternalGeneration
- Bloated interfaces: ShotImageManagerProps(46), BaseShotImageManagerProps(29), ShotBatchItemMobileProps(16)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 14. `src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx` (score 62)

**976 LOC** | Fan-in: 1 | Fan-out: 13 | 23 logs, 3 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx (976 lines)
- Has 23 tagged debug logs to remove
- Has 3 unused declarations
- Complexity: 18 imports, 5 useEffects
- God component: 5 useEffects, 32 custom hooks, 11 total hooks
- Mixed concerns: jsx_rendering, data_fetching, data_transforms(22), handlers(7)
- Bloated interfaces: SegmentOutputStripProps(25)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

### 15. `src/shared/components/MediaGallery/index.tsx` (score 58)

**1094 LOC** | Fan-in: 5 | Fan-out: 21 | 32 logs, 4 unused, god component, mixed concerns

<details>
<summary>Agent prompt</summary>

```
Analyze this file for refactoring opportunities.
File: src/shared/components/MediaGallery/index.tsx (1094 lines)
- Has 32 tagged debug logs to remove
- Has 4 unused declarations
- Complexity: 23 imports, 5 useEffects
- God component: 5 useEffects, 39 custom hooks, 10 total hooks
- Mixed concerns: jsx_rendering, data_transforms(5), handlers(10)

Questions to answer:
1. What are the distinct responsibilities in this file? Could it be split?
2. Are there abstractions that exist for only one caller? Should they be inlined?
3. Is there prop drilling that should use context instead?
4. Are there patterns here that differ from the rest of the codebase?
5. What's the minimal set of changes to improve this file meaningfully?

Provide a specific, actionable refactoring plan — not generic advice.
```
</details>

