#!/usr/bin/env python3
"""HTTP API for User and Profile management.

Endpoints
---------
POST   /auth/login         Authenticate and receive a JWT token
GET    /auth/me            Return authenticated user + profile (protected)
POST   /users              Register a new user (with optional profile)
GET    /users              List all users (protected)
GET    /users/{id}         Get a single user (protected)
PUT    /users/{id}         Update credential fields (protected - self or admin)
DELETE /users/{id}         Delete a user and linked profile (protected)

Run with:
    python user_api.py
"""

from __future__ import annotations

import json
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Optional

from pydantic import ValidationError

from auth import create_access_token, get_current_user
from auth_models import (
    UserCreate,
    UserUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
)
from auth_service import UserService
from password_reset import PasswordResetService, send_password_reset_email
from profile_models import ProfileCreate, ProfileUpdate
from profile_service import ProfileService

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------

HOST = "0.0.0.0"
PORT = 8002
ALLOWED_ORIGIN = "http://localhost:3000"

_PATH_RE_AUTH_LOGIN = re.compile(r"^/auth/login/?$")
_PATH_RE_AUTH_ME = re.compile(r"^/auth/me/?$")
_PATH_RE_AUTH_FORGOT_PASSWORD = re.compile(r"^/auth/forgot-password/?$")
_PATH_RE_AUTH_RESET_PASSWORD = re.compile(r"^/auth/reset-password/?$")
_PATH_RE_AUTH_CHANGE_PASSWORD = re.compile(r"^/auth/change-password/?$")
_PATH_RE_USERS = re.compile(r"^/users/?$")
_PATH_RE_USER_ID = re.compile(r"^/users/([a-zA-Z0-9_-]+)/?$")
_PATH_RE_PROFILES_ME = re.compile(r"^/profiles/me/?$")


# ------------------------------------------------------------------
# Response helpers (mirror supplier_api.py style)
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
        "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
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


