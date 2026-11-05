# Nexova public website

Public-facing Nexova website and talent application form, implemented with Next.js, React, TypeScript, and Tailwind CSS 4.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The home page is `/`; the application form is `/application`. The former `/application.html` address redirects to the new route.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

The form validates fields in the browser and currently does not submit personal data to a backend. Homepage photography is stored locally in `public/images/`.