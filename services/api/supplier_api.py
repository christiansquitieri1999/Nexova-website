#!/usr/bin/env python3
"""HTTP API for the Nexova Supplier Directory.

Endpoints
--------
POST   /suppliers              Register a new supplier
GET    /suppliers              List suppliers (optional ?country= & ?category=)
GET    /suppliers/{id}         Get supplier detail
PATCH  /suppliers/{id}/rate    Update monthly rate
PATCH  /suppliers/{id}/status  Activate or suspend
DELETE /suppliers/{id}         Remove a supplier

Run with:
    python supplier_api.py
"""

from __future__ import annotations

import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

from pydantic import ValidationError

from auth import get_current_user
from auth_service import UserService
from supplier_models import (
    VALID_STATUSES,
    SupplierCreate,
    safe_validation_errors,
)
from supplier_store import SupplierStore

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------

HOST = "0.0.0.0"
PORT = 8001
ALLOWED_ORIGIN = "http://localhost:3000"

_PATH_RE_SUPPLIERS = re.compile(r"^/suppliers/?$")
_PATH_RE_SUPPLIER_ID = re.compile(r"^/suppliers/([a-f0-9]+)/?$")
_PATH_RE_RATE = re.compile(r"^/suppliers/([a-f0-9]+)/rate/?$")
_PATH_RE_STATUS = re.compile(r"^/suppliers/([a-f0-9]+)/status/?$")

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
    handler.send_header(
        "Access-Control-Allow-Headers", "Content-Type, Authorization"
    )
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


class SupplierHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Supplier Directory API."""

    store = SupplierStore()  # class-level, shared across requests
    user_service = UserService()  # for JWT token validation

    # ---- Auth helpers ----

    def _get_token_from_header(self) -> str | None:
        """Extract the Bearer token from the Authorization header."""
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[len("Bearer ") :].strip()
        if not token:
            return None
        return token

    def _check_auth(self) -> str | None:
        """Require authentication.  Returns user_id or sends 401 and returns None."""
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
        self.send_header(
            "Access-Control-Allow-Headers", "Content-Type, Authorization"
        )
        self.end_headers()

    # ---- GET ----

    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        m = _PATH_RE_SUPPLIERS.match(path)
        if m:
            return self._list_suppliers()
        m = _PATH_RE_SUPPLIER_ID.match(path)
        if m:
            return self._get_supplier(m.group(1))
        error_response(self, 404, "Not found")

    # ---- POST ----

    def do_POST(self) -> None:
        path = self.path
        m = _PATH_RE_SUPPLIERS.match(path)
        if m:
            return self._create_supplier()
        error_response(self, 404, "Not found")

    # ---- PATCH ----

    def do_PATCH(self) -> None:
        path = self.path
        m = _PATH_RE_RATE.match(path)
        if m:
            return self._update_rate(m.group(1))
        m = _PATH_RE_STATUS.match(path)
        if m:
            return self._update_status(m.group(1))
        error_response(self, 404, "Not found")

    # ---- DELETE ----

    def do_DELETE(self) -> None:
        path = self.path
        m = _PATH_RE_SUPPLIER_ID.match(path)
        if m:
            return self._delete_supplier(m.group(1))
        error_response(self, 404, "Not found")

    # ---- Internal handlers ----

    def _list_suppliers(self) -> None:
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        country = params.get("country", [None])[0]
        category = params.get("category", [None])[0]
        suppliers = self.store.filter(country=country, category=category)
        json_response(self, 200, [s.model_dump() for s in suppliers])

    def _get_supplier(self, supplier_id: str) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return
        supplier = self.store.get_by_id(supplier_id)
        if supplier is None:
            error_response(self, 404, f"Supplier '{supplier_id}' not found")
            return
        json_response(self, 200, supplier.model_dump())

    def _create_supplier(self) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return
        try:
            payload = SupplierCreate.model_validate(body)
        except ValidationError as e:
            errs = safe_validation_errors(e.errors(include_url=False))
            error_response(self, 422, "Validation error", errs)
            return
        supplier = self.store.create(payload)
        json_response(self, 201, supplier.model_dump())

    def _update_rate(self, supplier_id: str) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return
        monthly_rate = body.get("monthly_rate")
        if monthly_rate is None:
            error_response(self, 422, "Field 'monthly_rate' is required")
            return
        if not isinstance(monthly_rate, (int, float)) or monthly_rate <= 0:
            error_response(self, 422, "'monthly_rate' must be a positive number")
            return
        supplier = self.store.update_rate(supplier_id, float(monthly_rate))
        if supplier is None:
            error_response(self, 404, f"Supplier '{supplier_id}' not found")
            return
        json_response(self, 200, supplier.model_dump())

    def _update_status(self, supplier_id: str) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return
        status_val = body.get("status")
        if status_val is None:
            error_response(self, 422, "Field 'status' is required")
            return
        if status_val not in VALID_STATUSES:
            valid_list = ", ".join(VALID_STATUSES)
            error_response(
                self,
                422,
                f"Invalid status '{status_val}'. Must be one of {valid_list}",
            )
            return
        supplier = self.store.update_status(supplier_id, status_val)
        if supplier is None:
            error_response(self, 404, f"Supplier '{supplier_id}' not found")
            return
        json_response(self, 200, supplier.model_dump())

    def _delete_supplier(self, supplier_id: str) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return
        deleted = self.store.delete(supplier_id)
        if not deleted:
            error_response(self, 404, f"Supplier '{supplier_id}' not found")
            return
        json_response(self, 200, {"deleted": supplier_id})

    # ---- suppress server logs ----

    def log_message(self, fmt: str, *args) -> None:
        pass

def run_server(host: str = HOST, port: int = PORT) -> HTTPServer:
    server = HTTPServer((host, port), SupplierHandler)
    print(f"Supplier API listening on http://{host}:{port}")
    return server


if __name__ == "__main__":
    server = run_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()