def safe_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sanitize Pydantic error list for JSON serialization."""
    safe: list[dict[str, Any]] = []
    for err in errors:
        entry: dict[str, Any] = {}
        for k, v in err.items():
            if k == "ctx" and isinstance(v, dict):
                entry[k] = {
                    sk: str(sv)
                    if not isinstance(sv, (str, int, float, bool, type(None)))
                    else sv
                    for sk, sv in v.items()
                }
            else:
                entry[k] = v
        safe.append(entry)
    return safe


# ------------------------------------------------------------------
# Request handler
# ------------------------------------------------------------------


class UserHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the User & Profile API."""

    user_service = UserService()  # class-level, shared across requests
    profile_service = ProfileService()
    password_reset_service = PasswordResetService()
    password_reset_email_sender = send_password_reset_email

    # ---- CORS preflight ----

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header(
            "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ---- GET ----

    def do_GET(self) -> None:
        path = self.path.split("?")[0]

        # GET /auth/me
        # GET /auth/me
        m = _PATH_RE_AUTH_ME.match(path)
        if m:
            return self._auth_me()
        # GET /users
        m = _PATH_RE_USERS.match(path)
        if m:
            return self._list_users()

        # GET /users/{id}
        m = _PATH_RE_USER_ID.match(path)
        if m:
            return self._get_user(m.group(1))

        # GET /profiles/me
        m = _PATH_RE_PROFILES_ME.match(path)
        if m:
            return self._get_my_profile()

        error_response(self, 404, "Not found")

    # ---- POST ----

    def do_POST(self) -> None:
        path = self.path

        # POST /auth/login
        # POST /auth/login
        m = _PATH_RE_AUTH_LOGIN.match(path)
        if m:
            return self._auth_login()
        m = _PATH_RE_AUTH_FORGOT_PASSWORD.match(path)
        if m:
            return self._auth_forgot_password()
        m = _PATH_RE_AUTH_RESET_PASSWORD.match(path)
        if m:
            return self._auth_reset_password()
        m = _PATH_RE_AUTH_CHANGE_PASSWORD.match(path)
        if m:
            return self._auth_change_password()
        m = _PATH_RE_USERS.match(path)
        if m:
            return self._create_user()

        error_response(self, 404, "Not found")

    # ---- PUT ----

    def do_PUT(self) -> None:
        path = self.path

        # PUT /users/{id}
        m = _PATH_RE_USER_ID.match(path)
        if m:
            return self._update_user(m.group(1))

        # PUT /profiles/me
        m = _PATH_RE_PROFILES_ME.match(path)
        if m:
            return self._update_my_profile()

        error_response(self, 404, "Not found")

    # ---- DELETE ----

    def do_DELETE(self) -> None:
        path = self.path

        m = _PATH_RE_USER_ID.match(path)
        if m:
            return self._delete_user(m.group(1))

        error_response(self, 404, "Not found")

    # ------------------------------------------------------------------
    # Internal handlers
    # ------------------------------------------------------------------

    def _get_token_from_header(self) -> Optional[str]:
        """Extract the Bearer token from the Authorization header."""
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[len("Bearer ") :].strip()
        if not token:
            return None
        return token

    def _get_current_user_id(self) -> Optional[str]:
        """Decode the JWT from Authorization header and return the user ID.

        Uses ``get_current_user`` from ``auth.py`` which:
        1. Validates the JWT signature and expiration.
        2. Looks up the user in TinyDB.
        3. Returns the raw user document (or None on failure).
        """
        token = self._get_token_from_header()
        if token is None:
            return None
        user = get_current_user(token, self.user_service)
        if user is None:
            return None
        return user["id"]

    def _check_auth(self) -> Optional[str]:
        """Require authentication.  Returns user_id or sends 401 and returns None."""
        user_id = self._get_current_user_id()
        if user_id is None:
            error_response(
                self, 401, "Authentication required. Send a valid JWT Bearer token."
            )
        return user_id

    # ---- GET /auth/me ----

    def _auth_me(self) -> None:
        """Return the authenticated user email, role, and linked profile."""
        caller_id = self._check_auth()
        if caller_id is None:
            return

        user = self.user_service.get_user_response_by_id(caller_id)
        if user is None:
            error_response(self, 401, "Invalid authentication token")
            return

        result = user.model_dump()
        profile = self.profile_service.get_profile_by_user_id(caller_id)
        result["profile"] = profile.model_dump() if profile else None
        json_response(self, 200, result)

    # ---- POST /auth/login ----

    def _auth_login(self) -> None:
        """Accept email and password, validate credentials, return a JWT."""
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return

        email = body.get("email", "")
        password = body.get("password", "")

        if not email or not password:
            error_response(self, 422, "Both email and password are required")
            return

        user = self.user_service.authenticate(email, password)
        if user is None:
            error_response(self, 401, "Invalid email or password")
            return
        token = create_access_token(user["id"])
        json_response(
            self,
            200,
            {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "role": user["role"],
                },
            },
        )

    # ---- POST /auth/forgot-password ----

    def _auth_forgot_password(self) -> None:
        body = read_json_body(self)
        payload_email: str | None = None
        if isinstance(body, dict):
            email = body.get("email")
            if isinstance(email, str):
                payload_email = email.strip().lower()
        if payload_email:
            try:
                payload = ForgotPasswordRequest.model_validate({"email": payload_email})
            except ValidationError:
                payload = None
        else:
            payload = None

        user = (
            self.user_service.get_user_by_email(payload.email)
            if payload is not None
            else None
        )
        if payload is not None and user is not None and user["is_active"]:
            try:
                reset_token = self.password_reset_service.create_token(user["id"])
                reset_base_url = os.environ.get(
                    "PASSWORD_RESET_URL",
                    "http://localhost:3000/reset-password",
                ).rstrip("?")
                separator = "&" if "?" in reset_base_url else "?"
                reset_link = f"{reset_base_url}{separator}token={reset_token}"
                self.password_reset_email_sender(payload.email, reset_link)
            except (RuntimeError, OSError):
                # Password-reset requests must not reveal account existence or email outages.
                pass

        json_response(
            self,
            200,
            {"message": "If an account exists for this email, a reset link has been sent."},
        )

    # ---- POST /auth/reset-password ----

    def _auth_reset_password(self) -> None:
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return
        try:
            payload = ResetPasswordRequest.model_validate(body)
        except ValidationError as e:
            error_response(
                self,
                400,
                "Invalid reset request",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        def update_password(user_id: str) -> bool:
            updated = self.user_service.update_user(
                user_id,
                UserUpdate(password=payload.new_password),
            )
            return updated is not None

        user_id = self.password_reset_service.consume_token_after_action(
            payload.token,
            update_password,
        )
        if user_id is None:
            error_response(
                self,
                400,
                "Invalid, expired, or already used password reset token.",
            )
            return

        json_response(self, 200, {"message": "Password updated successfully."})

    # ---- POST /auth/change-password ----

    def _auth_change_password(self) -> None:
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
            payload = ChangePasswordRequest.model_validate(body)
        except ValidationError as e:
            error_response(
                self,
                400,
                "Invalid password change request",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        user = self.user_service.get_user_by_id(caller_id)
        if user is None:
            error_response(self, 401, "Invalid authentication token")
            return
        if not self.user_service.authenticate(user["email"], payload.current_password):
            error_response(self, 400, "Current password is incorrect.")
            return

        updated = self.user_service.update_user(
            caller_id,
            UserUpdate(password=payload.new_password),
        )
        if updated is None:
            error_response(self, 401, "Invalid authentication token")
            return

        json_response(self, 200, {"message": "Password changed successfully."})

    # ---- POST /users ----

    def _create_user(self) -> None:
        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return

        # Extract optional profile fields from the body
        profile_fields = {}
        for pf in ("name", "phone", "address"):
            if pf in body:
                profile_fields[pf] = body.pop(pf)

        # Validate user payload
        try:
            payload = UserCreate.model_validate(body)
        except ValidationError as e:
            error_response(
                self,
                422,
                "Validation error",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        # Validate optional profile payload
        try:
            profile_payload = ProfileCreate.model_validate(profile_fields)
        except ValidationError as e:
            error_response(
                self,
                422,
                "Validation error in profile fields",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        # Create user
        try:
            user_resp = self.user_service.create_user(payload)
        except ValueError as e:
            error_response(self, 409, str(e))
            return

        # Create linked profile
        profile_resp = self.profile_service.create_profile(
            user_resp.id, profile_payload
        )

        # Return combined response
        json_response(
            self,
            201,
            {
                "user": user_resp.model_dump(),
                "profile": profile_resp.model_dump(),
            },
        )

    # ---- GET /users ----

    def _list_users(self) -> None:
        auth_id = self._check_auth()
        if auth_id is None:
            return

        users = self.user_service.list_users()
        result = []
        for u in users:
            entry = u.model_dump()
            profile = self.profile_service.get_profile_by_user_id(u.id)
            entry["profile"] = profile.model_dump() if profile else None
            result.append(entry)
        json_response(self, 200, result)

    # ---- GET /users/{id} ----

    def _get_user(self, user_id: str) -> None:
        auth_id = self._check_auth()
        if auth_id is None:
            return

        user = self.user_service.get_user_response_by_id(user_id)
        if user is None:
            error_response(self, 404, f"User '{user_id}' not found")
            return

        result = user.model_dump()
        profile = self.profile_service.get_profile_by_user_id(user_id)
        result["profile"] = profile.model_dump() if profile else None
        json_response(self, 200, result)

    # ---- PUT /users/{id} ----

    def _update_user(self, user_id: str) -> None:
        auth_id = self._check_auth()
        if auth_id is None:
            return

        # Determine caller's role
        caller = self.user_service.get_user_by_id(auth_id)
        if caller is None:
            error_response(self, 401, "Invalid authentication token")
            return

        # Check that the target user exists first
        target = self.user_service.get_user_by_id(user_id)
        if target is None:
            error_response(self, 404, f"User '{user_id}' not found")
            return

        is_admin = caller["role"] == "admin"
        is_self = auth_id == user_id

        # Only the user themselves or an admin can update
        if not is_self and not is_admin:
            error_response(
                self,
                403,
                "Forbidden. Only the user or an admin can update this account.",
            )
            return

        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return

        # Non-admin users cannot change the role
        if not is_admin and "role" in body:
            error_response(self, 403, "Forbidden. Only an admin can change the role.")
            return

        try:
            payload = UserUpdate.model_validate(body)
        except ValidationError as e:
            error_response(
                self,
                422,
                "Validation error",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        try:
            updated = self.user_service.update_user(user_id, payload)
        except ValueError as e:
            error_response(self, 409, str(e))
            return

        if updated is None:
            error_response(self, 404, f"User '{user_id}' not found")
            return

        result = updated.model_dump()
        profile = self.profile_service.get_profile_by_user_id(user_id)
        result["profile"] = profile.model_dump() if profile else None
        json_response(self, 200, result)

    # ---- DELETE /users/{id} ----

    def _delete_user(self, user_id: str) -> None:
        auth_id = self._check_auth()
        if auth_id is None:
            return

        # Determine caller's role
        caller = self.user_service.get_user_by_id(auth_id)
        if caller is None:
            error_response(self, 401, "Invalid authentication token")
            return

        # Check that the target user exists first
        target = self.user_service.get_user_by_id(user_id)
        if target is None:
            error_response(self, 404, f"User '{user_id}' not found")
            return

        is_admin = caller["role"] == "admin"
        is_self = auth_id == user_id

        # Only the user themselves or an admin can delete
        if not is_self and not is_admin:
            error_response(
                self,
                403,
                "Forbidden. Only the user or an admin can delete this account.",
            )
            return

        # Delete profile first, then user
        self.profile_service.delete_profile_by_user_id(user_id)
        deleted = self.user_service.delete_user(user_id)

        if not deleted:
            error_response(self, 404, f"User '{user_id}' not found")
            return

        json_response(self, 200, {"deleted": user_id})

    # ---- GET /profiles/me ----

    def _get_my_profile(self) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return

        profile = self.profile_service.get_profile_by_user_id(caller_id)
        if profile is None:
            error_response(self, 404, "Profile not found")
            return

        json_response(self, 200, profile.model_dump())

    # ---- PUT /profiles/me ----

    def _update_my_profile(self) -> None:
        caller_id = self._check_auth()
        if caller_id is None:
            return

        # Verify the profile exists
        existing = self.profile_service.get_profile_by_user_id(caller_id)
        if existing is None:
            error_response(self, 404, "Profile not found")
            return

        body = read_json_body(self)
        if body is None:
            error_response(self, 400, "Invalid JSON body")
            return
        if not isinstance(body, dict):
            error_response(self, 422, "Request body must be a JSON object")
            return

        try:
            payload = ProfileUpdate.model_validate(body)
        except ValidationError as e:
            error_response(
                self,
                422,
                "Validation error",
                safe_validation_errors(e.errors(include_url=False)),
            )
            return

        updated = self.profile_service.update_profile(caller_id, payload)
        if updated is None:
            error_response(self, 500, "Failed to update profile")
            return

        json_response(self, 200, updated.model_dump())

    def log_message(self, fmt: str, *args: Any) -> None:
        pass  # keep console clean


# ------------------------------------------------------------------
# Server runner
# ------------------------------------------------------------------


def run_server(host: str = HOST, port: int = PORT) -> HTTPServer:
    server = HTTPServer((host, port), UserHandler)
    print(f"User API listening on http://{host}:{port}")
    return server


if __name__ == "__main__":
    server = run_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()
