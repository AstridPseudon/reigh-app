import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

function loadEnv(filepath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        vars[match[1].trim()] = val;
      }
    });
  } catch { /* ignore */ }
  return vars;
}
const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const sb = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

const SHOT_ID = '3e4e9f9e-bd93-430e-bb16-955645be6fe1';

async function main() {
  // 1. Current positioned timeline images
  const { data: timeline } = await sb
    .from('shot_generations')
    .select('id, generation_id, timeline_frame')
    .eq('shot_id', SHOT_ID)
    .gte('timeline_frame', 0)
    .order('timeline_frame');
  if (!timeline) { console.log('No timeline data'); return; }

  const genIds = timeline.map(t => t.generation_id);
  const { data: gens } = await sb.from('generations').select('id, based_on, params').in('id', genIds);
  const genMap = new Map((gens || []).map(g => [g.id, g]));

  console.log('=== POSITIONED TIMELINE (' + timeline.length + ' images) ===');
  timeline.forEach(sg => {
    const g = genMap.get(sg.generation_id);
    console.log(
      'sg:' + sg.id.substring(0, 8),
      'gen:' + sg.generation_id.substring(0, 8),
      'based_on:' + (g?.based_on?.substring(0, 8) || 'NULL'),
      'frame:' + sg.timeline_frame
    );
  });

  // 2. ALL shot_generations for this shot (including unpositioned)
  const { data: allShotGens } = await sb
    .from('shot_generations')
    .select('id, generation_id, timeline_frame')
    .eq('shot_id', SHOT_ID);

  const unpositioned = (allShotGens || []).filter(sg => sg.timeline_frame == null);
  console.log('\n=== UNPOSITIONED SHOT_GENERATIONS (' + unpositioned.length + ') ===');
  unpositioned.forEach(sg => {
    console.log('sg:' + sg.id.substring(0, 8), 'gen:' + sg.generation_id.substring(0, 8));
  });

  // 3. Find all segment generations for this shot
  // Segments are child generations with parent_generation_id pointing to a generation in this shot
  // They're also identified by having pair_shot_generation_id set, or by being travel task outputs
  const allGenIds = (allShotGens || []).map(sg => sg.generation_id);
  const { data: segments } = await sb
    .from('generations')
    .select('id, pair_shot_generation_id, based_on, params, type, child_order')
    .not('pair_shot_generation_id', 'is', null);

  // Filter to segments that reference shot_generations in this shot
  const allShotGenIds = new Set((allShotGens || []).map(sg => sg.id));
  const relevantSegments = (segments || []).filter(s =>
    allShotGenIds.has(s.pair_shot_generation_id)
  );

  console.log('\n=== SEGMENTS WITH FK TO THIS SHOT (' + relevantSegments.length + ') ===');
  relevantSegments.forEach(s => {
    const targetSg = (allShotGens || []).find(sg => sg.id === s.pair_shot_generation_id);
    console.log(
      'seg:' + s.id.substring(0, 8),
      'fk→sg:' + s.pair_shot_generation_id.substring(0, 8),
      'target_frame:' + (targetSg?.timeline_frame ?? 'NOT_FOUND'),
      'child_order:' + s.child_order,
      'type:' + s.type
    );
  });

  // 4. Also find segments with NULL FK that might be for this shot (child_order-based)
  // These are segments whose parent_generation_id is in this shot
  const { data: nullFkSegments } = await sb
    .from('generations')
    .select('id, pair_shot_generation_id, based_on, params, type, child_order, parent_generation_id')
    .is('pair_shot_generation_id', null)
    .in('parent_generation_id', allGenIds)
    .eq('type', 'video');

  console.log('\n=== SEGMENTS WITH NULL FK (parent in this shot) (' + (nullFkSegments || []).length + ') ===');
  (nullFkSegments || []).forEach(s => {
    console.log(
      'seg:' + s.id.substring(0, 8),
      'parent_gen:' + (s.parent_generation_id?.substring(0, 8) || 'NULL'),
      'child_order:' + s.child_order,
      'type:' + s.type
    );
  });

  // 5. Check the specific FK IDs from the earlier log to see if they exist
  const KNOWN_FK_IDS = [
    '99094269-2b32-47a5-8955-b5f72546c1b1',
    '90e3d7b4-098f-4922-b4fa-244be44f0baa',
    '7c9103c2-5d60-4a76-9da9-491be849c47c',
    '0205b415-d146-4beb-a4a7-e2239067acd8',
    '49f83abb-1285-4843-af8e-12c47582fcfc',
    '72be6dfe-2d06-41fc-9500-b25b0bb6aa96',
    '3078d4bc-6160-438e-ab65-8e57179e26ab',
  ];

  const { data: knownFkTargets } = await sb
    .from('shot_generations')
    .select('id, generation_id, timeline_frame, shot_id')
    .in('id', KNOWN_FK_IDS);

  console.log('\n=== KNOWN FK TARGETS (from log) ===');
  console.log('Found ' + (knownFkTargets || []).length + ' of ' + KNOWN_FK_IDS.length);
  (knownFkTargets || []).forEach(t => {
    console.log(
      'sg:' + t.id.substring(0, 8),
      'gen:' + t.generation_id.substring(0, 8),
      'frame:' + t.timeline_frame,
      'shot:' + t.shot_id.substring(0, 8)
    );
  });
  const missingIds = KNOWN_FK_IDS.filter(id => !(knownFkTargets || []).find(t => t.id === id));
  if (missingIds.length > 0) {
    console.log('MISSING (hard-deleted): ' + missingIds.map(id => id.substring(0, 8)).join(', '));
  }

  // 6. Are there any segments that reference these missing IDs?
  // If ON DELETE SET NULL worked, there should be NONE
  const { data: orphanedSegs } = await sb
    .from('generations')
    .select('id, pair_shot_generation_id, child_order, type')
    .in('pair_shot_generation_id', KNOWN_FK_IDS);

  console.log('\n=== SEGMENTS STILL REFERENCING KNOWN FK IDs (' + (orphanedSegs || []).length + ') ===');
  (orphanedSegs || []).forEach(s => {
    const exists = (knownFkTargets || []).find(t => t.id === s.pair_shot_generation_id);
    console.log(
      'seg:' + s.id.substring(0, 8),
      'fk→sg:' + (s.pair_shot_generation_id?.substring(0, 8) || 'NULL'),
      'target_exists:' + !!exists,
      'child_order:' + s.child_order
    );
  });

  // 7. Summary
  console.log('\n=== DIAGNOSIS ===');
  const positionedIds = new Set(timeline.map(t => t.id));
  const staleSegments = relevantSegments.filter(s => !positionedIds.has(s.pair_shot_generation_id));
  console.log('Total segments with FK to this shot: ' + relevantSegments.length);
  console.log('Segments pointing to positioned images: ' + (relevantSegments.length - staleSegments.length));
  console.log('Segments pointing to UNpositioned images: ' + staleSegments.length);
  console.log('Segments with NULL FK (parent in shot): ' + (nullFkSegments || []).length);
  console.log('Known FK IDs from log that still exist: ' + (knownFkTargets || []).length + '/' + KNOWN_FK_IDS.length);
}

main().catch(e => console.error(e));
