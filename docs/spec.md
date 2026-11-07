# Spec: Shared Space App MVP

Triage label: `ready-for-agent`. Vocabulary follows [glossary.md](glossary.md); decisions D-001 to D-023 in [decisions.md](decisions.md) are binding.

## Problem Statement

Students sharing a campus apartment forget the turn-based household work: taking out the rubbish, buying washing liquid, weekly cleaning. Nobody keeps track of who did what, so the load is uneven, people argue, and tasks slip. They need a zero-friction way to see who owns each task, be reminded, and have fairness decided from real history rather than memory.

## Solution

A mobile app where flatmates join one Room by scanning a QR code, with only a display name. Residents add Chores; an AI agent suggests who should do each Occurrence from the Completion history (with a plain-rotation fallback if the AI is unavailable). Assignees get reminders, mark chores done, and everyone sees the result live. A shared shopping list shows what the household is running out of. The UC-02 chore flow with its AI suggestion is the pitch's demo story.

## User Stories

### Room and joining (UC-01)
1. As a resident, I want to create a Room with a name and my display name, so that my flat has one shared space.
2. As a resident, I want a QR code and a short text code shown after creating a Room, so that flatmates can join easily.
3. As a new flatmate, I want to scan the QR code and enter my display name, so that I join without any sign-up.
4. As a new flatmate whose camera is denied or scan fails, I want to type the short code, so that I can still join.
5. As a new flatmate, I want a clear error and a retry when the code is invalid or the Room is gone, so that I am not stuck.
6. As an existing member who scans again, I want the Room to open without a duplicate entry, so that the member list stays clean.
7. As a resident, I want to be asked for a name when I leave it empty, so that every member is identifiable.
8. As a resident, I want to be asked for another name if mine is taken in the Room, so that "Anna did it" is never ambiguous.
9. As a resident, I want to see the member list, so that I know who shares the Room.
10. As a resident, I want new members to appear on my phone within 10 seconds, so that I know the join worked.

### Chores and AI suggestion (UC-02)
11. As a resident, I want to add a Chore with a title, so that a task gets an owner.
12. As a resident, I want to set a repeat interval (none, daily, weekly, every N days), so that recurring tasks schedule themselves.
13. As a resident, I want to choose whether a Chore is for one person or the whole room, so that shared tasks are modelled correctly.
14. As a resident, I want a suggested assignee with a one-line reason, so that I understand why that person was chosen.
15. As a resident, I want to accept the suggestion, so that assignment is one tap.
16. As a resident, I want to pick someone else manually, so that I can override the suggestion.
17. As a resident, I want the app to fall back to simple rotation when the AI is slow or down, so that adding a Chore never blocks.
18. As a resident, I want fairness based on completions in the last 30 days scaled by days in the Room, so that a newcomer is not overloaded.
19. As an assignee, I want a reminder at the due time and one hour before for later chores, so that I do not forget.
20. As an assignee, I want repeated reminders every 2 hours (08:00 to 22:00) when overdue, so that it keeps nudging me politely.
21. As an assignee, I want to mark a Chore done, so that my effort is recorded.
22. As an assignee, I want a Pass button, so that the Chore moves on if I cannot do it.
23. As a resident, I want a Chore to open to the whole room once everyone has passed it, so that it never loops forever.
24. As a resident, I want a room-scope Chore to have no assignee, so that anyone can do it and be credited.
25. As a resident who completes a room-scope Chore, I want my name and time recorded, so that credit is fair.
26. As a resident, I want the completed Occurrence logged with who and when, so that history is trustworthy.
27. As a resident, I want the next Occurrence of a repeating Chore created and assigned via the AI again, so that turns rotate fairly.
28. As a resident, I want other residents to see a Chore as completed or overdue live, so that the Room stays informed.
29. As a resident, I want overdue Chores highlighted for the whole Room, so that social visibility helps.
30. As a resident, I want any resident to edit or delete a Chore, so that mistakes are easy to fix.
31. As a resident, I want a toast (and local notification if the app is backgrounded) when someone completes or lets a Chore go overdue, so that I am informed without push setup.
32. As a presenter, I want a seeded "Flat 12B" with weeks of history, so that the demo's AI reasons are meaningful.

### Shopping list (UC-03)
33. As a resident, I want to add an item with an optional quantity, so that the household knows what is needed.
34. As a resident, I want to see who added each item, so that questions go to the right person.
35. As a resident, I want a warning and a "raise quantity" option on duplicate names (case-insensitive, trimmed), so that we do not buy twice.
36. As a resident, I want new items to appear on other phones within 10 seconds, so that the list stays shared.
37. As a shopper, I want to tick items as bought, with my name and time recorded, so that others know they are covered.
38. As a resident, I want bought items moved to a Bought section, so that the active list stays short.
39. As a resident, I want to un-tick an item bought by mistake, so that it returns to the active list.
40. As a resident, I want to delete an item added by mistake for everyone, so that the list is accurate.
41. As a shopper in a shop with no signal, I want my changes saved on my device and synced later, so that the list works offline.

