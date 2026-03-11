# Agent-Driven Task Creation Architecture

## The Vision

Users can talk to an AI agent (voice or text) that autonomously creates and manages tasks — generating images, creating travel segments, editing shots, rearranging galleries. The agent runs as a persistent loop: it receives a goal, plans, acts, observes results, and keeps going until it's done or the user stops it. It works for many users concurrently.

## Current Task Pipeline

```
UI Button Press
  → Settings resolution (fallback chains, DB lookups)
  → Side effects (prompt enhancement, mask upload, metadata saves)
  → Param building (transformations, format conversion, composition)
  → createTask() POST to create-task edge function
    → tasks table (status=Queued)
      → External GPU worker (Python, polls claim-next-task)
        → complete_task edge function
```

Key facts:
- **One entry point**: `create-task` edge function accepts `{ project_id, task_type, params }`
- **Params are opaque**: stored as-is in JSONB, passed directly to worker
- **Workers are already Python**: Headless-Wan2GP polls `claim-next-task`, processes, calls `complete_task`
- **No Python backend exists today** — just edge functions + external workers
- **Significant pre-work happens before the edge function** — see next section

## What Happens Before the Edge Function (Current)

The `create-task` edge function is dumb — it just inserts a row. All the intelligence lives in the client-side JS helpers that build the params. This is the logic that any new entry point (agent, API, etc.) would need to replicate or share.

### 4 Categories of Pre-Work

#### 1. Settings Resolution (where do values come from?)

Each param has a **fallback priority chain** — the form value is just the top level.

**Travel segments** (most complex):
| Param | Fallback chain |
|-------|---------------|
| prompt | user input → AI enhancement (async `ai-prompt` EF call) → affix with before/after text |
| resolution | form → project defaults → prior orchestrator → hardcoded `902x508` |
| model | form → orchestrator_details.model_name → `wan_2_2_i2v_lightning_baseline_2_2_2` |
| motion_mode | form → contract.motionMode → `basic` |
| amount_of_motion | form (normalized /100) → contract → depends on motion_mode |
| seed | form → random_seed override → orig.seed_to_use → orig.seed → orchDetails.seed_base → `789` |
| LoRAs | form array → contract loras → orig.additional_loras → orchDetails.additional_loras |
| structure_guidance | form → contract → orig → orchDetails |
| parent_generation_id | provided OR **DB lookup**: shot's primary generation |
| child_generation_id | provided OR **DB lookup**: by pair_shot_generation_id OR by segment_index+order |

**Image generation** (medium):
| Param | Fallback chain |
|-------|---------------|
| prompt | user input → affix with before/after text + style boost terms |
| resolution | custom → aspect_ratio_map → project default; then × resolution_scale |
| task_type | derived from model_name + has_style_reference (5 possible types) |
| seed | `Math.random()` per image (no fallback) |
| reference params | filtered by reference_mode (style-only excludes subject, etc.) |
| hires params | conditional on local generation + hires enabled |
| LoRA format | `[{path, strength}]` → `{path: strength}` map; hires: `{path: "phase1;phase2"}` |

**Image edit** (simplest params, but has mask upload):
| Param | Source |
|-------|--------|
| image_url | active variant URL or generation URL |
| mask_url | **exported from Konva canvas → uploaded to Supabase storage** |
| generation_id | resolved via `getGenerationId(media)` helper |
| based_on | = generation_id (for variant tracking) |
| hires_fix | converted from advancedSettings format |
| everything else | 1:1 field mapping from form state |

#### 2. Transformations (format conversions)

- `amountOfMotion`: slider 0-100 → normalized 0-1
- LoRAs: `[{ path, strength }]` → `{ path: strength }` map
- Hires LoRAs: `{ path: "phase1Strength;phase2Strength" }` (special format)
- Prompts: joined with task-specific separators (`segment_space` vs `batch_comma`)
- Phase config: `mode` field stripped (backend derives from model)
- Legacy cleanup: multiple passes to strip deprecated params
- Resolution: string `"1280x720"` calculated from project defaults × scale factors

#### 3. Database Lookups

| Task type | What's looked up | Why |
|-----------|-----------------|-----|
| Travel | Parent generation from shot | Need FK for generation lineage |
| Travel | Child generation by pair ID or segment order | Determines variant vs new child creation |
| Travel | Project resolution | Fallback if not specified |
| Travel | Shot settings / pair metadata | Load saved defaults |
| Image gen | Project resolution | Base for scaling |
| Image edit | Generation ID from media object | Need FK for variant tracking |

