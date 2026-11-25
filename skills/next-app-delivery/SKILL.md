---
name: next-app-delivery
description: Deliver and verify changes to Nexova React, TypeScript, and Next.js applications in uis/website or uis/backoffice.
---

# Next App Delivery

Use this skill for a feature, bug fix, or migration in either Nexova Next.js app.

## Workflow

1. Read root `AGENTS.md`, the root README, the relevant brief under `contexts/` as read-only input, the app README, and the matching `.agents/` guide. Do not edit `contexts/`.
2. Inspect the owning implementation and neighboring tests before changing code. For Next.js APIs, consult the documentation installed with that app.
3. Make the smallest change that preserves existing routes, data contracts, accessible states, and behavior.
4. Add or update focused tests. Cover empty input, missing results, and null values for TypeScript business logic.
5. From the app directory, run `npm run lint`, `npx tsc --noEmit`, the relevant test command, and `npm run build`. If a script does not exist, report that and use the narrowest available equivalent.
6. Smoke-test the affected route and workflow when runtime verification is available; check loading, error, empty, and success states that apply.
7. Review the diff, update the app README if its setup or structure changed, and report files changed, commands/results, and remaining gaps. Do not commit unless asked.

## Acceptance criteria

- The change remains in the mapped app (`uis/website` or `uis/backoffice`) and does not create a parallel application tree.
- Existing business and API behavior is preserved unless the requested change explicitly alters it.
- Lint, typecheck, relevant tests, and production build pass; unavailable checks are called out explicitly.
- The changed user flow is smoke-tested when possible, and the final report names the exact verification performed.