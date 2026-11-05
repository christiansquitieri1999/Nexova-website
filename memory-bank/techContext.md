# Nexova Solutions — Technical Context

## Tech Stack

### Core technologies (shared across all apps)

| Technology | Version | Usage |
|---|---|---|
| **Next.js** | 16.4.3 | React framework for both website and backoffice (App Router) |
| **React** | 19.3.0 | UI component library |
| **TypeScript** | ^5 | Type-safe JavaScript with strict mode enabled |
| **Tailwind CSS** | ^4 | Utility-first CSS framework via Turbopack integration |
| **Turbopack** | — | Rust-based bundler (Next.js default, with `@tailwindcss/turbopack` loader for CSS) |
| **ESLint** | ^9 | Linting via `eslint-config-next` |
| **Node.js** | ^20 | Runtime requirement |

### Website-specific (`uis/website/`)

| Tool / Lib | Purpose |
|---|---|
| `@types/react`, `@types/react-dom`, `@types/node` | TypeScript type definitions |
| — | No test runner configured (static-only app) |

### Backoffice-specific (`uis/backoffice/`)

| Tool / Lib | Purpose |
|---|---|
| `tsx` | ^4 — Execute TypeScript tests directly (used with `node:test`) |
| `@types/react`, `@types/react-dom`, `@types/node` | TypeScript type definitions |
| `node:test` + `node:assert/strict` | Built-in Node.js test framework — used for Business Model unit tests |

### External Dependencies

| Dependency | Type | Details |
|---|---|---|
| **Talent Pipeline API** | External HTTP API | Hosted at `https://playground.4geeks.com/tracker/api/v1` (configurable via `NEXT_PUBLIC_API_URL`). No local proxy or runtime service. Documented at `services/talent-pipeline-api/README.md`. |
| **Reusable shared types** | Local package | Defined at `packages/shared/types/index.ts` under `@repo/shared-types`. Not consumed by current apps (no root workspace runner configured to link them). |

---

## Architectural Decisions

### 1. Monorepo with per-app isolation (no root workspace runner)

Each application in `uis/` has its own `package.json`, `tsconfig.json`, `node_modules`, and build scripts. There is **no root workspace configuration** (no npm/pnpm/yarn workspaces, no Turborepo). This means:
- Apps are built and run independently from their own directories.
- There is no shared `node_modules` hoisting.
- Adding a root `dev` script is deferred until multiple apps need parallel execution.

**Rationale:** The template is a student monorepo designed for sequential milestone work. Per-app isolation avoids dependency conflicts and keeps setup simple.

### 2. Canonical application paths

Every UI lives under `uis/` — there are no parallel top-level app directories:
- `uis/website/` — public corporate site
- `uis/backoffice/` — internal management app (Talent Pipeline + Business Model)

Legacy paths (`Nexova-website/`, `Nexova-businessModel/`, `uis/talent-pipeline-tracker/`) have been removed. Any new application must go into an existing or new subfolder under `uis/` or `services/`.

### 3. No local API proxy

The Talent Pipeline API is an external mock hosted at `playground.4geeks.com`. It is consumed directly from the backoffice client code. No local proxy, BFF, or server-side wrapper is introduced unless a future milestone explicitly requests one.

### 4. Contexts are read-only

All files under `contexts/` are milestone briefs. They are never modified by implementation work. Persistent cross-milestone documentation lives in `docs/project-context.md`.

### 5. Agent workflow rules

The root `AGENTS.md` enforces a mandatory read-before-edit workflow:
1. Read `README.md` → read milestone brief → read destination README
2. Find the matching `.agents/` guide (website, backoffice, or services)
3. Read any more-specific `AGENTS.md` in the target subtree
4. Implement → check → report

Scoped `.agents/` guides clarify that **destination paths are ownership boundaries, not feature requests**.

---

## Technical Constraints

### Build & runtime

- Both apps use **Next.js 16 App Router** with Turbopack as the default bundler.
- Both apps use **Tailwind CSS 4** via the `@tailwindcss/turbopack` loader (configured in `next.config.ts`).
- TypeScript is configured with **strict mode** (`"strict": true`) in both apps.
- The website redirects `/application.html` → `/application` (301 permanent) for backward compatibility.
- The backoffice enables `cacheComponents` and `partialPrefetching` for performance.

### Testing

- Backoffice only: unit tests run via `tsx --test tests/business-model.test.ts` using Node.js built-in `node:test` and `node:assert/strict`.
- Website has no test runner configured (pure static Next.js app).

### Deployment

- No Docker or CI/CD configuration is present at the repository level.
- The root `.gitignore` is empty — each app has its own `.gitignore` covering `node_modules`, `.next/`, `.env*`, etc.

### Repository conventions

- READMEs are bilingual (English + Spanish `.es.md`) for all top-level folders.
- Documentation is in `docs/`; agent capabilities are in `skills/`; agents live in `agents/`.
- Every new app, service, agent, or pipeline gets a subfolder + README.
- The root `.gitignore` is empty — app-level `.gitignore` files handle exclusions.

### Known gaps / future considerations

- The root `.gitignore` should be populated (currently empty; relies on per-app `.gitignore` files).
- No root workspace runner exists to run both apps in parallel or share types across packages.
- The `packages/shared/` types are not yet consumed by any app.
- No deployment scripts or container configuration exist yet.