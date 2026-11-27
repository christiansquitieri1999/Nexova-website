"""Verify seeded incident data via the local Incident Manager API."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


BASE_URL = "http://127.0.0.1:8003"


def _fetch_json(path: str) -> object:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=5) as response:
        if response.status != 200:
            raise urllib.error.HTTPError(
                response.url,
                response.status,
                "Unexpected response status",
                response.headers,
                None,
            )
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    try:
        summary = _fetch_json("/api/incidents/summary")
        incidents = _fetch_json("/api/incidents")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        print(
            "Unable to reach the Incident Manager API. Start it on port 8003 and try again.",
            file=sys.stderr,
        )
        return 1
    except (json.JSONDecodeError, UnicodeDecodeError):
        print("The Incident Manager API returned an invalid response.", file=sys.stderr)
        return 1

    if not isinstance(summary, dict):
        print("The incident summary response was not valid.", file=sys.stderr)
        return 1
    if not isinstance(incidents, list):
        print("The incidents response was not valid.", file=sys.stderr)
        return 1

    print("=== SUMMARY ===")
    print(json.dumps(summary, indent=2))

    print(f"\n=== LIST: {len(incidents)} total incidents ===")
    for incident in incidents[:5]:
        if not isinstance(incident, dict):
            continue
        status = incident.get("status", "UNKNOWN")
        title = str(incident.get("title") or "")[:80]
        origin = incident.get("origin", "")
        branch = incident.get("branch", "")
        print(f"  [{status}] {title} | {origin} | {branch}")
    print("  ...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())