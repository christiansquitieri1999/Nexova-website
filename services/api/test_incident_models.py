#!/usr/bin/env python3
"""Tests for the incident manager data model."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from incident_models import (
    VALID_STATUS_TRANSITIONS,
    IncidentBranch,
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentResponse,
    IncidentSeed,
    IncidentStatus,
    build_incident_create_doc,
    build_incident_response,
    build_incident_seed_doc,
)


VALID_PAYLOAD: dict[str, Any] = {
    "title": "ATS login failure",
    "description": "The support team cannot sign in to the ATS.",
    "category": "technical_failure",
    "origin": "branch",
    "branch": "valencia_operations",
}


class IncidentEnumTest(unittest.TestCase):
    def test_all_brief_categories_are_available(self) -> None:
        self.assertEqual(
            {category.value for category in IncidentCategory},
            {
                "technical_failure",
                "process_error",
                "client_complaint",
                "candidate_issue",
                "staff_issue",
                "sla_breach",
                "data_quality",
                "other",
            },
        )

    def test_all_lifecycle_statuses_are_available(self) -> None:
        self.assertEqual(
            {status.value for status in IncidentStatus},
            {"open", "in_progress", "resolved", "discarded"},
        )

    def test_all_branches_and_origins_are_available(self) -> None:
        self.assertEqual(
            {branch.value for branch in IncidentBranch},
            {"central", "valencia_operations", "miami_office", "remote"},
        )
        self.assertEqual(
            {origin.value for origin in IncidentOrigin},
            {"customer", "branch", "internal"},
        )

    def test_only_valid_status_transitions_are_declared(self) -> None:
        self.assertEqual(
            VALID_STATUS_TRANSITIONS[IncidentStatus.OPEN],
            frozenset({IncidentStatus.IN_PROGRESS, IncidentStatus.DISCARDED}),
        )
        self.assertEqual(
            VALID_STATUS_TRANSITIONS[IncidentStatus.IN_PROGRESS],
            frozenset({IncidentStatus.RESOLVED, IncidentStatus.DISCARDED}),
        )
        self.assertFalse(VALID_STATUS_TRANSITIONS[IncidentStatus.RESOLVED])
        self.assertFalse(VALID_STATUS_TRANSITIONS[IncidentStatus.DISCARDED])


class IncidentCreateTest(unittest.TestCase):
    def test_valid_payload_is_accepted(self) -> None:
        payload = IncidentCreate.model_validate(VALID_PAYLOAD)

        self.assertEqual(payload.category, IncidentCategory.TECHNICAL_FAILURE)
        self.assertEqual(payload.origin, IncidentOrigin.BRANCH)
        self.assertEqual(payload.branch, IncidentBranch.VALENCIA_OPERATIONS)

    def test_text_is_trimmed(self) -> None:
        payload = IncidentCreate.model_validate(
            {
                **VALID_PAYLOAD,
                "title": "  ATS login failure  ",
                "description": "  Users cannot sign in.  ",
            }
        )

        self.assertEqual(payload.title, "ATS login failure")
        self.assertEqual(payload.description, "Users cannot sign in.")

    def test_blank_text_is_rejected(self) -> None:
        for field in ("title", "description"):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                IncidentCreate.model_validate({**VALID_PAYLOAD, field: "   "})

    def test_title_longer_than_120_characters_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            IncidentCreate.model_validate(
                {**VALID_PAYLOAD, "title": "x" * 121}
            )

    def test_invalid_enum_value_is_rejected(self) -> None:
        for field, value in (
            ("category", "unknown"),
            ("origin", "supplier"),
            ("branch", "headquarters"),
        ):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                IncidentCreate.model_validate({**VALID_PAYLOAD, field: value})

    def test_missing_required_field_is_rejected(self) -> None:
        for field in VALID_PAYLOAD:
            payload = dict(VALID_PAYLOAD)
            del payload[field]
            with self.subTest(field=field), self.assertRaises(ValidationError):
                IncidentCreate.model_validate(payload)

    def test_extra_system_fields_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            IncidentCreate.model_validate(
                {**VALID_PAYLOAD, "status": "resolved", "id": "controlled-by-client"}
            )


class IncidentDocumentTest(unittest.TestCase):
    def test_new_incident_defaults_to_open_with_utc_timestamps(self) -> None:
        document = build_incident_create_doc(
            IncidentCreate.model_validate(VALID_PAYLOAD)
        )

        self.assertEqual(document["status"], "open")
        self.assertEqual(document["created_at"], document["updated_at"])
        self.assertTrue(document["created_at"].endswith("Z"))
        self.assertEqual(len(document["id"]), 32)

        response = build_incident_response(document)
        self.assertIsInstance(response.created_at, datetime)
        self.assertIsNotNone(response.created_at.utcoffset())

    def test_seed_preserves_historical_date_and_status(self) -> None:
        seed = IncidentSeed.model_validate(
            {
                **VALID_PAYLOAD,
                "origin": "customer",
                "branch": "central",
                "status": "resolved",
                "created_at": "2024-02-13T00:00:00Z",
            }
        )

        document = build_incident_seed_doc(seed)

        self.assertEqual(document["status"], "resolved")
        self.assertEqual(document["created_at"], "2024-02-13T00:00:00Z")
        self.assertEqual(document["updated_at"], "2024-02-13T00:00:00Z")

    def test_seed_rejects_timezone_less_date(self) -> None:
        with self.assertRaises(ValidationError):
            IncidentSeed.model_validate(
                {
                    **VALID_PAYLOAD,
                    "status": "open",
                    "created_at": "2024-02-13T00:00:00",
                }
            )

    def test_response_rejects_update_before_creation(self) -> None:
        with self.assertRaises(ValidationError):
            IncidentResponse.model_validate(
                {
                    "id": "abc123",
                    **VALID_PAYLOAD,
                    "status": "open",
                    "created_at": "2024-02-14T00:00:00Z",
                    "updated_at": "2024-02-13T00:00:00Z",
                }
            )

    def test_response_accepts_valid_final_record(self) -> None:
        timestamp = datetime(2024, 2, 13, tzinfo=timezone.utc)
        response = IncidentResponse.model_validate(
            {
                "id": "abc123",
                **VALID_PAYLOAD,
                "status": "discarded",
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

        self.assertEqual(response.status, IncidentStatus.DISCARDED)


if __name__ == "__main__":
    unittest.main()
