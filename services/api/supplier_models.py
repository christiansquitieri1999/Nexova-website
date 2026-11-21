#!/usr/bin/env python3
"""Pydantic models for the Nexova Supplier Directory.

Separate input / response / patch models ensure the API surface is precise:
- Input never includes system-generated fields (id, updated_at).
- Response always includes them.
- Patch only accepts the mutable fields (monthly_rate, status).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)


# ======================================================================
# Enums
# ======================================================================


class SupplierStatus(str, Enum):
    """Allowed supplier statuses."""

    ACTIVE = "active"
    SUSPENDED = "suspended"


class SupplierCategory(str, Enum):
    """Valid service categories from the Nexova briefing."""

    JOB_BOARDS = "job_boards"
    ATS_SOFTWARE = "ats_software"
    ASSESSMENT_TOOLS = "assessment_tools"
    TRAINING_PLATFORMS = "training_platforms"
    PAYROLL_AND_HR_SOFTWARE = "payroll_and_hr_software"
    VIDEO_INTERVIEW = "video_interview"
    BACKGROUND_CHECK = "background_check"
    OFFICE_AND_FACILITIES = "office_and_facilities"
    IT_AND_SOFTWARE_LICENSES = "it_and_software_licenses"


class SupplierCountry(str, Enum):
    """Valid countries for supplier contracts."""

    SPAIN = "Spain"
    USA = "USA"


# ======================================================================
# Helpers
# ======================================================================

COUNTRY_CURRENCY: dict[SupplierCountry, str] = {
    SupplierCountry.SPAIN: "EUR",
    SupplierCountry.USA: "USD",
}

VALID_STATUSES: list[str] = ["active", "suspended"]

def safe_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sanitize Pydantic error list for JSON serialization.

    Pydantic's ``ctx`` may contain non-serializable objects such as
    ``ValueError`` instances.  This helper converts them to their string
    representation so that ``json.dumps`` never crashes.
    """
    safe: list[dict[str, Any]] = []
    for err in errors:
        entry: dict[str, Any] = {}
        for k, v in err.items():
            if k == "ctx" and isinstance(v, dict):
                entry[k] = {sk: str(sv) if not isinstance(sv, (str, int, float, bool, type(None))) else sv
                            for sk, sv in v.items()}
            else:
                entry[k] = v
        safe.append(entry)
    return safe

VALID_CATEGORIES: list[str] = [
    "job_boards",
    "ats_software",
    "assessment_tools",
    "training_platforms",
    "payroll_and_hr_software",
    "video_interview",
    "background_check",
    "office_and_facilities",
    "it_and_software_licenses",
]

CATEGORY_LABELS: dict[SupplierCategory, str] = {
    SupplierCategory.JOB_BOARDS: "Job boards",
    SupplierCategory.ATS_SOFTWARE: "ATS software",
    SupplierCategory.ASSESSMENT_TOOLS: "Assessment tools",
    SupplierCategory.TRAINING_PLATFORMS: "Training platforms",
    SupplierCategory.PAYROLL_AND_HR_SOFTWARE: "Payroll & HR software",
    SupplierCategory.VIDEO_INTERVIEW: "Video interview",
    SupplierCategory.BACKGROUND_CHECK: "Background check",
    SupplierCategory.OFFICE_AND_FACILITIES: "Office & facilities",
    SupplierCategory.IT_AND_SOFTWARE_LICENSES: "IT & software licenses",
}


