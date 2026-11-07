# Decisions

Format: ID, decision, reason. Newest at bottom. Date 2026-11-07 unless noted.

- **D-001** Demo story is UC-02. It is the only flow showing the AI agent, history and fairness, which is the product differentiator.
- **D-002** Stack: React Native + Expo with Supabase. Gives cross-platform phones, camera QR, push and realtime sync with minimal backend work for a hackathon.
- **D-003** AI: Claude API via Edge Function, with rotation fallback. Keeps the key off the device and meets the PDF's "AI unavailable -> rotation" flow.
- **D-004** Identity: anonymous auth + display name. Matches "no sign-up friction" in UC-01.
- **D-005** Docs layout: root `AGENTS.md` index plus small files in `docs/`, so agents load only what they need.
- **D-006** Scope cut per PDF: no admin panel, accommodation offices, hardware sensors or polished AI agent.
- **D-007** Repeating chores: after each completion the AI is asked again for the next assignee (rotation fallback on failure). Keeps the agent in every cycle.
- **D-008** Reminders are local notifications scheduled on the assignee's device when assigned. No server push for reminders.
- **D-009** Room-scope chores have no assignee and no AI suggestion. Whole room sees and is reminded (each device schedules its own local reminder); anyone completes and is recorded; next occurrence is again open to all.
- **D-010** Fairness window: rolling 30 days, normalised per day since the resident joined, so newcomers are not flagged as "least busy".
- **D-011** Pass: goes to the next suggested resident. Once every member has passed an occurrence it becomes open to the whole room (unassigned, highlighted).
- **D-012** Leaving or removing members is out of scope. History stays as is.
- **D-013** Display names must be unique within a room (join asks for another name on collision).
- **D-014** Reinstall or new device: no recovery, the person rejoins as a new member. Out of scope.
- **D-015** Offline support only for the shopping list (UC-03), as in the PDF. Chores and rooms need a connection.
- **D-016** Notify other residents only on chore completed and chore overdue. Shopping updates are live in-app, no notification. Delivery: see D-019.
- **D-017** Any resident may edit or delete any chore. No roles.
- **D-018** Demo uses a seed script ("Flat 12B" with a few weeks of completions) and two real phones.
- **D-019** Completion and overdue alerts to other residents use Realtime only (in-app toast, plus a local notification if the app is backgrounded but alive). No Expo push for the hackathon. Known limit: a fully closed app misses them. Resolves D-016's delivery question.

- **D-020** Reminder timing (defaults): first reminder at the due time, plus one 1 hour before for chores due later than 1 hour away. When overdue, re-send every 2 hours, 8:00 to 22:00 local time only. Easy to tune; kept as constants in one config file.
- **D-021** Repeat options: none, daily, weekly, or every N days (N 1 to 30). Default due time is 18:00 local on the due day; the user can change it per chore. One-off chores default to due the same day at 18:00.
- **D-022** AI call: 5 second timeout, one retry is NOT made (go straight to fallback). Model: Haiku class (`claude-haiku-5-5`) for latency. Revisit after measuring on real devices; switch to `claude-sonnet-5-5` only if reason text quality is poor.
- **D-023** Join code: 6 characters from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I). Generated server-side, unique per room, case-insensitive on entry. The QR encodes the code only.
- **D-024** Join preview: before asking for a display name, the join flow shows "Found <room>, <names> already in" (Flows canvas, screen "5 · Your name"). Backed by a `preview_room(code)` RPC that returns only the room name and member display names, and only to an authenticated caller who holds the code, the same trust as joining. Rooms and residents stay unreadable to non-members otherwise.
