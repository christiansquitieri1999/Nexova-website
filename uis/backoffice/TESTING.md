# Backoffice TypeScript test plan

## Authentication utility tests

Run from `uis/backoffice/`:

```bash
npm run test:jest
npm run test:jest:coverage
npm run typecheck
npm run lint
npm run build
```

The Jest configuration is [jest.config.ts](./jest.config.ts).

## Coverage matrix

Authentication utility tests cover:

| Area | Happy path | Edge cases | Failure modes |
|---|---|---|---|
| Token storage | Store/read/clear token | Browser unavailable | Storage throws |
| Authorization header | Bearer token present | No token | Missing window/localStorage |
| Login | Valid JWT response | Default token type, malformed success payload | Network failure, invalid credentials, invalid JSON |
| API wrapper | Successful fetch/JSON | Null/empty response data | Network and JSON parsing failures |

Tests assert business outcomes rather than HTTP framework internals:

- Valid credentials create an authenticated session.
- Invalid credentials produce a user-readable error.
- Network outages produce a safe fallback.
- Malformed API payloads never become a fake successful login.
- Missing browser storage does not crash utility calls.

## AI-assisted workflow

An AI coding agent may be used to propose additional edge cases for authentication
and API utilities. Suggested prompts must identify:

- Empty, missing, duplicate, malformed, and boundary values.
- Invalid credentials and expired or malformed tokens.
- Storage unavailable or throwing exceptions.
- Network outage and invalid JSON responses.
- Authorization failures and cross-user operations.

Generated tests must assert observable business behavior and HTTP contract
outcomes. They must not test framework internals or framework serialization
details. A generated test that exposes a bug must include the failing case,
the root-cause fix, and a rerun proving the regression is resolved in
[TESTING.md](./TESTING.md).
