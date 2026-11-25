#!/usr/bin/env python3
"""HTTP API for the Nexova Incident Manager.

Endpoints
--------
POST   /api/incidents                Create a new incident
GET    /api/incidents                List incidents (?status=&origin=&branch=&category=)
GET    /api/incidents/{id}           Get incident detail
PATCH  /api/incidents/{id}/status    Update incident status (lifecycle-validated)
GET    /api/incidents/summary        Aggregated metrics

Run with:
    python incident_api.py
"""

from __future__ import annotations

import json
import re
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

from pydantic import ValidationError
from urllib.parse import urlparse, parse_qs

from auth import get_current_user
from auth_service import UserService
from incident_models import (
    IncidentCategory,
    IncidentStatus,
    IncidentOrigin,
    IncidentBranch,
    IncidentCreate,
    VALID_STATUS_TRANSITIONS,
)
from incident_store import IncidentStore

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------

HOST = "0.0.0.0"
PORT = 8003
ALLOWED_ORIGIN = "http://localhost:3000"

_PATH_RE_INCIDENTS = re.compile(r"^/api/incidents/?$")
_PATH_RE_INCIDENT_ID = re.compile(r"^/api/incidents/([a-f0-9]+)/?$")
_PATH_RE_STATUS = re.compile(r"^/api/incidents/([a-f0-9]+)/status/?$")
_PATH_RE_SUMMARY = re.compile(r"^/api/incidents/summary/?$")