#### 4. Side Effects (things that happen beyond task creation)

| Side effect | Task type | Blocking? |
|-------------|-----------|-----------|
| AI prompt enhancement (`ai-prompt` EF) | Travel | No — falls back to original prompt on failure |
| Save enhanced prompt to shot_generations metadata | Travel | No — non-fatal |
| Save segment settings to shot_generations | Travel | **Yes** — blocks on failure |
| Upload mask PNG to Supabase storage | Image edit | **Yes** — must succeed before task creation |
| Query invalidation (React Query) | All | No — post-creation UI update |

### Key Files

| File | Role |
|------|------|
| `src/shared/lib/tasks/individualTravelSegment.ts` | Travel: DB lookups, resolution, validation |
| `src/shared/lib/tasks/segmentTaskPayload.ts` | Travel: param building with fallback chains |
| `src/domains/media-lightbox/components/submitSegmentTask.ts` | Travel: orchestrates enhancement + settings save + param build |
| `src/shared/lib/tasks/imageGeneration.ts` | Image gen: resolution calc, model→taskType mapping, batch loop |
| `src/shared/components/ImageGenerationForm/hooks/formSubmission/submissionTaskPlan.ts` | Image gen: reference/hires/prompt composition |
| `src/shared/lib/tasks/maskedEditTaskBuilder.ts` | Edit: param composition, batch loop |
| `src/domains/media-lightbox/hooks/inpainting/useTaskGeneration.ts` | Edit: mask export + upload orchestration |
| `src/shared/lib/tasks/taskRequestComposer.ts` | Shared: `composeTaskParams()` merges segments + mapped fields |
| `src/shared/lib/taskCreation/createTask.ts` | Final POST to edge function |

---

## Agent Architecture

### The Agent Loop

The agent is not request-response. It's an **autonomous loop** that keeps working until done or cancelled.

```
User: "Generate 20 unique character concepts for a cyberpunk film"

Turn 1: Plan approach → generate prompt → create_image task → wait for completion
Turn 2: Observe result → "good lighting, needs more variety" → adjust prompt → create_image → wait
Turn 3: Observe → "too similar to turn 1" → shift concept → create_image → wait
...
Turn 20: Done (or user cancels at any point)
```

Each turn follows the cycle:

```
PLAN → ACT → WAIT → OBSERVE → DECIDE → (loop or stop)
```

The **observation step** is what makes this intelligent rather than a batch for-loop. The agent can see results (via vision models), compare to prior outputs, adjust strategy, or switch task types entirely ("this needs an edit, not a regeneration").

### Event-Driven, Not Polling

Most of the time, the agent is **waiting for a GPU task** (30s-5min). It should NOT be a running process sitting idle.

Each turn is a **short-lived job** (~2-10s of LLM calls). When a turn creates a GPU task, the job exits. When the GPU task completes, `complete_task` triggers the next turn job.

```
Turn job runs (2-5s):
  1. Load run context
  2. LLM call: "what next?"
  3. Create GPU task via build-task-params → create-task
  4. Save turn state, EXIT

... GPU processes for 30s-300s ...

complete_task fires:
  → normal generation handling (existing)
  → check: is this task linked to an agent turn?
  → if yes: queue next turn job

Next turn job runs (2-5s):
  1. Load result + history
  2. VLM call: observe the output
  3. LLM call: decide next action
  4. Create next task or finish
  5. EXIT
```

Zero idle processes. The agent only consumes compute when it's actually thinking.

### Multi-Tenant Scaling

Many users run agent loops concurrently. A worker pool processes turn jobs from any user:

