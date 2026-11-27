"""Register a test user and save a masked-session token locally."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


BASE_URL = "http://127.0.0.1:8002"
TOKEN_PATH = Path(__file__).resolve().parent.parent / "nexova_token.txt"


def _post_json(path: str, payload: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        if response.status not in (200, 201):
            raise urllib.error.HTTPError(
                response.url,
                response.status,
                "Unexpected registration response",
                response.headers,
                None,
            )
        decoded = response.read().decode("utf-8")
        data = json.loads(decoded)
        if not isinstance(data, dict):
            raise ValueError("The API returned an invalid JSON object.")
        return data


def main() -> int:
    try:
        _post_json("/users", {"email": "admin@nexova.com", "password": "admin123"})
        print("Registration succeeded.")
    except urllib.error.HTTPError as error:
        if error.code != 409:
            print(
                "User registration failed. Check the User API and try again.",
                file=sys.stderr,
            )
            return 1
        print("The test user already exists.")
    except (urllib.error.URLError, TimeoutError):
        print(
            "Unable to reach the User API. Start it on port 8002 and try again.",
            file=sys.stderr,
        )
        return 1
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        print("The User API returned an invalid response.", file=sys.stderr)
        return 1

    try:
        login = _post_json(
            "/auth/login",
            {"email": "admin@nexova.com", "password": "admin123"},
        )
        token = login.get("access_token")
        if not isinstance(token, str) or not token:
            raise ValueError("The login response did not include an access token.")
    except urllib.error.HTTPError:
        print("Login failed. Verify the test-user credentials.", file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError):
        print(
            "Unable to reach the User API. Start it on port 8002 and try again.",
            file=sys.stderr,
        )
        return 1
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        print("The login response was invalid.", file=sys.stderr)
        return 1

    try:
        TOKEN_PATH.write_text(token, encoding="utf-8")
    except OSError:
        print("Unable to save the local test token.", file=sys.stderr)
        return 1

    masked = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else "***"
    print(f"Login succeeded. Token: {masked}")
    print("Token saved to the local test-token file.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())