#!/usr/bin/env python3
"""FastAPI application for User and Profile management."""

from __future__ import annotations

import os
import threading
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from auth import create_access_token, get_current_user
from auth_models import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserCreate,
    UserUpdate,
)
from auth_service import UserService
from password_reset import PasswordResetService, send_password_reset_email
from profile_models import ProfileCreate, ProfileUpdate
from profile_service import ProfileService

HOST = "0.0.0.0"
PORT = 8002
ALLOWED_ORIGIN = "http://localhost:3000"


def safe_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    safe: list[dict[str, Any]] = []
    for err in errors:
        entry: dict[str, Any] = {}
        for key, value in err.items():
            if key == "ctx" and isinstance(value, dict):
                entry[key] = {
                    nested_key: str(nested_value)
                    if not isinstance(
                        nested_value,
                        (str, int, float, bool, type(None)),
                    )
                    else nested_value
                    for nested_key, nested_value in value.items()
                }
            else:
                entry[key] = value
        safe.append(entry)
    return safe


def error_response(status: int, message: str, details: Any = None) -> JSONResponse:
    payload: dict[str, Any] = {"error": message}
    if details is not None:
        payload["details"] = details
    return JSONResponse(status_code=status, content=payload)


class UserHandler:
    """Compatibility container for shared services and existing test setup."""

    user_service = UserService()
    profile_service = ProfileService()
    password_reset_service = PasswordResetService()
    password_reset_email_sender = send_password_reset_email


app = FastAPI(title="Nexova Authentication API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def add_cors_headers(request: Request, call_next: Any) -> Response:
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PUT, DELETE, OPTIONS"
    )
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@app.options("/{path:path}")
async def cors_preflight(path: str) -> Response:
    del path
    return Response(status_code=204)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    del request
    errors = exc.errors()
    return error_response(
        400,
        "Invalid JSON body",
        safe_validation_errors(errors),
    )


def _token_from_request(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer ") :].strip()
    return token or None


def _check_auth(request: Request) -> tuple[str | None, JSONResponse | None]:
    token = _token_from_request(request)
    if token is None:
        return None, error_response(
            401,
            "Authentication required. Send a valid JWT Bearer token.",
        )
    user = get_current_user(token, UserHandler.user_service)
    if user is None:
        return None, error_response(
            401,
            "Authentication required. Send a valid JWT Bearer token.",
        )
    return str(user["id"]), None


@app.post("/auth/login")
async def auth_login(body: dict[str, Any] | None = None) -> JSONResponse:
    if body is None:
        return error_response(422, "Both email and password are required")
    email = body.get("email")
    password = body.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        return error_response(422, "Both email and password are required")
    if not email or not password:
        return error_response(422, "Both email and password are required")

    user = UserHandler.user_service.authenticate(email, password)
    if user is None:
        return error_response(401, "Invalid email or password")
    return JSONResponse(
        status_code=200,
        content={
            "access_token": create_access_token(user["id"]),
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "role": user["role"],
            },
        },
    )


@app.get("/auth/me")
async def auth_me(request: Request) -> JSONResponse:
    caller_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert caller_id is not None

    user = UserHandler.user_service.get_user_response_by_id(caller_id)
    if user is None:
        return error_response(401, "Invalid authentication token")
    result = user.model_dump()
    profile = UserHandler.profile_service.get_profile_by_user_id(caller_id)
    result["profile"] = profile.model_dump() if profile else None
    return JSONResponse(status_code=200, content=result)


@app.post("/auth/forgot-password")
async def forgot_password(body: dict[str, Any] | None = None) -> JSONResponse:
    payload_email: str | None = None
    if isinstance(body, dict):
        email = body.get("email")
        if isinstance(email, str):
            payload_email = email.strip().lower()

    payload: ForgotPasswordRequest | None = None
    if payload_email:
        try:
            payload = ForgotPasswordRequest.model_validate({"email": payload_email})
        except ValidationError:
            payload = None

    user = (
        UserHandler.user_service.get_user_by_email(payload.email)
        if payload is not None
        else None
    )
    if payload is not None and user is not None and user["is_active"]:
        try:
            reset_token = UserHandler.password_reset_service.create_token(user["id"])
            reset_base_url = os.environ.get(
                "PASSWORD_RESET_URL",
                "http://localhost:3000/reset-password",
            ).rstrip("?")
            separator = "&" if "?" in reset_base_url else "?"
            reset_link = f"{reset_base_url}{separator}token={reset_token}"
            UserHandler.password_reset_email_sender(payload.email, reset_link)
        except (RuntimeError, OSError):
            pass

    return JSONResponse(
        status_code=200,
        content={
            "message": "If an account exists for this email, a reset link has been sent."
        },
    )