## Implementation Decisions

- **Architecture**: React Native with Expo client; Supabase for Postgres with Row Level Security, Realtime, anonymous Auth and Edge Functions; Claude API called only from an Edge Function (D-002, D-003).
- **Identity**: anonymous auth plus display name; unique display name per Room, case-insensitive; no recovery after reinstall; no leave or remove flow (D-004, D-012 to D-014).
- **Data model** (domain-model.md): `rooms`, `residents`, `chores`, `occurrences` (with `passed_by`, `suggestion_reason`, `suggestion_source`), `completions`, `shopping_items`. Every row has `room_id`; RLS limits access to members of that Room. Unique `(room_id, user_id)` prevents duplicate joins.
- **Data-access layer**: a single client-side module is the app's only gateway to Supabase (rooms, chores, shopping). UI components call it and never touch Supabase directly. This module is the test seam.
- **Join**: server-side generated 6-character code from the alphabet without 0/O/1/I; QR encodes the code only (D-023).
- **Suggest-assignee function**: input is chore title, members with join dates, and 30-day completions; excludes residents who already passed. Output strict JSON `{assignee_id, reason}`. Validate that the assignee is a member and the reason is one short sentence, else treat as failure. 5s timeout, no retry, then rotation by join order after the last assignee. Model `claude-haiku-5-5` (D-022).
- **Fairness**: per resident, completions in the last 30 days divided by days since joining (capped at 30) (D-010).
- **Repeat and completion**: marking done creates a Completion, then for repeating Chores creates the next Occurrence and calls the suggest function again (D-007). Pass appends to `passed_by`; when all members have passed, `assignee_id` becomes null and the Occurrence is open to the room (D-011). Room-scope Chores have no assignee and no AI call (D-009).
- **Repeat options and timing**: none, daily, weekly, every N days (1 to 30); default due 18:00 local (D-021). Reminders: at due time, 1 hour before when due is more than an hour away, then every 2 hours between 08:00 and 22:00 when overdue; constants in one config (D-020).
- **Notifications**: reminders are local notifications on each relevant device. Completion and overdue alerts to others come from Realtime subscriptions: in-app toast, plus a local notification if backgrounded but alive. No push (D-008, D-016, D-019).
- **Sync**: Realtime channels per Room on `occurrences`, `residents`, `shopping_items`; cross-device latency under 10s.
- **Offline**: shopping list only. Mutations queue locally and flush on reconnect, last-write-wins (D-015).
- **Permissions**: any resident may edit or delete any Chore or item; no roles (D-017).
- **Secrets**: the Claude API key is a server-side secret and never ships in the app bundle.
- **Demo data**: a seed script creates "Flat 12B" with residents and about four weeks of Completions (D-018).

## Testing Decisions

- **What makes a good test**: assert external behaviour visible to a resident or to another device (what phone B sees after phone A acts), never internal calls, table layout or component structure.
- **One seam**: the client data-access layer, exercised by two independent client instances ("phone A" and "phone B") against a local Supabase stack. The Claude API is stubbed at the Edge Function boundary with controllable outcomes: valid suggestion, invalid assignee, malformed output, timeout.
- **Covered through that seam**: the three acceptance checks from the PDF (join visible on both clients; chore assigned with reason visible on B, done on B, completed on A; shopping item appears and ticks across clients), duplicate join, unique names, invalid code, rotation fallback, fairness with a newcomer, pass until open to room, room-scope completion credit, repeat creating the next Occurrence, RLS isolation between two Rooms, duplicate shopping item handling, and offline queue then sync.
- **Time-dependent behaviour** (reminder schedules, overdue): tested by injecting a clock into the scheduling logic and asserting the computed schedule, not by waiting.
- **Out of the automated suite**: UI rendering, camera scanning and OS notification delivery are checked manually on two real phones before the pitch.
- **Prior art**: none yet; this is a greenfield repo.

## Out of Scope

Admin panel; accommodation-office integration; hardware sensors; a trained or polished AI agent; leaving or removing members; recovering identity after reinstall or on a new device; offline support for rooms and chores; server push notifications (fully closed apps miss completion and overdue alerts); roles and permissions; UI end-to-end test automation.

## Further Notes

- Demo arc: join by QR (UC-01), add "Take out the rubbish" and show the AI reason (UC-02), complete on the second phone and watch the first update, then show the shopping list briefly (UC-03).
- Revisit D-020 (reminder timing) and D-022 (AI timeout and model) after testing on real devices.
- Publication: this spec could not be posted to the GitHub issue tracker from this session (see hand-off note); it is stored here and should be filed with the `ready-for-agent` label.
