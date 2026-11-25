# Nexova backoffice

Internal Next.js application for the Talent Pipeline and Business Model candidate operations test bench. Built with React, TypeScript, and Tailwind CSS 4.

## App map

- `/` — Talent Pipeline and candidate search.
- `/candidates/new` and `/candidates/[id]` — candidate creation and profile workflows.
- `/login`, `/register`, `/forgot-password`, and `/reset-password` — account authentication and password recovery flows.
- `/account/profile` and `/account/change-password` — authenticated profile and password management.
- `/business-model` — sample candidate filters, searches, sorting, scoring, ranking, and selection reports.
- `/incidents` — centralized incident registration, filtering, lifecycle status updates, and aggregate metrics.
- `/suppliers` — searchable/filterable Supplier Directory with rate and status controls.
- `/suppliers/new` — supplier registration form.

The Talent Pipeline calls the external API configured by `NEXT_PUBLIC_API_URL`. It defaults to `https://playground.4geeks.com/tracker/api/v1`; see [`services/talent-pipeline-api`](../../services/talent-pipeline-api/README.md) for its documented contract and client behavior.

The Incident Manager calls the local API at `NEXT_PUBLIC_INCIDENTS_API_URL`
(default `http://127.0.0.1:8003`). Start it from the repository root with
`python services/api/incident_api.py`; see [`services/api`](../../services/api/README.md) for its
contract and seed instructions. The `/incidents` page provides registration, list filtering,
lifecycle status updates, and summary metrics.

The Supplier Directory uses the local TinyDB API at `NEXT_PUBLIC_SUPPLIER_API_URL` (default
`http://127.0.0.1:8001`). Start it from `services/api/` with `python supplier_api.py`; seed the
initial records there with `uv run seed`. The UI supports the API's country/category list filters,
creation, monthly-rate updates, and active/suspended status changes. See the Supplier Directory
section in [`services/api`](../../services/api/README.md) for endpoint contracts and validation.

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
npx tsx --test tests/business-model.test.ts tests/incidents.test.ts
npm run build
```
