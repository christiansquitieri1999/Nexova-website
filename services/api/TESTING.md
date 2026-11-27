# Authentication API test plan

## Run

Run the complete API suite from this directory:

```bash
uv run pytest
```

Run authentication tests and coverage:

```bash
uv run pytest test_register.py test_login.py test_token.py test_user_api.py
uv run pytest --cov=. --cov-report=term-missing
```

The minimum coverage gate for the authentication module is 70%.

The suite uses `httpx2` through Starlette's `TestClient`, as required by the
currently installed Starlette version. Legacy `httpx` is not needed.

## Coverage matrix

Every authentication endpoint must have:

- One happy-path test with valid credentials and expected HTTP 200/201 output.
- One edge-case test for empty, missing, malformed, duplicate, expired, or boundary values.
- One failure-mode test for invalid credentials, missing authorization, nonexistent data, or external-service failure.

The suite covers:

| Area | Happy path | Edge cases | Failure modes |
|---|---|---|---|
| Registration | Valid user/profile | Duplicate email, weak password, invalid email, oversized profile | Malformed JSON |
| Login | Valid user returns JWT | Missing fields and wrong field types | Unknown user and wrong password |
| Session token | Valid round trip | Wrong secret and malformed token | Expired or invalid token |
| Password reset | Valid reset token | Missing reset data and short expiry | Invalid, reused, expired, or wrong-purpose token |
| Protected resources | Valid bearer token | Missing bearer prefix | Expired or malformed bearer token |
| Authorization | Self/admin operations | Cross-user updates/deletes | Missing/invalid role permissions |
