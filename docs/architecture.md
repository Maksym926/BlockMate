# Architecture

## Stack (decided)
- **Client**: React Native + Expo. QR via `expo-camera`/barcode scanner, QR display via a QR component, reminders via Expo push/local notifications.
- **Backend**: Supabase. Anonymous Auth (identity = device session + display name), Postgres with RLS, Realtime subscriptions for live updates, Edge Functions for server logic.
- **AI**: Claude API called only from an Edge Function (`suggest-assignee`). Key stored as a Supabase secret.

## AI agent contract (UC-02)
Input to the Edge Function: `room_id`, chore title, member list with join dates, and Completions for the last 30 days (completions per day-in-room per Resident, plus last completion time). Exclude residents who already passed this occurrence.

Output (strict JSON):
```json
{ "assignee_id": "<resident uuid>", "reason": "Anna did the fewest chores this month" }
```
Rules:
- Validate: `assignee_id` must be a member of the room; `reason` is one short sentence. Otherwise treat as failure.
- Timeout 5s (D-022) -> fallback rotation (next member after the last assignee, by join order).
- Record `suggestion_source` as `ai` or `fallback` on the Occurrence so the UI can show or hide the reason.
- Model (D-022): `claude-haiku-5-5`.
- Deterministic pre-check optional: compute the fewest-completions candidate in code and pass it as a hint, to keep results stable for the demo.

## Sync
- Realtime channels per room on `occurrences`, `residents`, `shopping_items`. Target under 10s end-to-end (usually under 1s).
- Offline (required for UC-03 only): queue mutations locally, flush on reconnect, last-write-wins (assumption).

## Reminders (decided, D-008)
Local notifications scheduled on the assignee's device when an Occurrence is assigned (for room-scope chores each device schedules its own). Rescheduled when the Occurrence changes; repeated while overdue. No server push. Completion/overdue alerts to others arrive via Realtime subscription while the app is active (D-019).

## Repeat flow
On completion of a repeating Chore, the Edge Function is called again for the next Occurrence's assignee (D-007); the rotation fallback applies on failure.

## Demo data
A seed script creates "Flat 12B" with several residents and ~4 weeks of Completions so the AI reason is meaningful (D-018).

## QR / join code
QR encodes the Room `join_code` only (no personal data). Code is 6 chars from an unambiguous alphabet (D-023).

## Security
RLS: a user can read/write rows only for rooms where they have a `residents` row. No secrets in the client bundle.
