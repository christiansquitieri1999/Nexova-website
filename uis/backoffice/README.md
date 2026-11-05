# Nexova backoffice

Internal Next.js application for the Talent Pipeline and Business Model candidate operations test bench. Built with React, TypeScript, and Tailwind CSS 4.

## App map

- `/` — Talent Pipeline and candidate search.
- `/candidates/new` and `/candidates/[id]` — candidate creation and profile workflows.
- `/business-model` — sample candidate filters, searches, sorting, scoring, ranking, and selection reports.

The Talent Pipeline calls the external API configured by `NEXT_PUBLIC_API_URL`. It defaults to `https://playground.4geeks.com/tracker/api/v1`; see [`services/talent-pipeline-api`](../../services/talent-pipeline-api/README.md) for its documented contract and client behavior.

## Run locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
