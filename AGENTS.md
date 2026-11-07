# Shared Space App — Agent Guide

Mobile app for students sharing an apartment: track who did which chore, keep a shared shopping list, and have an AI suggest who is next. Built at Cognition Builder Day (hackathon, Nov 2026). Source spec: `Shared Space App Use Cases.pdf`.

## Read order (load only what the task needs)

| Need | File |
|---|---|
| What / why / scope / demo | [docs/product.md](docs/product.md) |
| Terms (Room, Chore, Occurrence...) | [docs/glossary.md](docs/glossary.md) |
| Behaviour, flows, acceptance checks | [docs/use-cases.md](docs/use-cases.md) |
| Tables, fields, invariants | [docs/domain-model.md](docs/domain-model.md) |
| Stack, AI agent contract, sync | [docs/architecture.md](docs/architecture.md) |
| Why we chose X | [docs/decisions.md](docs/decisions.md) |
| Unresolved items | [docs/open-questions.md](docs/open-questions.md) |
| Build spec (user stories, tests) | [docs/spec.md](docs/spec.md) |

## Non-negotiables

1. Scope is **UC-01 (room + QR join), UC-02 (chores + AI suggestion), UC-03 (shopping list)**. Anything else is out of scope (see product.md).
2. **Demo story = UC-02.** Optimise polish there first; UC-01 is the setup beat, UC-03 is supporting.
3. **No sign-up friction**: users join with a display name only (anonymous auth).
4. **AI is a suggestion, never a blocker.** On error or timeout (>5s) fall back to round-robin rotation. The Claude API key lives server-side only, never in the app bundle.
5. Every completion is logged with **who** and **when**; this history is the only input to fairness.
6. Settled rules: unique display names per room; no leave/rejoin flows; offline only for the shopping list; local-notification reminders; room-scope chores have no assignee/AI. Full list in decisions.md (D-007 to D-023).
7. Acceptance bar: changes made on phone A appear on phone B **within 10 seconds**.

## Stack (decided)

React Native + Expo, Supabase (Postgres, Realtime, Auth anonymous, Edge Functions), Claude API called from an Edge Function. Details in architecture.md.

## Conventions

- Use glossary terms exactly; do not invent synonyms (e.g. "flat" or "household" for Room).
- Before adding a feature, check it maps to a UC id; cite the id in commits and PRs (`UC-02: ...`).
- Record any new significant decision in decisions.md and resolve items in open-questions.md.
- Docs marked **(assumption)** were not in the source PDF; confirm before treating as fact.