def _utcnow_iso() -> str:
    """ISO-8601 UTC timestamp without microseconds."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _new_id() -> str:
    """Short hex ID (8 chars) — sufficient for ~16M records."""
    return uuid.uuid4().hex[:8]


# ======================================================================
# Input model  —  what the client sends when creating a supplier
# ======================================================================


class SupplierCreate(BaseModel):
    """Payload for POST /api/suppliers.

    All business-rule validations run here so TinyDB only ever sees
    clean, consistent data.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Supplier or platform trade name.",
    )
    country: SupplierCountry = Field(..., description="Contract country.")
    categories: list[SupplierCategory] = Field(
        ...,
        min_length=1,
        description="Types of service provided (minimum 1).",
    )
    monthly_rate: float = Field(
        ...,
        gt=0,
        description="Current monthly cost. Must be positive.",
    )
    currency: str = Field(
        ...,
        pattern=r"^(EUR|USD)$",
        description="EUR for Spain, USD for USA.",
    )
    status: SupplierStatus = Field(
        ...,
        description="active or suspended.",
    )
    contract_renewal_date: Optional[str] = Field(
        None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Renewal date in YYYY-MM-DD format.",
    )
    contact_email: Optional[str] = Field(
        None,
        description="Supplier account manager email.",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Internal notes.",
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Supplier name cannot be blank.")
        return stripped

    @field_validator("contact_email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and "@" not in v:
            raise ValueError("Contact email must contain '@'.")
        return v

    @model_validator(mode="after")
    def country_currency_must_match(self) -> "SupplierCreate":
        """Enforce business rule: Spain → EUR, USA → USD."""
        expected = COUNTRY_CURRENCY.get(self.country)
        if expected is not None and self.currency != expected:
            raise ValueError(
                f"A supplier from '{self.country.value}' must use "
                f"'{expected}', not '{self.currency}'."
            )
        return self


# ======================================================================
# Patch model  —  what the client sends to update rate / status
# ======================================================================


class SupplierPatch(BaseModel):
    """Payload for PATCH /api/suppliers/:id.

    Only monthly_rate and status are mutable after creation.
    """

    monthly_rate: Optional[float] = Field(None, gt=0, description="Updated monthly cost.")
    status: Optional[SupplierStatus] = Field(None, description="New status.")

    @model_validator(mode="after")
    def at_least_one_field(self) -> "SupplierPatch":
        if self.monthly_rate is None and self.status is None:
            raise ValueError("At least one of 'monthly_rate' or 'status' must be provided.")
        return self


# ======================================================================
# Response model  —  what the API returns
# ======================================================================


class SupplierResponse(BaseModel):
    """Full supplier record returned by the API."""

    id: str
    name: str
    country: SupplierCountry
    categories: list[SupplierCategory]
    monthly_rate: float
    currency: str
    status: SupplierStatus
    updated_at: str
    contract_renewal_date: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ======================================================================
# Seeder data (as dicts, validated on load)
# ======================================================================

SUPPLIERS_SEED: list[dict[str, Any]] = [
    {
        "name": "LinkedIn Talent Solutions",
        "country": "Spain",
        "categories": ["job_boards"],
        "monthly_rate": 1200.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-03-31",
        "contact_email": "account@linkedin.com",
        "notes": "Corporate license for job posting and candidate search.",
    },
    {
        "name": "InfoJobs Premium",
        "country": "Spain",
        "categories": ["job_boards"],
        "monthly_rate": 490.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-06-30",
        "contact_email": "empresas@infojobs.net",
    },
    {
        "name": "Indeed Sponsored",
        "country": "USA",
        "categories": ["job_boards"],
        "monthly_rate": 850.0,
        "currency": "USD",
        "status": "active",
        "contact_email": "sales@indeed.com",
        "notes": "Pay-per-click campaigns for customer support profiles in Miami.",
    },
    {
        "name": "Workable",
        "country": "Spain",
        "categories": ["ats_software"],
        "monthly_rate": 299.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-09-15",
        "contact_email": "support@workable.com",
        "notes": "Primary ATS for the Valencia selection team.",
    },
    {
        "name": "Greenhouse",
        "country": "USA",
        "categories": ["ats_software"],
        "monthly_rate": 620.0,
        "currency": "USD",
        "status": "suspended",
        "contact_email": "accounts@greenhouse.io",
        "notes": "Suspended after non-renewal. Sergio is evaluating migrating everything to Workable.",
    },
    {
        "name": "Thomas International",
        "country": "Spain",
        "categories": ["assessment_tools"],
        "monthly_rate": 380.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-12-01",
        "contact_email": "clientes@thomas.es",
        "notes": "Personality and aptitude tests for middle-management hiring processes.",
    },
    {
        "name": "HireVue",
        "country": "USA",
        "categories": ["video_interview"],
        "monthly_rate": 540.0,
        "currency": "USD",
        "status": "active",
        "contract_renewal_date": "2025-08-31",
        "contact_email": "support@hirevue.com",
    },
    {
        "name": "Udemy Business",
        "country": "Spain",
        "categories": ["training_platforms"],
        "monthly_rate": 420.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2026-01-15",
        "contact_email": "business@udemy.com",
        "notes": "Licenses for the internal team. Managed by Elena Vargas.",
    },
    {
        "name": "Coursera for Teams",
        "country": "USA",
        "categories": ["training_platforms"],
        "monthly_rate": 399.0,
        "currency": "USD",
        "status": "suspended",
        "contact_email": "teams@coursera.com",
        "notes": "Suspended due to low usage. Review before Q4.",
    },
    {
        "name": "Sage HR",
        "country": "Spain",
        "categories": ["payroll_and_hr_software"],
        "monthly_rate": 310.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-10-01",
        "contact_email": "soporte@sage.com",
        "notes": "Payroll and personnel management software for the Valencia headquarters.",
    },
    {
        "name": "Gusto",
        "country": "USA",
        "categories": ["payroll_and_hr_software"],
        "monthly_rate": 280.0,
        "currency": "USD",
        "status": "active",
        "contact_email": "support@gusto.com",
        "notes": "Payroll management for Miami office employees.",
    },
    {
        "name": "Checkr",
        "country": "USA",
        "categories": ["background_check"],
        "monthly_rate": 195.0,
        "currency": "USD",
        "status": "active",
        "contract_renewal_date": "2025-11-30",
        "contact_email": "sales@checkr.com",
    },
    {
        "name": "Microsoft 365 Business",
        "country": "Spain",
        "categories": ["it_and_software_licenses"],
        "monthly_rate": 760.0,
        "currency": "EUR",
        "status": "active",
        "contact_email": "enterprise@microsoft.com",
        "notes": "Licenses for the entire Valencia and Miami workforce.",
    },
    {
        "name": "Regus Valencia",
        "country": "Spain",
        "categories": ["office_and_facilities"],
        "monthly_rate": 2400.0,
        "currency": "EUR",
        "status": "active",
        "contract_renewal_date": "2025-07-01",
        "contact_email": "valencia@regus.com",
        "notes": "Lease for the main Valencia office. Includes meeting room.",
    },
    {
        "name": "WeWork Miami",
        "country": "USA",
        "categories": ["office_and_facilities"],
        "monthly_rate": 3100.0,
        "currency": "USD",
        "status": "active",
        "contract_renewal_date": "2025-09-30",
        "contact_email": "miami@wework.com",
    },
]


def build_response_from_tinydb(doc: dict[str, Any]) -> SupplierResponse:
    """Convert a TinyDB document dict into a validated SupplierResponse.

    TinyDB stores documents as plain dicts (with an extra 'doc_id' key).
    This helper strips the TinyDB internal key and validates the shape.
    """
    clean = {k: v for k, v in doc.items() if k != "doc_id"}
    return SupplierResponse.model_validate(clean)


def build_create_doc(payload: SupplierCreate) -> dict[str, Any]:
    """Build a TinyDB-ready dict from a validated SupplierCreate."""
    return {
        "id": _new_id(),
        "name": payload.name,
        "country": payload.country.value,
        "categories": [c.value for c in payload.categories],
        "monthly_rate": payload.monthly_rate,
        "currency": payload.currency,
        "status": payload.status.value,
        "updated_at": _utcnow_iso(),
        "contract_renewal_date": payload.contract_renewal_date,
        "contact_email": payload.contact_email,
        "notes": payload.notes,
    }