```
┌──────────────────────────────────────────────────────┐
│  Agent Service (Python)                               │
│                                                       │
│  Job Queue (Redis/Celery or DB-backed)                │
│  ┌──────────────────────────────────────────────────┐ │
│  │ turn(user_A, run=1, turn=4)                      │ │
│  │ turn(user_B, run=3, turn=12)                     │ │
│  │ turn(user_C, run=1, turn=1)                      │ │
│  └──────────────────────┬───────────────────────────┘ │
│                         │                              │
│  Worker Pool            │                              │
│  ┌──────────────────────▼───────────────────────────┐ │
│  │ Worker 1: user_A turn → Claude call → done (3s)  │ │
│  │ Worker 2: user_C turn → GPT-4o vision → done (4s)│ │
│  │ Worker 3: idle                                    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  Model Router                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Planning:     Claude Sonnet / GPT-4o             │ │
│  │ Deciding:     Claude Sonnet / GPT-4o             │ │
│  │ Observation:  Claude Sonnet / GPT-4o (vision)    │ │
│  │ Prompting:    Claude / GPT-4o (creative)         │ │
│  │ Quick checks: Haiku / GPT-4o-mini (cheap/fast)   │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Each turn takes 2-5s. 10 workers ≈ 200 turns/minute ≈ hundreds of concurrent users. The bottleneck is LLM API rate limits, not compute.

### DB Access: Read and Write

The agent needs **live database access**, not just read-only snapshots. It needs to:

**Read** (to understand current state):
- Shots: list, order, names, settings
- Generations: images in each shot, URLs, metadata, variants
- Project settings: resolution defaults, model preferences
- Task history: what's been generated, what's in progress

**Write** (to manage project state beyond task creation):
- Set primary image on a shot (swap which generation is "active")
- Reorder shots
- Update shot names/metadata
- Delete generations that don't meet quality bar
- Update generation metadata (tags, notes)
- Move generations between shots

This means the agent isn't just a task creator — it's a **project manager** that can organize and curate the gallery as it works. Example flow:

```
User: "Fill in the gaps in my storyboard — generate images for empty shots 3, 5, 7
       that match the style of shot 1"

Turn 1: Read shots → identify shot 1's style → read shot 1's primary image
Turn 2: Analyze shot 1 image (VLM) → extract style description
Turn 3: Generate image for shot 3 (matching style) → wait
Turn 4: Observe result → looks good → set as shot 3's primary image
Turn 5: Generate for shot 5 → wait
Turn 6: Observe → too different → generate variant → wait
Turn 7: Observe variant → better → set as primary, delete first attempt
Turn 8: Generate for shot 7 → wait
Turn 9: Observe → done
```

**Implementation**: The agent backend uses a **Supabase service-role client** for DB access. This is the same pattern as the GPU workers — trusted server with full access. Operations that modify user data are scoped to the user's project and logged in agent_turns for auditability.

The agent's DB write tools:

```python
TOOLS = [
    # --- Read ---
    { "name": "list_shots", ... },
    { "name": "get_shot_images", ... },
    { "name": "get_project_settings", ... },
    { "name": "get_generation_details", ... },

    # --- Task creation ---
    { "name": "create_travel_segment", ... },
    { "name": "create_image_generation", ... },
    { "name": "create_image_edit", ... },

    # --- Project management (DB writes) ---
    { "name": "set_primary_image",
      "description": "Set which generation is the primary/active image for a shot",
      "parameters": { "shot_id": "uuid", "generation_id": "uuid" } },
    { "name": "reorder_shots",
      "description": "Change the order of shots in the project",
      "parameters": { "shot_ids": ["uuid array in desired order"] } },
    { "name": "update_shot",
      "description": "Update shot name or metadata",
      "parameters": { "shot_id": "uuid", "name": "string", ... } },
    { "name": "delete_generation",
      "description": "Remove a generation from the project",
      "parameters": { "generation_id": "uuid" } },
    { "name": "move_generation",
      "description": "Move a generation from one shot to another",
      "parameters": { "generation_id": "uuid", "target_shot_id": "uuid" } },

    # --- Reference management (writes back to project's reference system) ---
    { "name": "add_project_reference",
      "description": "Add a generation as a reusable style/subject reference in the project",
      "parameters": {
          "generation_id": "uuid",
          "reference_mode": "style | subject | scene",
          "style_reference_strength": 1.1,
          "subject_description": "optional — what subject to extract",
          "style_boost_terms": "optional — comma-separated style terms" } },
    { "name": "select_reference_for_shot",
      "description": "Set which reference is active for a specific shot",
      "parameters": { "shot_id": "uuid", "reference_id": "uuid" } },
]
```

These write operations should go through **edge functions or RPCs** (not raw SQL from the agent) so that auth, RLS, and invariants are enforced consistently regardless of who's calling.

### Shared Param-Building Layer

The pre-edge-function param logic (fallback chains, DB lookups, format conversions) should be shared between the UI and the agent via a **`build-task-params` edge function**:

```
UI Button → (collect form state) → build-task-params EF → create-task EF
Agent     → (LLM decides)        → build-task-params EF → create-task EF
```

The EF accepts simplified intent and handles all the complexity:
- Fallback chains for every param
- DB lookups (parent/child generations, project resolution)
- Format conversions (LoRA maps, motion normalization, legacy stripping)
- Validation

The agent doesn't need to know about LoRA format conversion or legacy param stripping. It sends `{ type: "travel", start_gen: "uuid", end_gen: "uuid", prompt: "...", num_frames: 49 }` and the EF does the rest.

### Persistence & Recovery

Agent runs survive server restarts. All state lives in the DB:

```sql
agent_runs:
  id, project_id, user_id
  status: running | paused | completed | cancelled | failed
  goal: text                    -- original user instruction
  config: jsonb                 -- max_turns, model preferences, constraints
  summary: jsonb                -- condensed history for LLM context window
  current_turn: int
  max_turns: int | null         -- null = run until cancelled
  created_at, updated_at

