# Backoffice conventions
- `uis/backoffice/` is the canonical destination when a task explicitly requires internal-app product code; its existence alone is not a request to add a feature or scaffold another app.

- The internal application belongs in `uis/backoffice/`; keep the Talent Pipeline and Business Model capabilities in this one Next.js app.
- Reuse the TypeScript domain models and utility functions for candidate filtering, searching, sorting, scoring, ranking, validation, and reports. Do not duplicate business rules in UI components.
- Preserve the Talent Pipeline's existing external API integration and its loading, error, and empty states. Do not replace it with sample data or a local proxy.
- Keep API transport and response validation in the existing client modules; document the external contract in `services/talent-pipeline-api/README.md`.
- Before changing Next.js APIs, read the matching documentation installed with the app as required by its local instructions.