@app.post("/auth/reset-password")
async def reset_password(body: dict[str, Any] | None = None) -> JSONResponse:
    if body is None:
        return error_response(400, "Invalid JSON body")
    try:
        payload = ResetPasswordRequest.model_validate(body)
    except ValidationError as exc:
        return error_response(
            400,
            "Invalid reset request",
            safe_validation_errors(exc.errors(include_url=False)),
        )

    def update_password(user_id: str) -> bool:
        updated = UserHandler.user_service.update_user(
            user_id,
            UserUpdate(password=payload.new_password),
        )
        return updated is not None

    user_id = UserHandler.password_reset_service.consume_token_after_action(
        payload.token,
        update_password,
    )
    if user_id is None:
        return error_response(
            400,
            "Invalid, expired, or already used password reset token.",
        )
    return JSONResponse(
        status_code=200,
        content={"message": "Password updated successfully."},
    )


@app.post("/auth/change-password")
async def change_password(
    request: Request,
    body: dict[str, Any] | None = None,
) -> JSONResponse:
    caller_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert caller_id is not None
    if body is None:
        return error_response(400, "Invalid JSON body")

    try:
        payload = ChangePasswordRequest.model_validate(body)
    except ValidationError as exc:
        return error_response(
            400,
            "Invalid password change request",
            safe_validation_errors(exc.errors(include_url=False)),
        )

    user = UserHandler.user_service.get_user_by_id(caller_id)
    if user is None:
        return error_response(401, "Invalid authentication token")
    if not UserHandler.user_service.authenticate(
        user["email"],
        payload.current_password,
    ):
        return error_response(400, "Current password is incorrect.")

    updated = UserHandler.user_service.update_user(
        caller_id,
        UserUpdate(password=payload.new_password),
    )
    if updated is None:
        return error_response(401, "Invalid authentication token")
    return JSONResponse(
        status_code=200,
        content={"message": "Password changed successfully."},
    )


@app.post("/users")
async def create_user(body: dict[str, Any] | None = None) -> JSONResponse:
    if body is None:
        return error_response(400, "Invalid JSON body")

    profile_fields = {
        key: body.pop(key)
        for key in ("name", "phone", "address")
        if key in body
    }
    try:
        payload = UserCreate.model_validate(body)
    except ValidationError as exc:
        return error_response(
            422,
            "Validation error",
            safe_validation_errors(exc.errors(include_url=False)),
        )
    try:
        profile_payload = ProfileCreate.model_validate(profile_fields)
    except ValidationError as exc:
        return error_response(
            422,
            "Validation error in profile fields",
            safe_validation_errors(exc.errors(include_url=False)),
        )

    try:
        user_response = UserHandler.user_service.create_user(payload)
    except ValueError as exc:
        return error_response(409, str(exc))

    profile_response = UserHandler.profile_service.create_profile(
        user_response.id,
        profile_payload,
    )
    return JSONResponse(
        status_code=201,
        content={
            "user": user_response.model_dump(),
            "profile": profile_response.model_dump(),
        },
    )


@app.get("/users")
async def list_users(request: Request) -> JSONResponse:
    caller_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert caller_id is not None

    result = []
    for user in UserHandler.user_service.list_users():
        entry = user.model_dump()
        profile = UserHandler.profile_service.get_profile_by_user_id(user.id)
        entry["profile"] = profile.model_dump() if profile else None
        result.append(entry)
    return JSONResponse(status_code=200, content=result)


@app.get("/users/{user_id}")
async def get_user(user_id: str, request: Request) -> JSONResponse:
    _, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    user = UserHandler.user_service.get_user_response_by_id(user_id)
    if user is None:
        return error_response(404, f"User '{user_id}' not found")
    result = user.model_dump()
    profile = UserHandler.profile_service.get_profile_by_user_id(user_id)
    result["profile"] = profile.model_dump() if profile else None
    return JSONResponse(status_code=200, content=result)