agent_turns:
  id, run_id, turn_number
  phase: planning | acting | waiting | observing | deciding | complete
  reasoning: text               -- LLM's thinking (shown to user)
  action: jsonb                 -- what was done
  task_id: uuid | null          -- FK to tasks table if GPU task created
  observation: jsonb            -- VLM output, metadata
  decision: text                -- continue | adjust | done | ask_user
  created_at, completed_at
```

If the server crashes: load run → find last turn → check phase → resume. If it was "waiting", the `complete_task` trigger will re-queue when the GPU task finishes.

### Cancellation

- **Soft**: finish current task, don't start next turn. Agent checks `agent_runs.status` before each turn.
- **Hard**: cancel in-progress GPU task too (update `tasks.status` to `Cancelled`).
- Frontend shows stop button. User can also give mid-run feedback ("more like turn 3, less like turn 5") which gets injected into the next turn's LLM context.

### LLM Context Management

The agent isn't one long conversation. Each turn gets a **condensed context**:

```python
context = {
    "goal": run.goal,
    "turn": run.current_turn,
    "plan": run.current_plan,
    "recent_turns": last_3_turns_with_details,
    "summary": "Turns 1-7: generated 7 character concepts. Turns 1-3 were too similar
                (all male, dark clothing). Turn 4+ shifted to more variety. Turn 6 was
                the strongest (neon samurai). Turn 7 tried female character, good result.",
    "project_state": current_shots_and_images,
}
```

The summary is updated every N turns (or when strategy shifts) by a cheap LLM call that compresses history. This keeps token usage bounded even for 100+ turn runs.

### Creative Context & Style Tracking

The agent maintains a **running creative context** — an evolving set of preferences that accumulate from the initial goal, observed results, and user nudges. This mirrors the existing reference system (`ReferenceImage` pointers with mode/strengths/descriptions stored in `projects.settings`) but is more fluid — it evolves continuously as the agent works.

#### The Creative Context Object

Stored in `agent_runs.summary` alongside the turn history:

```python
creative_context = {
    # Accumulated style direction (from observations + user nudges)
    "style_notes": [
        {"turn": 3, "note": "warm golden tones work well"},
        {"turn": 5, "note": "user wants figure prominent in frame"},
        {"turn": 7, "note": "shift darker/more ominous"},
    ],

    # Active reference image (maps to existing ReferenceImage system)
    "reference": {
        "generation_id": "uuid-from-turn-5",
        "image_url": "...",
        "mode": "style",              # style | subject | scene
        "style_strength": 1.1,
        "subject_description": None,
        "locked": True,               # user explicitly said "use this"
    },

    # Prompt modifiers that accumulate from feedback
    "prompt_modifiers": [
        "warm golden tones",
        "figure prominent in lower third",
        "darker, more ominous mood",
    ],

    # What to avoid (learned from negative feedback + observation)
    "avoid": [
        "figure too small in frame",
        "overly bright/washed out",
    ],

    # Liked/disliked outputs for VLM comparison
    "exemplars": {
        "positive": ["turn-5-gen-uuid", "turn-8-gen-uuid"],
        "negative": ["turn-3-gen-uuid"],
    }
}
```

When the agent builds a prompt, it feeds this context to the LLM alongside the task goal:

```
Style direction so far:
- Warm golden tones (user liked this)
- Figure should be prominent
- Shifting darker/more ominous
- Avoid: figure too small, washed out

