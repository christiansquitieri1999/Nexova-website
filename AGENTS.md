# Repository workflow

## Before every session — mandatory reading

At the start of each session, read these files in order to establish context:

1. **`memory-bank/projectbrief.md`** — Business description, problem statement, project objective. Understand what Nexova does and why this repository exists.
2. **`memory-bank/techContext.md`** — Tech stack, architectural decisions, technical constraints. Know what tools are available and what rules have been set.
3. **`memory-bank/progress.md`** — Current state of each milestone, what is done, what is planned next. Never redo completed work.
4. **`docs/project-context.md`** — Persistent cross-milestone orientation and canonical application paths.
5. **Root `README.md`** — Repository map and how to think about this monorepo.
6. **The relevant milestone brief under `contexts/`** — Read-only input. Understand the stakeholder, the problem, and the requirements before writing any code.
7. **The destination folder's `README.md`** and **the matching `.agents/` guide** (`.agents/website.md`, `.agents/backoffice.md`, or `.agents/services.md`).
8. **Any more-specific `AGENTS.md` in the target subtree.**

---

## Two-phase delivery workflow

Every change follows a strict two-phase process. **Phase 1** is about understanding and planning. **Phase 2** is about implementation with rigour. Only then does the commit happen.

### Phase 1 — Analysis and proposal (3 steps)

**Step 1.1 — Understand the context**

- Read the active milestone brief and identify the specific stakeholder, problem, and acceptance criteria.
- Read the existing code in the destination app: components, types, utilities, tests, and API clients.
- Identify the files that will be affected. Understand how they interconnect.
- Identify boundary cases: empty arrays, null/undefined values, missing API responses, edge conditions in data transformations.
- Read the test files if present — understand the expected contract.

**Step 1.2 — Propose a plan**

- Briefly outline the intended changes: which files to create or modify, what new logic is needed, what existing behaviour must be preserved.
- Identify which edge cases and invalid data paths must be handled.
- State the verification commands that will be run (e.g., `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`).
- If the task is ambiguous or breaks existing rules, ask for clarification before proceeding.

**Step 1.3 — Study existing tests and data contracts**

- Review the existing test suites to understand the expected inputs, outputs, and invariants.
- For API integrations: review the documented contract in `services/` and verify the wire format matches what the client code expects.
- Note any existing test gaps so they can be addressed in Phase 2.

---

### Phase 2 — Implementation with rigour (3 steps)

**Step 2.1 — Implement with edge-case handling**

- Write or modify code to satisfy the requirements.
- For every function or component, explicitly consider:
  - **Empty collections:** What happens when an array is empty? Does the function return a sensible default?
  - **Missing matches:** What happens when a search, filter, or lookup returns zero results?
  - **Null/undefined inputs:** Are optional parameters handled gracefully? Are null values coerced or rejected?
  - **Invalid data types:** What happens when a string arrives where a number is expected? When an API field is missing?
  - **Boundary values:** Zero, negative numbers, maximum-length strings, special characters, unicode, whitespace-only strings.
- Use TypeScript strict mode to catch type errors at compile time. Add type guards where data enters from untyped boundaries (API responses, form inputs, localStorage).
- Write code that is **readable for humans first, machines second**: use descriptive variable names, keep functions small and single-purpose, add concise comments for non-obvious logic.

**Step 2.2 — Test for every dimension**

Run all of the following checks. Report each result explicitly.

| Check | What to verify |
|---|---|
| **Functional correctness** | Does the code satisfy the acceptance criteria? Run existing tests. |
| **Edge cases** | Are empty arrays, nulls, missing data, and boundary values handled? Add tests for at least the most important edge cases. |
| **Type safety** | `tsc --noEmit` passes with no errors. |
| **Lint** | `npm run lint` passes with no warnings. |
| **Build** | `npm run build` succeeds in production mode. |
| **Human readability** | Are variable names clear? Are comments present where the logic is non-trivial? Is there unnecessary indirection or duplication? |
| **Resiliency** | Does the code degrade gracefully when external dependencies are unavailable (API down, missing network)? Does it show sensible error/loading states rather than crashing? |
| **Scalability / performance** | For list operations: are O(n²) patterns avoided? For searches: is pagination or client-side filtering efficient? For renders: are unnecessary re-renders prevented? |

