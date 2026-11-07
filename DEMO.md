# BlockMate — Demo run-through

Pitch arc: UC-02 (AI chore assignment). Two real phones. ~6 minutes.

---

## Setup (do this the night before)

### 1. Apply all migrations

```bash
supabase link --project-ref <your-ref>
supabase db push --remote
```

### 2. Seed the demo room

```bash
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never commit it)
node --env-file=.env.local scripts/seed.mjs
```

Expected output:
```
✔  Room "Flat 12B" created
✔  Auth user "Chris" …
✔  3 residents inserted
✔  4 chores created
✔  19 occurrences, 16 completions inserted
✔  Pending "Vacuum the flat" occurrence created (room-scope)
✔  4 shopping items seeded
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Join code: FLAT2B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Phone A — first launch

- Open BlockMate → "Create a new flat" → name the flat **"Flat 12B"** (or join FLAT2B).

> **Note:** The seeded room already exists under join code `FLAT2B`. Phone A should JOIN it,
> not create a new one. Enter `FLAT2B` in the scan/type flow and use display name **"Alex"**.

### 4. Reset the presenter display

- Delete the app and reinstall on both phones to clear any old sessions.
- Phone A joins with code `FLAT2B` as **"Alex"**.
- Keep Phone B ready but do not join yet.

---

## Demo script (~6 minutes)

### Beat 1 — The problem (30 s)

> "Four flatmates, one kitchen. Everyone thinks someone else cleaned it last.
> BlockMate fixes that."

### Beat 2 — Join by QR (60 s)

**Phone A** (facing audience):
1. Open the app → show Flat 12B → tap **Flat** tab.
2. Show the member list: Chris, Sam, Taylor already in the flat.
3. Tap **Show QR to invite more**.

**Phone B** (handed to volunteer):
1. Scan the QR code.
2. Enter name **"Jordan"** → tap Join.

**Phone A** shows the banner:
> "Jordan just joined. You're all in."

Say: *"Live. No reload."*

### Beat 3 — The boring chore no one wants (30 s)

**Phone A** — say:
> "Let's say we need to vacuum the flat — it's been sitting there since last week."

Tap **Chores** tab → tap **"Vacuum the flat"** (the room-scope pending chore from the seed).
Tap **Complete** → see the **"Nice one, Alex!"** confirmation screen → tap **Back to chores**.

> *Alex now has 1 completion. The AI will factor this in.*

### Beat 4 — Add a chore with AI suggestion (90 s)

**Phone A** — tap **＋ Add chore**.
- Title: **"Dish duty"**
- Repeat: **Weekly**
- Scope: **Person** (someone's turn)
- Tap **Pick assignee →**

The app calls the AI edge function (wait ~2 s).

**Phone A** shows the AI pick screen. Expected suggestion:

| Scenario | AI pick | AI reason |
|----------|---------|-----------|
| Typical  | Jordan  | "Jordan joined Flat 12B today and hasn't been assigned a single chore yet. Meanwhile Alex, Chris, Sam and Taylor have all been contributing. Time for Jordan to pitch in!" |
| Edge case | Alex | "Alex completed the vacuum chore earlier today but has the lightest load overall…" |

Say:
> *"The AI looked at four weeks of who-did-what and picked Jordan — not at random, based on actual history."*

If the AI picked a ghost resident (Chris / Sam / Taylor), tap **Pick someone else** → select Jordan.

Tap **Assign** → chore appears on both phones instantly.

### Beat 5 — Complete on Phone B, see update on Phone A (60 s)

**Phone B** (Jordan) — tap **Chores** → tap **"Dish duty"**.
Tap **Complete**.

**Phone A** — without reloading, the toast appears:
> "Jordan completed Dish duty"

And the chore moves to DONE.

Say: *"Live update. No push notification setup, no polling. Just Supabase Realtime."*

### Beat 6 — Shopping list (60 s)

**Phone A** — swipe to **Shopping** tab.
Show the seeded list (washing-up liquid, toilet paper, milk, coffee ✓).

Type **"Oat milk"** → tap **＋**.

**Phone B** — swipe to Shopping → see "Oat milk" appear within a few seconds.

**Phone B** — tick **"Toilet paper"** as bought.

**Phone A** — it moves to BOUGHT with "Jordan, just now".

Say: *"Works offline too — changes queue locally and sync on reconnect."*

### Beat 7 — Close (30 s)

> "Zero sign-up friction. AI that knows the history. Live on two phones right now.
> BlockMate."

---

## Rehearsal notes

Fill in after running through on two real phones:

| Item | Result |
|------|--------|
| Seed ran cleanly | ☐ |
| Join by QR worked within 10 s | ☐ |
| AI suggestion fired (not fallback) | ☐ |
| AI reason made sense | ☐ |
| Completion toast appeared on Phone A | ☐ |
| Shopping item appeared on Phone B within 10 s | ☐ |
| Total run time | ___ min |

**Issues found:**

(fill in after rehearsal)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Join code not found | Check seed ran (`FLAT2B` in `rooms` table) |
| AI returns fallback rotation | Check `ANTHROPIC_API_KEY` is set in Supabase Edge Function secrets |
| AI picks a ghost (Chris/Sam/Taylor) | Tap "Pick someone else" → select Jordan; still shows the AI flow |
| Chore not live-updating | Check Supabase Realtime is enabled for `occurrences` table |
| Toast not appearing | Ensure both phones are on the Chores tab (not a child screen) |

## Re-seeding

If you need a clean slate:

```sql
-- In Supabase SQL editor
DELETE FROM public.rooms WHERE join_code = 'FLAT2B';
-- Cascades to residents, chores, occurrences, completions, shopping_items
```

Then re-run `node --env-file=.env.local scripts/seed.mjs`.