def safe_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only safe (non-internal) fields from Pydantic validation errors."""
    safe: list[dict[str, Any]] = []
    for error in errors:
        field = " -> ".join(str(loc) for loc in error.get("loc", [])) or "request"
        error_type = error.get("type", "")

        if error_type == "missing":
            message = "This field is required."
        elif error_type in {"string_too_short", "too_short"}:
            message = "Enter at least one character."
        elif error_type in {"string_too_long", "too_long"}:
            message = "The value is too long."
        elif error_type in {"literal_error", "enum"}:
            message = "Choose one of the allowed values."
        elif error_type == "extra_forbidden":
            message = "This field is not allowed."
        elif "cannot be blank" in str(error.get("msg", "")).lower():
            message = "Enter at least one character."
        else:
            message = "The value is invalid."

        safe.append({"field": field, "message": message})
    return safe


# ------------------------------------------------------------------
# Response helpers
# ------------------------------------------------------------------


def json_response(
    handler: BaseHTTPRequestHandler,
    status: int,
    data: Any,
) -> None:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
    handler.send_header(
        "Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"
    )
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)
    handler.wfile.flush()


def error_response(
    handler: BaseHTTPRequestHandler,
    status: int,
    message: str,
    details: Any = None,
) -> None:
    payload: dict[str, Any] = {"error": message}
    if details is not None:
        payload["details"] = details
    json_response(handler, status, payload)


def read_json_body(handler: BaseHTTPRequestHandler) -> Any:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return None
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ------------------------------------------------------------------
# Request handler
# ------------------------------------------------------------------


class IncidentHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Incident Manager API."""

    store = IncidentStore()  # class-level, shared across requests
    user_service = UserService()  # for JWT token validation

    # ---- Auth helpers ----

    def _get_token_from_header(self) -> str | None:
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[len("Bearer "):].strip()
        if not token:
            return None
        return token

    def _check_auth(self) -> str | None:
        token = self._get_token_from_header()
        if token is None:
            error_response(
                self, 401, "Authentication required. Send a valid JWT Bearer token."
            )
            return None
        user = get_current_user(token, self.user_service)
        if user is None:
            error_response(self, 401, "Invalid or expired authentication token")
            return None
        return user["id"]

    # ---- CORS preflight ----

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header(
            "Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ---- Unhandled exception guard ----

    def _safe_dispatch(self, method_name: str, *args: Any, **kwargs: Any) -> None:
        """Run the named method and catch any unhandled exception.

        Never exposes stack traces to the client. The full traceback is
        printed to stderr for server-side debugging.
        """
        try:
            getattr(self, method_name)(*args, **kwargs)
        except Exception:
            traceback.print_exc()
            error_response(
                self,
                500,
                "An unexpected error occurred. Please try again later.",
            )

    # ---- GET ----

    def do_GET(self) -> None:
        self._safe_dispatch("_do_get")

    def _do_get(self) -> None:
        path = self.path.split("?")[0]

        # /api/incidents/summary must be checked before /api/incidents/{id}
        m = _PATH_RE_SUMMARY.match(path)
        if m:
            return self._summary()

        m = _PATH_RE_INCIDENTS.match(path)
        if m:
            return self._list_incidents()

        m = _PATH_RE_INCIDENT_ID.match(path)
        if m:
            return self._get_incident(m.group(1))

        error_response(self, 404, "Not found")

    # ---- POST ----

    def do_POST(self) -> None:
        self._safe_dispatch("_do_post")

    def _do_post(self) -> None:
        path = self.path
        m = _PATH_RE_INCIDENTS.match(path)
        if m:
            return self._create_incident()
        error_response(self, 404, "Not found")

    # ---- PATCH ----

    def do_PATCH(self) -> None:
        self._safe_dispatch("_do_patch")

    def _do_patch(self) -> None:
        path = self.path
        m = _PATH_RE_STATUS.match(path)
        if m:
            return self._update_status(m.group(1))
        error_response(self, 404, "Not found")

    # ---- Internal handlers ----

    def _list_incidents(self) -> None:
        """GET /api/incidents — list with optional filters.

        Returns an empty list when the database is empty (no error).
        """
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        status = params.get("status", [None])[0]
        origin = params.get("origin", [None])[0]
        branch = params.get("branch", [None])[0]
        category = params.get("category", [None])[0]

        incidents = self.store.list_all(
            status=status,
            origin=origin,
            branch=branch,
            category=category,
        )
        json_response(self, 200, [i.model_dump(mode="json") for i in incidents])

    def _get_incident(self, incident_id: str) -> None:
        """GET /api/incidents/{id} — single incident detail."""
        caller_id = self._check_auth()
        if caller_id is None:
            return
        incident = self.store.get_by_id(incident_id)
        if incident is None:
            error_response(self, 404, f"Incident '{incident_id}' not found")
            return
        json_response(self, 200, incident.model_dump(mode="json"))

    def _create_incident(self) -> None:
        """POST /api/incidents — create a new incident.

        Returns 400 with field-level validation errors when the request
        body is missing required fields or contains invalid values.
        """
        caller_id = self._check_auth()
        if caller_id is None:
            return
        body = read_json_body(self)
        if body is None:
            error_response(
                self,
                400,
                "Invalid JSON body. Ensure the request contains a valid JSON object.",
            )
            return
        if not isinstance(body, dict):
            error_response(self, 400, "Request body must be a JSON object")
            return
        try:
            payload = IncidentCreate.model_validate(body)
        except ValidationError as e:
            errs = safe_validation_errors(e.errors(include_url=False))
            error_response(self, 400, "Validation error", errs)
            return
        incident = self.store.create(payload)
        json_response(self, 201, incident.model_dump(mode="json"))

    def _update_status(self, incident_id: str) -> None:
        """PATCH /api/incidents/{id}/status — lifecycle-validated status change.

        Returns 400 with field-level details when the transition is
        invalid or the status value is unknown. Returns 404 when the
        incident does not exist.
        """
        caller_id = self._check_auth()
        if caller_id is None:
            return
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 400, "Request body must be a JSON object")
            return
        new_status = body.get("status")
        if new_status is None:
            error_response(
                self,
                400,
                "Field 'status' is required",
                [{"field": "status", "message": "This field is required"}],
            )
            return
        if not isinstance(new_status, str):
            error_response(
                self,
                400,
                "Field 'status' must be a string",
                [{"field": "status", "message": "Must be a text value"}],
            )
            return

        incident = self.store.update_status(incident_id, new_status)
        if incident is None:
            existing = self.store.get_by_id(incident_id)
            if existing is None:
                error_response(
                    self,
                    404,
                    f"Incident '{incident_id}' not found",
                )
            else:
                current = existing.status.value
                error_response(
                    self,
                    400,
                    f"Invalid status transition from '{current}' to '{new_status}'.",
                    [{
                        "field": "status",
                        "message": (
                            f"Cannot transition from '{current}' to '{new_status}'. "
                            f"Allowed transitions from '{current}': "
                            + _allowed_transitions_str(current)
                            + "."
                        ),
                    }],
                )
            return

        json_response(self, 200, incident.model_dump(mode="json"))

    def _summary(self) -> None:
        """GET /api/incidents/summary — aggregated metrics.

        Returns zero-valued metrics when the database is empty
        (no error).
        """
        data = self.store.summary()
        json_response(self, 200, data)

    def log_message(self, fmt: str, *args) -> None:
        pass


def _allowed_transitions_str(status_value: str) -> str:
    """Return a human-readable list of allowed transitions from a status."""
    try:
        current_enum = IncidentStatus(status_value)
    except ValueError:
        return "no valid transitions"
    allowed = VALID_STATUS_TRANSITIONS.get(current_enum, frozenset())
    if not allowed:
        return "none (final state)"
    return ", ".join(sorted(s.value for s in allowed))


def run_server(host: str = HOST, port: int = PORT) -> HTTPServer:
    server = HTTPServer((host, port), IncidentHandler)
    print(f"Incident Manager API listening on http://{host}:{port}")
    return server


if __name__ == "__main__":
    server = run_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()