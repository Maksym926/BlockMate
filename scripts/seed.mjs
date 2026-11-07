/**
 * Demo seed for BlockMate (T13 / D-018).
 *
 * Creates room "Flat 12B" (join code FLAT2B) with three ghost residents
 * and four weeks of Completion history so the AI suggestion during the
 * demo has a meaningful reason.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed.mjs
 *   # or export vars manually then:
 *   node scripts/seed.mjs
 *
 * Required env vars (in .env.local, never commit):
 *   EXPO_PUBLIC_SUPABASE_URL   – project URL (same as the app uses)
 *   SUPABASE_SERVICE_ROLE_KEY  – service_role key from Project Settings → API
 *
 * Run once before the demo. If the room already exists the script exits
 * cleanly and prints the existing join code.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Env loading ────────────────────────────────────────────────────────────

function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* file absent – ignore */ }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✖  Missing env vars.\n' +
    '   Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp N days in the past, at a given hour (local UTC). */
const ago = (days, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Today at 18:00 UTC. */
const todayAt18 = () => {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
};

async function must(label, { data, error }) {
  if (error) { console.error(`✖  ${label}:`, error.message); process.exit(1); }
  return data;
}

// ── Seed data ──────────────────────────────────────────────────────────────

const JOIN_CODE = 'FLAT2B';

/**
 * Ghost residents with their completion load over the last 30 days.
 * Fairness scores: Chris 8/30≈0.27, Sam 6/29≈0.21, Taylor 3/15=0.20
 * A brand-new demo phone (0 completions / ~0 days) will score lowest →
 * the AI will suggest them and explain why.
 */
const GHOSTS = [
  { name: 'Chris',  daysAgoJoined: 30 },
  { name: 'Sam',    daysAgoJoined: 29 },
  { name: 'Taylor', daysAgoJoined: 15 },
];

/** Person-scope chore history. Each entry is [choreTitle, daysAgoCompleted, ghostName]. */
const PERSON_COMPLETIONS = [
  // Kitchen cleaning (weekly) – Chris & Sam rotate
  ['Kitchen cleaning', 28, 'Chris'],
  ['Kitchen cleaning', 21, 'Sam'],
  ['Kitchen cleaning', 14, 'Chris'],
  ['Kitchen cleaning',  7, 'Sam'],
  // Bathroom cleaning (weekly) – Sam & Chris rotate, Taylor joins
  ['Bathroom cleaning', 27, 'Sam'],
  ['Bathroom cleaning', 20, 'Chris'],
  ['Bathroom cleaning', 13, 'Sam'],  // Taylor joined 15 days ago — skipped here
  ['Bathroom cleaning',  6, 'Chris'],
  // Rubbish (every 3 days) – spread across all three; Taylor gets some recent ones
  ['Take out the rubbish', 27, 'Chris'],
  ['Take out the rubbish', 24, 'Sam'],
  ['Take out the rubbish', 21, 'Chris'],
  ['Take out the rubbish', 18, 'Sam'],
  ['Take out the rubbish', 14, 'Taylor'],
  ['Take out the rubbish', 11, 'Chris'],
  ['Take out the rubbish',  8, 'Taylor'],
  ['Take out the rubbish',  5, 'Sam'],
  ['Take out the rubbish',  2, 'Taylor'],
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('BlockMate demo seed\n');

  // ── 1. Room ──────────────────────────────────────────────────────────────
  const { data: existing } = await db
    .from('rooms')
    .select('id, join_code')
    .eq('join_code', JOIN_CODE)
    .maybeSingle();

  if (existing) {
    console.log(`ℹ  Room already exists (id: ${existing.id}).`);
    console.log(`   Join code: ${existing.join_code}`);
    console.log('   Nothing to do – run a fresh seed by deleting the room first.');
    return;
  }

  const { data: room } = await must('create room',
    await db.from('rooms').insert({
      name: 'Flat 12B',
      join_code: JOIN_CODE,
      created_at: ago(30),
    }).select().single()
  );
  console.log(`✔  Room "${room.name}" created  (id: ${room.id})`);

  // ── 2. Ghost auth users ──────────────────────────────────────────────────
  const ghostUsers = {};
  for (const g of GHOSTS) {
    const { data: { user }, error } = await db.auth.admin.createUser({
      email: `${g.name.toLowerCase()}.seed_${Date.now()}@blockmate.internal`,
      email_confirm: true,
      user_metadata: { is_seed: true, display_name: g.name },
    });
    if (error) { console.error(`✖  createUser(${g.name}):`, error.message); process.exit(1); }
    ghostUsers[g.name] = user.id;
    console.log(`✔  Auth user "${g.name}" (${user.id})`);
  }

  // ── 3. Ghost residents ───────────────────────────────────────────────────
  const residentsToInsert = GHOSTS.map((g) => ({
    room_id:      room.id,
    user_id:      ghostUsers[g.name],
    display_name: g.name,
    joined_at:    ago(g.daysAgoJoined),
  }));

  const { data: residents } = await must('insert residents',
    await db.from('residents').insert(residentsToInsert).select()
  );
  const residentByName = Object.fromEntries(residents.map((r) => [r.display_name, r]));
  console.log(`✔  ${residents.length} residents inserted`);

  // ── 4. Chore definitions ─────────────────────────────────────────────────
  const choreCreator = residentByName['Chris'].id;

  const { data: chores } = await must('insert chores',
    await db.from('chores').insert([
      {
        room_id: room.id, created_by: choreCreator,
        title: 'Kitchen cleaning', repeat_interval: 'weekly', scope: 'person',
        created_at: ago(30),
      },
      {
        room_id: room.id, created_by: choreCreator,
        title: 'Bathroom cleaning', repeat_interval: 'weekly', scope: 'person',
        created_at: ago(30),
      },
      {
        room_id: room.id, created_by: choreCreator,
        title: 'Take out the rubbish', repeat_interval: 'custom', repeat_days: 3, scope: 'person',
        created_at: ago(30),
      },
      // Room-scope chore so demo Phone A can complete it immediately (builds 1 completion for them).
      {
        room_id: room.id, created_by: choreCreator,
        title: 'Vacuum the flat', repeat_interval: 'weekly', scope: 'room',
        created_at: ago(29),
      },
    ]).select()
  );
  const choreByTitle = Object.fromEntries(chores.map((c) => [c.title, c]));
  console.log(`✔  ${chores.length} chores created`);

  // ── 5. Past occurrences + completions (person-scope history) ─────────────
  let occurrenceCount = 0;
  let completionCount = 0;

  // Group completions by chore so we can build one past occurrence per completion
  const choreGroups = {};
  for (const [choreTitle, daysAgoCompleted, ghostName] of PERSON_COMPLETIONS) {
    if (!choreGroups[choreTitle]) choreGroups[choreTitle] = [];
    choreGroups[choreTitle].push({ daysAgoCompleted, ghostName });
  }

  for (const [choreTitle, entries] of Object.entries(choreGroups)) {
    const chore = choreByTitle[choreTitle];
    for (const { daysAgoCompleted, ghostName } of entries) {
      const resident = residentByName[ghostName];

      const { data: occ } = await must(`occurrence ${choreTitle} -${daysAgoCompleted}d`,
        await db.from('occurrences').insert({
          chore_id:         chore.id,
          room_id:          room.id,
          assignee_id:      resident.id,
          due_at:           ago(daysAgoCompleted + 1, 18), // due one day before completion
          status:           'done',
          suggestion_source: 'fallback',
          passed_by:        [],
          created_at:       ago(daysAgoCompleted + 2),
        }).select().single()
      );
      occurrenceCount++;

      await must(`completion ${choreTitle}`,
        await db.from('completions').insert({
          occurrence_id: occ.id,
          room_id:       room.id,
          resident_id:   resident.id,
          completed_at:  ago(daysAgoCompleted),
        })
      );
      completionCount++;
    }

    // Current pending occurrence for each person-scope chore (due today)
    await must(`pending occurrence ${choreTitle}`,
      await db.from('occurrences').insert({
        chore_id:         chore.id,
        room_id:          room.id,
        assignee_id:      null, // will be assigned by AI during demo
        due_at:           todayAt18(),
        status:           'pending',
        passed_by:        [],
        created_at:       ago(1),
      })
    );
    occurrenceCount++;
  }

  console.log(`✔  ${occurrenceCount} occurrences, ${completionCount} completions inserted`);

  // ── 6. Room-scope pending occurrence (demo Phone A completes this first) ─
  const vacuumChore = choreByTitle['Vacuum the flat'];
  await must('vacuum pending occurrence',
    await db.from('occurrences').insert({
      chore_id:   vacuumChore.id,
      room_id:    room.id,
      assignee_id: null,
      due_at:     todayAt18(),
      status:     'pending',
      passed_by:  [],
      created_at: ago(7),
    })
  );
  console.log(`✔  Pending "Vacuum the flat" occurrence created (room-scope)`);

  // ── 7. Shopping list seed items ──────────────────────────────────────────
  await must('shopping items',
    await db.from('shopping_items').insert([
      { room_id: room.id, name: 'Washing-up liquid',  quantity: 1, added_by: residentByName['Sam'].id,    status: 'active',  created_at: ago(2) },
      { room_id: room.id, name: 'Toilet paper',       quantity: 4, added_by: residentByName['Chris'].id,  status: 'active',  created_at: ago(3) },
      { room_id: room.id, name: 'Milk',               quantity: 2, added_by: residentByName['Taylor'].id, status: 'active',  created_at: ago(1) },
      { room_id: room.id, name: 'Coffee',             quantity: 1, added_by: residentByName['Chris'].id,  status: 'bought',
        bought_by: residentByName['Sam'].id, bought_at: ago(0, 9), created_at: ago(2) },
    ])
  );
  console.log(`✔  4 shopping items seeded`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Demo room ready!');
  console.log(` Room: Flat 12B`);
  console.log(` Join code: ${JOIN_CODE}  (share as QR or type)`);
  console.log(` Ghost residents: Chris (8 completions), Sam (6), Taylor (3)`);
  console.log(' Next step: see DEMO.md for the two-phone run-through');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