Reference image: [VLM description of turn 5's output]
Liked examples: [VLM descriptions of positive exemplars]
Disliked: [VLM descriptions of negative exemplars]
```

And when creating tasks, the agent passes the active reference as actual task params — the same `style_reference_image`, `style_reference_strength`, `reference_mode` fields that the UI passes today.

#### User Feedback / Nudges

Users can give mid-run feedback that reshapes the creative context:

| Nudge | Agent response |
|-------|---------------|
| "I like this one" | Adds to positive exemplars, may set as reference |
| "More like turn 3, less like turn 5" | VLM extracts style differences, adjusts prompt modifiers |
| "Warmer colors" | Adds to prompt_modifiers |
| "Use this as the style reference" | Sets `reference` with `locked: true`, applies to all subsequent tasks |
| "This character but in different scenes" | Switches reference to subject mode, extracts subject_description via VLM |
| "Too similar, more variety" | Agent increases prompt divergence strategy |
| "Stop generating, just organize what we have" | Agent shifts from creation to curation mode (reorder, set primaries, delete weak) |

Feedback is injected at the start of the next turn:

```
Frontend → POST /agent/feedback { run_id, message: "darker, more ominous" }
  → Stored in pending_feedback on agent_runs

Next turn job starts:
  1. Check pending_feedback
  2. LLM call: "User says 'darker, more ominous'. Update creative context."
  3. Context updated → affects all subsequent turns
```

Users can also point at specific outputs — "more like this one" with a generation ID. The agent resolves it, runs VLM to understand why it's good, and updates the context accordingly.

#### Writing Back to the Project Reference System

The agent doesn't just track references internally — it **writes them back** to the project's reference system so they persist after the run ends and the user can reuse them from the UI.

When the agent locks a style reference:

```python
# Agent identifies a strong reference (user said "use this" or agent decided it's the best)
async def set_style_reference(self, generation_id: str, mode: str, strength: float):
    # 1. Update internal creative context
    self.creative_context["reference"] = {
        "generation_id": generation_id,
        "mode": mode,
        "style_strength": strength,
        "locked": True,
    }

    # 2. Write back to project's reference system
    #    Creates a ReferenceImage pointer in projects.settings['project-image-settings'].references
    #    Same data structure the UI uses
    await self.tools.add_project_reference(
        project_id=self.run.project_id,
        generation_id=generation_id,
        reference_mode=mode,
        style_reference_strength=strength,
        subject_description=self.creative_context["reference"].get("subject_description"),
        style_boost_terms=", ".join(self.creative_context["prompt_modifiers"]),
        source="agent",  # tag so UI can show "added by agent"
    )

    # 3. Optionally set as the selected reference for the current shot
    await self.tools.select_reference_for_shot(
        project_id=self.run.project_id,
        shot_id=current_shot_id,
        reference_id=new_reference_id,
    )
```

This means:
- After an agent run, the user opens the reference grid and sees the agent's best discoveries alongside their own uploads
- The accumulated `prompt_modifiers` are written as `styleBoostTerms` on the reference — so the user gets "warm golden tones, figure prominent, darker mood" pre-filled
- The `subject_description` from VLM analysis is written back too — the user doesn't have to re-describe the subject
- References are tagged with `source: "agent"` so the UI can distinguish agent-discovered references from user-uploaded ones

The write-back also works the other direction — if the user manually selects a different reference in the UI mid-run, the agent picks it up on the next turn (reads `selectedReferenceIdByShot` from project settings) and updates its creative context to match.

#### Mapping to Existing Reference System

| Agent concept | Existing system (`ReferenceImage`) |
|--------------|-----------------------------------|
| `reference.generation_id` | `resourceId` → `selectedReferenceIdByShot` |
| `reference.mode` | `referenceMode` (style/subject/scene/custom) |
| `reference.style_strength` | `styleReferenceStrength` |
| `reference.subject_description` | `subjectDescription` → `effectiveSubjectDescription` |
| `prompt_modifiers` | `styleBoostTerms` |
| `reference.locked` | No equivalent — new concept (agent-specific) |
| `exemplars.positive/negative` | No equivalent — agent-only for LLM context |

---

## Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (React)                                         │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────────┐  │
│  │ UI Buttons│  │ Agent Chat/   │  │ Gallery + Status  │  │
│  │ (existing)│  │ Voice Panel   │  │ (existing)        │  │
│  └─────┬─────┘  └──────┬────────┘  └────────▲──────────┘  │
│        │               │ start/stop/feedback │ realtime    │
└────────┼───────────────┼─────────────────────┼─────────────┘
         │               │                     │
         │               ▼                     │
         │  ┌────────────────────────┐         │
         │  │  Agent Service (Python) │         │
         │  │  - Job queue + workers  │         │
         │  │  - LLM/VLM calls        │         │
         │  │  - DB read/write         │─── Supabase DB (service-role)
         │  │  - Model router          │         │
         │  └────────────┬────────────┘         │
         │               │                     │
         │               │ simplified intent   │
         │               ▼                     │
         │  ┌────────────────────────┐         │
         │  │  build-task-params EF   │         │
         │  │  (shared param builder) │         │
         │  └────────────┬────────────┘         │
         │               │                     │
         ▼               ▼                     │
    ┌────────────────────────────────┐         │
    │  create-task EF                 │         │
    │  → tasks table                  │─────────┘
    │  → GPU workers (existing)       │
    │  → complete_task EF             │
    │      └→ triggers next agent turn│
    └─────────────────────────────────┘
```

---

## Design Decisions

### Q1: Edge function vs Python for shared param-building?

**Edge function.** The param logic is TypeScript today and ports cleanly to Deno. The EF has direct DB access. Agent reasoning stays in Python. Don't mix concerns.

### Q2: Where does voice capture happen?

**Frontend.** Browser has the mic. Transcribe (Deepgram/Whisper) → send text to agent service. TTS for responses optional.

### Q3: How does the agent access the DB?

**Service-role Supabase client in the agent backend**, same pattern as GPU workers. Scoped to user's project. Write operations go through edge functions/RPCs where possible to maintain auth invariants. All actions logged in `agent_turns` for auditability.

### Q4: Mask generation for agent-driven edits?

Near-term: **hybrid** — agent sets up the edit, hands off to UI for mask drawing. Later: SAM/GroundingDINO for text-described masks generated server-side.

---

## Implementation Phases

### Phase 1: Agent Backend Core
- [ ] Python service (FastAPI) with job queue (Celery/Redis or DB-backed)
- [ ] Agent loop: plan → act → wait → observe → decide
- [ ] Model router with Claude + GPT-4o support
- [ ] DB read tools: list_shots, get_images, get_project_settings
- [ ] Task creation via build-task-params EF (start with image gen, simplest)
- [ ] `complete_task` trigger to queue next agent turn
- [ ] `agent_runs` + `agent_turns` tables

### Phase 2: DB Write Tools + Chat UI
- [ ] Write tools: set_primary_image, reorder_shots, delete_generation, move_generation
- [ ] Edge functions/RPCs backing the write tools
- [ ] Chat panel in frontend (text input, turn feed, stop button)
- [ ] SSE/WebSocket for streaming agent status to frontend

### Phase 3: build-task-params EF
- [ ] Start with image gen params (simplest)
- [ ] Add image edit params
- [ ] Add travel segment params (most complex)
- [ ] Migrate frontend JS helpers to call the EF

### Phase 4: Voice
- [ ] Mic capture + STT (Deepgram/Whisper)
- [ ] Agent responses via TTS (optional)
- [ ] Push-to-talk or VAD

### Phase 5: Creative Context & Feedback
- [ ] Creative context object (style_notes, prompt_modifiers, exemplars, avoid list)
- [ ] Mid-run user feedback injection (POST /agent/feedback → pending_feedback → next turn)
- [ ] VLM observation on results (style extraction, quality evaluation)
- [ ] Reference write-back: add_project_reference, select_reference_for_shot
- [ ] Bidirectional sync: agent reads user's manual reference changes, user sees agent's discoveries
- [ ] Accumulated prompt_modifiers → styleBoostTerms write-back on reference

### Phase 6: Advanced
- [ ] Multi-step workflows (generate → evaluate → edit → travel)
- [ ] Server-side mask generation (SAM) for agent-driven edits
- [ ] Per-user model preferences
- [ ] Cost estimation and approval gates for expensive runs
- [ ] Agent-discovered references tagged with `source: "agent"` in UI
