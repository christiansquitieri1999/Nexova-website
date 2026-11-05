# Services and API integration conventions
- `services/` is the canonical destination when a task explicitly requests a backend API or service. The Monorepo Setup milestone alone does not request one.

- Backend implementations belong under `services/`; read this folder's README before adding one.
- Document external API dependencies under `services/` with ownership, base URL configuration, endpoints, methods, request/response shapes, pagination, validation, and error behavior.
- A documentation-only integration is not a locally deployed service. Do not add a proxy, duplicate client, or credentials unless explicitly required.
- Keep UI API calls in the owning app's API client until a real backend service is requested; update the integration documentation when its contract changes.