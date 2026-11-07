# Product

## Problem
Students living in a shared campus apartment forget to take out the rubbish, buy washing liquid, clean the shared space weekly, and other turn-based tasks. Nobody tracks who did what, so effort is unfair and tasks slip.

## Target users
Students and anyone sharing a room or flat.

## Core value
Simplify the shared routine by tracking who did what, so household work is split fairly.

## Actors
- **Resident**: any room member using the app.
- **System**: automatic reminders and notifications.
- **AI Agent**: simple external-API integration that suggests who should do the next chore, based on history.

## Scope
In (MVP): UC-01 create/join room by QR, UC-02 assign and complete chore, UC-03 shared shopping list.

Out of scope for the hackathon: admin panel, accommodation-office integration, hardware sensors, a trained/polished AI agent.

## Demo story (decided)
UC-02. Suggested pitch arc (assumption):
1. Two phones join one room via QR (UC-01, ~20s).
2. Phone A adds "Take out the rubbish"; AI suggests Anna with the reason "fewest chores this month".
3. Phone B shows the assignment and reason; marks it done; phone A updates live.
4. Next occurrence rotates to a different person; shopping list shown as a brief extra (UC-03).

## Success criteria
Each use case's acceptance check passes on two real devices (see use-cases.md). Cross-device update latency under 10s.
