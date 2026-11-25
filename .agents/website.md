# Public website conventions
- `uis/website/` is the canonical destination when a task explicitly requires public-site product code; its existence alone is not a request to add a feature or scaffold another app.

- The public application belongs in `uis/website/`; use its local README for setup and commands.
- Use React components, TypeScript, and the installed Next.js App Router. Do not add a standalone HTML app beside it.
- Preserve the existing public-site content, SEO metadata, Organization structured data, navigation, and candidate application form behavior during migration.
- Keep form validation accessible: associate errors with fields, expose invalid state, focus the first invalid field on submit, and retain the character counter and reset behavior.
- Before changing Next.js APIs, read the matching documentation installed with the app as required by its local instructions.