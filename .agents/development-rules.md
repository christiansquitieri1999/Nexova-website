---
name: development-rules
description: General development rules that apply across the monorepo, organised by activation scope.
---

# Development Rules

Rules are grouped by **activation scope**. Some are always active, others activate only for certain file patterns or when explicitly requested.

---

## 🔒 Always active

These rules apply to **every change**, regardless of file type or task.

### Rule DR-1: Two-phase delivery workflow

**Scope:** always active

Every change must follow the two-phase process defined in root `AGENTS.md`:

- **Phase 1** — Understand context, propose a plan, study existing tests and data contracts.
- **Phase 2** — Implement with edge-case handling, test for every dimension, final review and README alignment.

Never skip to implementation without completing Phase 1 first.

---

### Rule DR-2: Contexts are read-only

**Scope:** always active

Files under `contexts/` are milestone briefs. Never edit, rename, delete, or create files inside this folder unless the user explicitly authorises it in writing. Persistent cross-milestone documentation belongs in `docs/` or `memory-bank/`.

---

### Rule DR-3: Protected paths require confirmation

**Scope:** always active

The following paths must never be modified without explicit developer confirmation:

| Path | Reason |
|---|---|
| `uis/*/next.config.ts` | Build and bundler configuration — changes can break production builds |
| `uis/*/package.json` (dependencies) | Dependency changes affect reproducibility and CI |
| `uis/*/tsconfig.json` | TypeScript settings affect the entire app |
| `uis/backoffice/lib/record-actions.ts` | API transport layer — every API call depends on it |
| `uis/backoffice/lib/records.ts` | API transport layer — every API call depends on it |
| `services/talent-pipeline-api/README.md` | External API contract — must be verified against the live endpoint |
| Root `.gitignore`, `docker-compose.yml` | Affect all contributors and environments |
| Any `.env`, `.env.local`, or file with credentials | Secrets — never created, read, or committed |

When in doubt, ask before modifying.

---

### Rule DR-4: Commits are separated from pushes

**Scope:** always active

After staging and committing changes, never push in the same turn. End the session after the commit. The user decides when to push.

For branch switching, always use `git switch` (never `git checkout`).

---

### Rule DR-5: Human-readable code first

**Scope:** always active

Write code for **humans first, machines second**. Use descriptive variable names, keep functions small and single-purpose, and add concise comments for non-obvious logic. Avoid unnecessary indirection or duplication.

---

### Rule DR-6: Report verification results

**Scope:** always active

After running lint, typecheck, tests, or build, report the **actual output** — not just "passes". State the commands run, the exit codes, and any warnings or errors. If a check could not run, explain why.

---

## 📁 File-pattern based

These rules activate automatically when the changes touch specific file patterns.

### Rule FR-1: TypeScript business logic

**Scope:** activates for `**/*.ts`, `**/*.tsx` files containing business logic (not purely presentational)

- Explicitly handle empty arrays, missing matches, null/undefined inputs, and boundary values.
- Use TypeScript strict mode; add type guards at untyped boundaries (API responses, form inputs, `localStorage`).
- Run `tsc --noEmit` after edits.

---

### Rule FR-2: External API calls

**Scope:** activates for files under `uis/*/lib/` or `services/` that make HTTP requests

- Document the external contract in `services/<service-name>/README.md` before writing client code.
- Handle loading, error, empty, and success states in the UI.
- Never commit API keys, tokens, or credentials. Use environment variables with the `NEXT_PUBLIC_` prefix for client-safe vars.

---

### Rule FR-3: Tests

**Scope:** activates for `**/*.test.ts`, `**/*.spec.ts`, or files in a `tests/` directory

- Cover at least: happy path, empty input, null/undefined input, boundary values, and invalid data types.
- Use descriptive test names that state the scenario and expected outcome.
- Keep tests independent — no shared mutable state between test cases.

---

### Rule FR-4: Markdown documentation

**Scope:** activates for `**/README.md`, `**/README.es.md`, `**/*.md` in `docs/`, `memory-bank/`, `.agents/`

- Keep bilingual alignment: if a document has an English version, its Spanish `.es.md` counterpart should reflect the same structure and updates.
- Use absolute or repo-root-relative links for cross-document references.
- When updating a README, verify that any referenced file paths, commands, or conventions are still accurate.

---

## 🤖 Agent-requested

These rules activate only when an agent or the user explicitly invokes them.

### Rule AR-1: Resiliency audit

**Scope:** agent-requested

Review the changed code for:

- Degraded behaviour when external dependencies are unavailable (API down, missing network).
- Sensible error/loading states instead of crashes or white screens.
- Missing error boundaries in React components.
- Unhandled promise rejections or uncaught exceptions.

---

### Rule AR-2: Performance review

**Scope:** agent-requested

Review the changed code for:

- O(n²) patterns in list operations that could be optimised.
- Missing pagination for large datasets.
- Unnecessary re-renders (missing `useMemo`, `useCallback`, or key props).
- Large bundle imports that could be lazy-loaded.

---

### Rule AR-3: Security scan

**Scope:** agent-requested

Review the changed code for:

- Hardcoded secrets, tokens, or credentials.
- Unsafe `innerHTML`, `dangerouslySetInnerHTML`, or unescaped user input rendered to the DOM.
- Missing input sanitisation on form fields or URL parameters.
- Exposure of internal paths or environment details in error messages.