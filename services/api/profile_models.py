#!/usr/bin/env python3
"""Pydantic models for the Profile module.

A Profile is a one-to-one extension of a User — display name, phone,
and address live here, never on the User model.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


# ======================================================================
# Input model  —  what the client sends when creating/updating a profile
# ======================================================================


class ProfileCreate(BaseModel):
    """Payload for creating a profile alongside a user.

    All fields are optional because the profile can be created with
    just the user link and filled in later.
    """

    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        description="Display name of the user.",
    )
    phone: Optional[str] = Field(
        None,
        max_length=30,
        description="Contact phone number.",
    )
    address: Optional[str] = Field(
        None,
        max_length=500,
        description="Physical address.",
    )


class ProfileUpdate(BaseModel):
    """Payload for PATCH /profiles/{id}."""

    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        description="Display name of the user.",
    )
    phone: Optional[str] = Field(
        None,
        max_length=30,
        description="Contact phone number.",
    )
    address: Optional[str] = Field(
        None,
        max_length=500,
        description="Physical address.",
    )

    @model_validator(mode="after")
    def at_least_one_field(self) -> ProfileUpdate:
        if all(getattr(self, field) is None for field in ("name", "phone", "address")):
            raise ValueError("At least one field must be provided for update.")
        return self


# ======================================================================
# Response model
# ======================================================================


class ProfileResponse(BaseModel):
    """Profile data returned by the API."""

    id: str
    user_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    model_config = {"from_attributes": True}


# ======================================================================
# TinyDB document helpers
# ======================================================================


def _new_id() -> str:
    import uuid

    return uuid.uuid4().hex[:8]


def build_profile_create_doc(
    user_id: str,
    payload: ProfileCreate,
) -> dict[str, Any]:
    """Build a TinyDB-ready dict from a validated ProfileCreate."""
    return {
        "id": _new_id(),
        "user_id": user_id,
        "name": payload.name,
        "phone": payload.phone,
        "address": payload.address,
    }


def build_profile_response_from_tinydb(doc: dict[str, Any]) -> ProfileResponse:
    """Convert a TinyDB document dict into a validated ProfileResponse."""
    clean = {k: v for k, v in doc.items() if k != "doc_id"}
    return ProfileResponse.model_validate(clean)
