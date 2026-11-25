#!/usr/bin/env python3
"""Pydantic models for the User authentication module.

User credentials live here; display name and contact data belong on
Profile (separate module, one-to-one link to User).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ======================================================================
# Enums
# ======================================================================


class UserRole(str, Enum):
    """Allowed user roles for the platform."""

    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


VALID_ROLES: list[str] = [r.value for r in UserRole]


# ======================================================================
# Helpers
# ======================================================================


def _utcnow_iso() -> str:
    """ISO-8601 UTC timestamp without microseconds."""
    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


def _new_id() -> str:
    """Short hex ID (8 chars) — sufficient for ~16M records."""
    return uuid.uuid4().hex[:8]


# ======================================================================
# Input model  —  what the client sends when creating a user
# ======================================================================


class UserCreate(BaseModel):
    """Payload for POST /users.

    The password is provided in plain text; the service layer hashes it
    before storing.  The role defaults to ``user`` for new registrations.
    """

    email: str = Field(
        ...,
        min_length=1,
        max_length=254,
        description="User email address — unique identifier for login.",
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Plain-text password — will be hashed before storage.",
    )
    role: UserRole = Field(
        UserRole.USER,
        description="User role (defaults to 'user').",
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        stripped = v.strip().lower()
        if not stripped:
            raise ValueError("Email must not be blank.")
        if "@" not in stripped:
            raise ValueError("Email must contain '@'.")
        # Simple domain-part check
        local, at, domain = stripped.partition("@")
        if not local or not domain or "." not in domain:
            raise ValueError("Email must have a valid domain.")
        return stripped

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: UserRole) -> UserRole:
        if v.value not in VALID_ROLES:
            raise ValueError(f"Invalid role '{v.value}'. Must be one of {VALID_ROLES}")
        return v


# ======================================================================
# Update model  —  what the client sends to update a user
# ======================================================================


class UserUpdate(BaseModel):
    """Payload for PATCH /users/{id}.

    All fields are optional; only provided fields are updated.
    """

    email: Optional[str] = Field(
        None,
        min_length=1,
        max_length=254,
        description="New email address.",
    )
    password: Optional[str] = Field(
        None,
        min_length=6,
        max_length=128,
        description="New plain-text password — will be hashed before storage.",
    )
    is_active: Optional[bool] = Field(
        None,
        description="Set false to deactivate the user account.",
    )
    role: Optional[UserRole] = Field(
        None,
        description="New role for the user.",
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        stripped = v.strip().lower()
        if not stripped:
            raise ValueError("Email must not be blank.")
        if "@" not in stripped:
            raise ValueError("Email must contain '@'.")
        local, _, domain = stripped.partition("@")
        if not local or not domain or "." not in domain:
            raise ValueError("Email must have a valid domain.")
        return stripped

    @model_validator(mode="after")
    def at_least_one_field(self) -> UserUpdate:
        if all(
            getattr(self, field) is None
            for field in ("email", "password", "is_active", "role")
        ):
            raise ValueError("At least one field must be provided for update.")
        return self


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /auth/forgot-password."""

    email: str = Field(..., min_length=1, max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        stripped = v.strip().lower()
        if not stripped or "@" not in stripped:
            raise ValueError("Email must be valid.")
        return stripped


class ResetPasswordRequest(BaseModel):
    """Payload for POST /auth/reset-password."""

    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    """Payload for POST /auth/change-password."""

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


# ======================================================================
# Response model  —  what the API returns (never the password)
# ======================================================================


class UserResponse(BaseModel):
    """Full user record returned by the API — never includes the password."""

    id: str
    email: str
    is_active: bool
    role: UserRole
    created_at: str

    model_config = {"from_attributes": True}


# ======================================================================
# TinyDB document helpers
# ======================================================================


def build_user_create_doc(payload: UserCreate, hashed_password: str) -> dict[str, Any]:
    """Build a TinyDB-ready dict from a validated UserCreate.

    ``hashed_password`` must already be hashed by the service layer.
    """
    now = _utcnow_iso()
    return {
        "id": _new_id(),
        "email": payload.email,
        "hashed_password": hashed_password,
        "is_active": True,
        "role": payload.role.value,
        "created_at": now,
    }


def build_user_response_from_tinydb(doc: dict[str, Any]) -> UserResponse:
    """Convert a TinyDB document dict into a validated UserResponse.

    Strips the TinyDB internal key and the hashed_password field so
    the password is never leaked in API responses.
    """
    clean = {
        "id": doc["id"],
        "email": doc["email"],
        "is_active": doc["is_active"],
        "role": doc["role"],
        "created_at": doc["created_at"],
    }
    return UserResponse.model_validate(clean)


def build_user_create_from_tinydb(doc: dict[str, Any]) -> dict[str, Any]:
    """Return the full TinyDB doc dict (incl. hashed_password) for internal use."""
    return {
        "id": doc["id"],
        "email": doc["email"],
        "hashed_password": doc["hashed_password"],
        "is_active": doc["is_active"],
        "role": doc["role"],
        "created_at": doc["created_at"],
    }
