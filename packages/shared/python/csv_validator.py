#!/usr/bin/env python3
"""Shared CSV validation and transformation logic for Nexova pipelines.

Extracted from the incident-file-analyzer so that seed scripts can reuse
the same rules without duplicating them.
"""

from __future__ import annotations

from typing import Any

# ── CSV schema ──────────────────────────────────────────────────────────────

EXPECTED_CSV_FIELDS = (
    "ticket_id",
    "date",
    "client_company",
    "category",
    "description",
    "agent_id",
    "status",
    "customer_email",
    "satisfaction_score",
)

VALID_CSV_CATEGORIES = ("TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT")
VALID_CSV_STATUSES = ("OPEN", "CLOSED", "DISCARDED")

# ── CSV-to-model transformation maps ────────────────────────────────────────
# See the BRIEFING mapping tables for the rationale.

CATEGORY_MAP: dict[str, str] = {
    "TECHNICAL": "technical_failure",
    "BILLING": "process_error",
    "ACCESS": "technical_failure",
    "HR_QUERY": "process_error",
    "COMPLAINT": "client_complaint",
}

STATUS_MAP: dict[str, str] = {
    "OPEN": "open",
    "CLOSED": "resolved",
    "DISCARDED": "discarded",
}

# ── Validation ──────────────────────────────────────────────────────────────


def validate_csv_row(row: dict[str, str]) -> list[str]:
    """Apply the same business rules as the analyzer to a raw CSV row.

    Returns a list of rule keys that the row violates. An empty list means
    the row is valid and can be transformed.
    """
    rules: list[str] = []

    company = row.get("client_company", "").strip()
    category = row.get("category", "").strip().upper()
    description = row.get("description", "").strip()
    agent_id = row.get("agent_id", "").strip()
    status = row.get("status", "").strip().upper()
    email = row.get("customer_email", "").strip()
    score_text = row.get("satisfaction_score", "").strip()

    if not company:
        rules.append("missing_client_company")
    if category not in VALID_CSV_CATEGORIES:
        rules.append("invalid_category")
    if len(description) < 5:
        rules.append("invalid_description")
    if len(agent_id) != 6 or not agent_id.startswith("AGT-") or not agent_id[4:].isdigit():
        rules.append("invalid_agent_id")
    if not email or "@" not in email:
        rules.append("invalid_email")
    if status == "CLOSED" and not score_text:
        rules.append("closed_without_score")
    if score_text:
        try:
            score = int(score_text)
            if score < 1 or score > 5:
                rules.append("score_out_of_range")
        except (TypeError, ValueError):
            rules.append("score_out_of_range")

    return rules


def is_valid_csv_row(row: dict[str, str]) -> bool:
    """Return True when the row passes all CSV-level validation rules."""
    return len(validate_csv_row(row)) == 0


CSV_INVALID_LABELS: dict[str, str] = {
    "missing_client_company": "Missing client_company",
    "invalid_category": "Invalid or missing category",
    "invalid_description": "Invalid or missing description",
    "invalid_agent_id": "Invalid or missing agent_id",
    "invalid_email": "Invalid or missing email",
    "closed_without_score": "Closed ticket, no score",
    "score_out_of_range": "Satisfaction score out of range",
}