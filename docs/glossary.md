# Glossary

Use these terms verbatim in code, UI copy and docs.

| Term | Meaning |
|---|---|
| Room | One shared apartment/space ("Flat 12B"). All data is scoped to a Room. |
| Resident | A member of a Room. Identified by a display name; no password. |
| Join code | Short text code for a Room; backup to the QR code. The QR encodes the same code. |
| Chore | A task definition: title, optional repeat interval, scope. |
| Scope | `person` (one assignee) or `room` (anyone can complete it). |
| Occurrence | One concrete due instance of a Chore with an assignee, due date and status. |
| Assignee | Resident responsible for an Occurrence. |
| Completion | Logged event: who finished an Occurrence and when. The fairness history. |
| Pass | Assignee declines; the Occurrence goes to the next suggested Resident. |
| Suggestion | AI (or fallback) output: `{assignee, reason}`. |
| Fallback rotation | Round-robin over members, used when the AI fails or times out. |
| Overdue | Occurrence past its due time and not done; reminder re-sent and highlighted to the whole Room. |
| Shopping item | Entry on the shared list: name, optional quantity, status (active/bought). |
| Bought | Item ticked off, recorded with buyer and time. |