@app.put("/users/{user_id}")
async def update_user(
    user_id: str,
    request: Request,
    body: dict[str, Any] | None = None,
) -> JSONResponse:
    auth_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert auth_id is not None

    caller = UserHandler.user_service.get_user_by_id(auth_id)
    if caller is None:
        return error_response(401, "Invalid authentication token")
    target = UserHandler.user_service.get_user_by_id(user_id)
    if target is None:
        return error_response(404, f"User '{user_id}' not found")

    is_admin = caller["role"] == "admin"
    is_self = auth_id == user_id
    if not is_self and not is_admin:
        return error_response(
            403,
            "Forbidden. Only the user or an admin can update this account.",
        )
    if body is None:
        return error_response(400, "Invalid JSON body")
    if not is_admin and "role" in body:
        return error_response(403, "Forbidden. Only an admin can change the role.")

    try:
        payload = UserUpdate.model_validate(body)
    except ValidationError as exc:
        return error_response(
            422,
            "Validation error",
            safe_validation_errors(exc.errors(include_url=False)),
        )
    try:
        updated = UserHandler.user_service.update_user(user_id, payload)
    except ValueError as exc:
        return error_response(409, str(exc))
    if updated is None:
        return error_response(404, f"User '{user_id}' not found")

    result = updated.model_dump()
    profile = UserHandler.profile_service.get_profile_by_user_id(user_id)
    result["profile"] = profile.model_dump() if profile else None
    return JSONResponse(status_code=200, content=result)


@app.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request) -> JSONResponse:
    auth_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert auth_id is not None

    caller = UserHandler.user_service.get_user_by_id(auth_id)
    if caller is None:
        return error_response(401, "Invalid authentication token")
    target = UserHandler.user_service.get_user_by_id(user_id)
    if target is None:
        return error_response(404, f"User '{user_id}' not found")

    is_admin = caller["role"] == "admin"
    is_self = auth_id == user_id
    if not is_self and not is_admin:
        return error_response(
            403,
            "Forbidden. Only the user or an admin can delete this account.",
        )
    UserHandler.profile_service.delete_profile_by_user_id(user_id)
    deleted = UserHandler.user_service.delete_user(user_id)
    if not deleted:
        return error_response(404, f"User '{user_id}' not found")
    return JSONResponse(status_code=200, content={"deleted": user_id})


@app.get("/profiles/me")
async def get_my_profile(request: Request) -> JSONResponse:
    caller_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert caller_id is not None
    profile = UserHandler.profile_service.get_profile_by_user_id(caller_id)
    if profile is None:
        return error_response(404, "Profile not found")
    return JSONResponse(status_code=200, content=profile.model_dump())


@app.put("/profiles/me")
async def update_my_profile(
    request: Request,
    body: dict[str, Any] | None = None,
) -> JSONResponse:
    caller_id, auth_error = _check_auth(request)
    if auth_error is not None:
        return auth_error
    assert caller_id is not None
    if UserHandler.profile_service.get_profile_by_user_id(caller_id) is None:
        return error_response(404, "Profile not found")
    if body is None:
        return error_response(400, "Invalid JSON body")

    try:
        payload = ProfileUpdate.model_validate(body)
    except ValidationError as exc:
        return error_response(
            422,
            "Validation error",
            safe_validation_errors(exc.errors(include_url=False)),
        )
    updated = UserHandler.profile_service.update_profile(caller_id, payload)
    if updated is None:
        return error_response(500, "Failed to update profile")
    return JSONResponse(status_code=200, content=updated.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    del request, exc
    return error_response(
        500,
        "An unexpected error occurred. Please try again later.",
    )


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def unknown_route(path: str) -> JSONResponse:
    del path
    return error_response(404, "Not found")


class _UvicornServer:
    def __init__(self, host: str, port: int) -> None:
        config = uvicorn.Config(app, host=host, port=port, log_level="warning")
        self._server = uvicorn.Server(config)
        self._thread: threading.Thread | None = None

    def serve_forever(self) -> None:
        self._server.run()

    def shutdown(self) -> None:
        self._server.should_exit = True

    def server_close(self) -> None:
        if self._thread is not None:
            self._thread.join(timeout=5)


def run_server(host: str = HOST, port: int = PORT) -> _UvicornServer:
    return _UvicornServer(host, port)


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
