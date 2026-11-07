# Use Cases (condensed from the PDF)

All are MVP. Primary actor is Resident. IDs are stable; cite them in commits.

## UC-01 Create a room and join by QR
- **Goal**: everyone in the apartment in one Room with no sign-up.
- **Pre**: app installed, camera permission (only for scanning).
- **Flow**: A taps Create room, enters room name + own display name -> system creates Room, shows QR + short code -> B taps Join room, scans QR, enters display name -> B added, home screen opens -> both see each other in the member list.
- **Alternatives**
  - 1a. Empty name: ask for a name.
  - 4a. Camera denied or scan fails: B types the short code.
  - 4b. Invalid code / room gone: error, allow retry.
  - 4c. B already a member: open the Room, no duplicate.
- **Post**: Room has 2+ members, all see the same data.
- **Acceptance**: create on phone A, scan on phone B, both list both names within 10s.

## UC-02 Assign and complete a chore (DEMO STORY)
- **Supporting**: System (reminders, history), AI Agent (suggests next).
- **Pre**: Room with 2+ members.
- **Flow**
  1. Add chore: title, optional repeat (e.g. weekly), scope person/room.
  2. System asks AI for a suggestion from completion history.
  3. AI returns assignee + short reason ("Anna did the fewest chores this month").
  4. Resident accepts; chore assigned.
  5. Assignee gets a reminder when due.
  6. Assignee marks done.
  7. System logs who/when, notifies others, schedules the next occurrence for the next person.
- **Alternatives**
  - 1a. Scope=room: any Resident can mark done; the doer is recorded.
  - 3a. AI unavailable/timeout: fallback rotation.
  - 4a. Resident picks someone else manually.
  - 5a. Overdue: re-send reminder, highlight to whole Room.
  - 6a. Assignee taps Pass: goes to next suggested person.
- **Post**: Completion logged (name + time), next Occurrence scheduled, history updated.
- **Acceptance**: add chore on A; B shows assignee and reason; B marks done; A shows completed.

## UC-03 Shared shopping list
- **Goal**: see what the household is running out of; avoid duplicates and forgotten essentials.
- **Pre**: Resident in a Room.
- **Flow**: open list, Add item (name, optional quantity) -> shown with who added it -> others see it live -> shopper ticks items -> marked Bought with buyer + time, moved to Bought section.
- **Alternatives**
  - 2a. Duplicate name: warn, offer to increase quantity.
  - 5a. Remove an item added by mistake: deleted for everyone.
  - 5b. Offline: keep change locally, sync on reconnect.
  - 6a. Un-tick: returns to active list.
- **Post**: identical list on all phones; bought items recorded.
- **Acceptance**: add "Washing liquid" on A; appears on B within 10s; ticking on B shows bought on A.
