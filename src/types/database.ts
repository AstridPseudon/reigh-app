// Database types extracted from schema - for TypeScript only
// This file provides type safety without Drizzle ORM dependencies

// Enums
export const TASK_STATUS = {
  QUEUED: 'Queued',
  IN_PROGRESS: 'In Progress', 
  COMPLETE: 'Complete',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

type CreditLedgerType = 'stripe' | 'manual' | 'spend' | 'refund';
type TaskParamRecord = Record<string, unknown>;

export const KNOWN_TASK_TYPES = {
  TRAVEL_ORCHESTRATOR: 'travel_orchestrator',
  INDIVIDUAL_TRAVEL_SEGMENT: 'individual_travel_segment',
  TRAVEL_SEGMENT: 'travel_segment',
  TRAVEL_STITCH: 'travel_stitch',
  JOIN_CLIPS_ORCHESTRATOR: 'join_clips_orchestrator',
  JOIN_CLIPS_SEGMENT: 'join_clips_segment',
  EDIT_VIDEO_ORCHESTRATOR: 'edit_video_orchestrator',
  EDIT_VIDEO_SEGMENT: 'edit_video_segment',
  VIDEO_ENHANCE: 'video_enhance',
  ANIMATE_CHARACTER: 'animate_character',
  CHARACTER_ANIMATE: 'character_animate',
  IMAGE_GENERATION: 'image_generation',
  SINGLE_IMAGE: 'single_image',
  Z_IMAGE_TURBO: 'z_image_turbo',
  QWEN_IMAGE: 'qwen_image',
  QWEN_IMAGE_2512: 'qwen_image_2512',
  WAN_2_2_T2I: 'wan_2_2_t2i',
  IMAGE_INPAINT: 'image_inpaint',
  ANNOTATED_IMAGE_EDIT: 'annotated_image_edit',
  QWEN_IMAGE_EDIT: 'qwen_image_edit',
  QWEN_IMAGE_STYLE: 'qwen_image_style',
  Z_IMAGE_TURBO_I2I: 'z_image_turbo_i2i',
  EDIT_TRAVEL_KONTEXT: 'edit_travel_kontext',
  EDIT_TRAVEL_FLUX: 'edit_travel_flux',
  EXTRACT_FRAME: 'extract_frame',
  GENERATE_OPENPOSE: 'generate_openpose',
  RIFE_INTERPOLATE_IMAGES: 'rife_interpolate_images',
  WGP: 'wgp',
} as const;

export type KnownTaskType = typeof KNOWN_TASK_TYPES[keyof typeof KNOWN_TASK_TYPES];
export type TaskType = KnownTaskType | (string & { readonly __taskTypeBrand?: never });

export interface IndividualTravelSegmentTaskParams extends TaskParamRecord {
  segment_index?: number;
  start_image_generation_id?: string;
  end_image_generation_id?: string;
  individual_segment_params?: TaskParamRecord;
}

export interface JoinClipsOrchestratorTaskParams extends TaskParamRecord {
  clip_ids?: string[];
  orchestrator_task_id?: string;
}

export interface VideoEnhanceTaskParams extends TaskParamRecord {
  video_url?: string;
  enhancement_mode?: string;
}

export interface ImageGenerationTaskParams extends TaskParamRecord {
  prompt?: string;
  negative_prompt?: string;
  seed?: number;
}

export interface ImageEditTaskParams extends TaskParamRecord {
  prompt?: string;
  image_url?: string;
  mask_url?: string;
}

export interface CharacterAnimateTaskParams extends TaskParamRecord {
  prompt?: string;
  image_url?: string;
}

export type TaskParams =
  | IndividualTravelSegmentTaskParams
  | JoinClipsOrchestratorTaskParams
  | VideoEnhanceTaskParams
  | ImageGenerationTaskParams
  | ImageEditTaskParams
  | CharacterAnimateTaskParams
  | TaskParamRecord;

// Core table types (matching your database structure)
export interface User {
  id: string;
  name?: string;
  email?: string;
  username?: string;
  api_keys?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  credits: number;
}

export interface Project {
  id: string;
  name: string;
  user_id: string;
  aspect_ratio: string;
  created_at: string;
  updated_at?: string;
  settings?: Record<string, unknown>;
}

/** Raw DB row shape for shots table. App code should use Shot from @/types/shot instead. */
interface _DbShot {
  id: string;
  name: string;
  project_id: string;
  aspect_ratio?: string | null;
  created_at: string;
  updated_at?: string;
  settings?: Record<string, unknown>;
}

export interface Generation {
  id: string;
  location?: string;
  type?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  params?: Record<string, unknown>;
  project_id: string;
  tasks?: string[];
  starred?: boolean;
  name?: string; // Optional variant name
}

export interface ShotGeneration {
  id: string;
  shot_id: string;
  generation_id: string;
  timeline_frame?: number; // Now nullable for unpositioned associations
}

export interface Task {
  id: string;
  taskType: TaskType;
  params: TaskParams;
  status: TaskStatus;
  dependantOn?: string[];
  outputLocation?: string;
  createdAt: string;
  updatedAt?: string;
  projectId: string;
  costCents?: number;
  generationStartedAt?: string;
  generationProcessedAt?: string;
  errorMessage?: string;
}

export interface Worker {
  id: string;
  last_heartbeat: string;
  status: string;
  metadata?: Record<string, unknown>;
}

interface _CreditLedger {
  id: string;
  user_id: string;
  amount: number;
  type: CreditLedgerType;
  description?: string;
  created_at: string;
  stripe_payment_intent_id?: string;
}



interface _UserAPIToken {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
}

export interface Resource {
  id: string;
  user_id: string;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Training data types
export interface TrainingDataBatch {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

interface _TrainingData {
  id: string;
  batch_id: string;
  filename: string;
  url: string;
}

export interface TrainingDataSegment {
  id: string;
  video_id: string;
  start_time: number;
  end_time: number;
} 