If any check fails, fix the issue before proceeding.

**Step 2.3 — Final review and README alignment**

- Review the final diff for unrelated changes, leftover debug code, or console.log statements.
- If the change affects file structure, commands, or conventions, update the relevant README and the corresponding `.agents/` guide.
- If the change introduces a new external dependency or API call, document it in `services/` and update `memory-bank/techContext.md`.
- Update `memory-bank/progress.md` if a milestone deliverable has been advanced or completed.

---

### Commit execution

After both phases are complete:

1. **Stage only the intended files.** Verify with `git status --short` that no unintended files are included.
2. **Write a professional commit message** following this structure:

   ```
   <type>(<scope>): <imperative summary, max 72 chars>

   - Bullet point detailing what was changed and why
   - Each bullet is a complete sentence starting with a verb
   - Reference edge cases handled, tests added, or decisions made
   - If applicable, note what was verified (lint, typecheck, build, tests)
   ```

   Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`.

3. **Commit. Do not push in the same moment.** End the session after the commit; the user decides when to push.

---

## Protected paths — never modify without explicit developer confirmation

The following files and folders are **off-limits** without the user's explicit, verbal (or written) confirmation. If a task touches these, stop and ask.

| Path | Reason |
|---|---|
| **`contexts/`** | Milestone briefs — read-only source of requirements. Never edit or create files here. |
| **`uis/*/next.config.ts`** | Build and bundler configuration. Changes can break the production build. |
| **`uis/*/package.json`** (dependencies section) | Adding, removing, or changing dependency versions must be confirmed — it affects reproducibility and CI. |
| **`uis/*/tsconfig.json`** | TypeScript compiler settings affect the entire app. |
| **Any `.env` file or `.env.local`** | Environment variables and secrets. Never created, read, or committed. |
| **`services/talent-pipeline-api/README.md`** | External API contract. Updating it without verifying with the actual API endpoint can mislead every contributor. |
| **`uis/backoffice/lib/record-actions.ts` and `uis/backoffice/lib/records.ts`** | Talent Pipeline API transport layer. Changing these affects every API call in the backoffice. |
| **Root configuration files** (`.gitignore`, root `package.json` if created, `docker-compose.yml`) | Affect the entire repository and all contributors. |
| **Any file containing credentials, tokens, API keys, or connection strings** | Never written, committed, or pushed. If found, alert the user immediately. |

When in doubt about any file not listed here, err on the side of asking. It is better to ask than to break.

---

## Repository map

- `uis/website/` is the public React, TypeScript, and Next.js application.
- `uis/backoffice/` is the internal React, TypeScript, and Next.js application, including candidate operations and the Talent Pipeline.
- `services/` contains backend services and documented API integrations. Do not create a local proxy for the Talent Pipeline API unless requested.
- Keep scripts, skills, reusable libraries, and data in their existing purpose-specific top-level folders. Do not create a parallel application tree.

## Application layer and milestone scope

- The canonical product paths are `uis/website/` for the public site, `uis/backoffice/` for the internal app, and `services/` for backend APIs and services. Read the README in the destination before changing code.
- A destination path is an ownership boundary, not a request to create an app. The monorepo-organization task is documentation and repository guidance; do not scaffold or migrate app/API code for that task unless the active request explicitly asks for it.
- The company briefing describes future needs across departments; do not treat every listed need as an implementation request. Implement only the active milestone/task.
- Document-only external API entries under `services/` must say they are external and whether a local runtime implementation exists. Do not add a proxy for the Talent Pipeline API unless requested.

## Delivery workflow (summary)

- Keep changes within the owning app or service and preserve existing behavior unless requirements say otherwise.
- Add or update focused tests for behavior changes; consider empty collections, missing matches, and null values in TypeScript logic.
- Run the scoped lint, typecheck, tests, and production build that apply to the change. Report commands and results; state any checks that could not run.
- Review the final diff for unrelated changes and update the affected README when structure or commands change.
- Do not commit or open a pull request unless the user asks.

Read `docs/project-context.md` for cross-milestone business and technical orientation. Scoped conventions are in `.agents/README.md`; this file routes work to the matching guide because `.agents/` is documentation, not automatic instruction discovery.