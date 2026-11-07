# Domain Model (assumption: derived from the use cases; PDF gives no schema)

Postgres tables on Supabase. All rows carry `room_id`; Row Level Security restricts access to members of that room.

| Table | Key fields |
|---|---|
| `rooms` | id, name, join_code (unique, short), created_at |
| `residents` | id, room_id, user_id (anon auth uid), display_name, joined_at; unique (room_id, user_id) |
| `chores` | id, room_id, title, repeat_interval (null / daily / weekly / custom), scope (`person`/`room`), created_by |
| `occurrences` | id, chore_id, room_id, assignee_id (null if scope=room), due_at, status (`pending`/`done`/`passed`), suggestion_reason, suggestion_source (`ai`/`fallback`/`manual`) |
| `completions` | id, occurrence_id, room_id, resident_id, completed_at (fairness history) |
| `shopping_items` | id, room_id, name, quantity, added_by, status (`active`/`bought`), bought_by, bought_at |

## Invariants
- A Room must have 2+ members before chores can be assigned (UC-02 pre).
- Joining when already a member must not create a duplicate (unique constraint).
- Completing an Occurrence always creates a Completion and, if repeating, the next Occurrence for a different Resident where possible.
- Pass reassigns to the next suggested Resident and records no Completion.
- Shopping item names are compared case-insensitively and trimmed for duplicate detection.
- Fairness inputs are Completions only: per Resident, completions in the last 30 days divided by days since joining (capped at 30). Newcomers are not penalised for empty history.
- `residents.display_name` is unique per room (case-insensitive).
- Pass: add the resident to `occurrences.passed_by` (uuid[]). When `passed_by` covers every member, set `assignee_id = null` and treat the occurrence as open to the whole room.
- Room-scope chores: `assignee_id` is always null; any Resident may complete.
- Any Resident may edit or delete chores in their Room (no ownership checks).
