#!/usr/bin/env python3
"""Pydantic data models for the Nexova incident manager."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Self

from pydantic import BaseModel, Field, field_validator, model_validator


class IncidentCategory(str, Enum):
    """Valid operational incident categories at Nexova."""

    TECHNICAL_FAILURE = "technical_failure"
    PROCESS_ERROR = "process_error"
    CLIENT_COMPLAINT = "client_complaint"
    CANDIDATE_ISSUE = "candidate_issue"
    STAFF_ISSUE = "staff_issue"
    SLA_BREACH = "sla_breach"
    DATA_QUALITY = "data_quality"
    OTHER = "other"


class IncidentStatus(str, Enum):
    """Incident lifecycle states."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class IncidentOrigin(str, Enum):
    """Source through which an incident was reported."""

    CUSTOMER = "customer"
    BRANCH = "branch"
    INTERNAL = "internal"


class IncidentBranch(str, Enum):
    """Nexova locations available for incident attribution."""

    CENTRAL = "central"
    VALENCIA_OPERATIONS = "valencia_operations"
    MIAMI_OFFICE = "miami_office"
    REMOTE = "remote"


VALID_STATUS_TRANSITIONS: dict[IncidentStatus, frozenset[IncidentStatus]] = {
    IncidentStatus.OPEN: frozenset(
        {IncidentStatus.IN_PROGRESS, IncidentStatus.DISCARDED}
    ),
    IncidentStatus.IN_PROGRESS: frozenset(
        {IncidentStatus.RESOLVED, IncidentStatus.DISCARDED}
    ),
    IncidentStatus.RESOLVED: frozenset(),
    IncidentStatus.DISCARDED: frozenset(),
}


def utc_now() -> datetime:
    """Return the current UTC time without losing timezone information."""
    return datetime.now(timezone.utc)


class IncidentFields(BaseModel):
    """Fields shared by incident creation, seeding, and persistence."""

    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=10_000)
    category: IncidentCategory
    origin: IncidentOrigin
    branch: IncidentBranch

    model_config = {"extra": "forbid"}

    @field_validator("title", "description")
    @classmethod
    def trim_and_reject_blank_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Incident text fields cannot be blank.")
        return trimmed


class IncidentCreate(IncidentFields):
    """Client-controlled fields used to register a new incident."""


class IncidentSeed(IncidentFields):
    """Validated historical record accepted by the CSV seeding pipeline."""

    status: IncidentStatus
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def require_timezone_aware_date(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must include a timezone.")
        return value.astimezone(timezone.utc)


class IncidentResponse(IncidentFields):
    """Complete incident record returned by the API."""

    id: str = Field(..., min_length=1)
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def validate_timestamps(self) -> Self:
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("created_at must include a timezone.")
        if self.updated_at.tzinfo is None or self.updated_at.utcoffset() is None:
            raise ValueError("updated_at must include a timezone.")
        if self.updated_at < self.created_at:
            raise ValueError("updated_at cannot be earlier than created_at.")
        return self


def build_incident_create_doc(payload: IncidentCreate) -> dict[str, Any]:
    """Build a TinyDB-ready document with server-controlled defaults."""
    timestamp = utc_now()
    return _build_incident_doc(
        payload,
        status=IncidentStatus.OPEN,
        created_at=timestamp,
        updated_at=timestamp,
    )


def build_incident_seed_doc(payload: IncidentSeed) -> dict[str, Any]:
    """Build a TinyDB-ready historical document for CSV imports."""
    return _build_incident_doc(
        payload,
        status=payload.status,
        created_at=payload.created_at,
        updated_at=payload.created_at,
    )


def _build_incident_doc(
    payload: IncidentFields,
    *,
    status: IncidentStatus,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    return {
        "id": uuid.uuid4().hex,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category.value,
        "status": status.value,
        "origin": payload.origin.value,
        "branch": payload.branch.value,
        "created_at": created_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "updated_at": updated_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def build_incident_response(doc: dict[str, Any]) -> IncidentResponse:
    """Validate a TinyDB document and omit its internal document id."""
    clean = {key: value for key, value in doc.items() if key != "doc_id"}
    return IncidentResponse.model_validate(clean)

