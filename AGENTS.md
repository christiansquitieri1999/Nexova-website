# Repository workflow

Before changing code:

1. Read this file and the root `README.md`.
2. Read the relevant milestone brief under `contexts/` as read-only input. Do not edit or create files under `contexts/` unless the user explicitly authorizes it.
3. Read the destination folder's `README.md` and the matching scoped guide under `.agents/`.
4. Read any more-specific `AGENTS.md` in the target subtree. For Next.js changes, follow its installed-version documentation instructions.

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

## Delivery workflow

- Keep changes within the owning app or service and preserve existing behavior unless requirements say otherwise.
- Add or update focused tests for behavior changes; consider empty collections, missing matches, and null values in TypeScript logic.
- Run the scoped lint, typecheck, tests, and production build that apply to the change. Report commands and results; state any checks that could not run.
- Review the final diff for unrelated changes and update the affected README when structure or commands change.
- Do not commit or open a pull request unless the user asks.

Read `docs/project-context.md` for cross-milestone business and technical orientation. Scoped conventions are in `.agents/README.md`; this file routes work to the matching guide because `.agents/` is documentation, not automatic instruction discovery.