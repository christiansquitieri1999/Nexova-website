#!/usr/bin/env python3
"""Tests for Pydantic supplier models — validation, enums, input/response separation."""

from __future__ import annotations

import unittest
from typing import Any

import pydantic
from pydantic import ValidationError

from supplier_models import (
    CATEGORY_LABELS,
    COUNTRY_CURRENCY,
    SUPPLIERS_SEED,
    SupplierCategory,
    SupplierCountry,
    SupplierCreate,
    SupplierPatch,
    SupplierResponse,
    SupplierStatus,
    build_create_doc,
    build_response_from_tinydb,
)


# ======================================================================
# Enum sanity
# ======================================================================

class EnumTest(unittest.TestCase):
    def test_supplier_status_accepts_active_and_suspended(self) -> None:
        self.assertEqual(SupplierStatus("active"), SupplierStatus.ACTIVE)
        self.assertEqual(SupplierStatus("suspended"), SupplierStatus.SUSPENDED)

    def test_supplier_status_rejects_other_values(self) -> None:
        with self.assertRaises(ValueError):
            SupplierStatus("archived")
        with self.assertRaises(ValueError):
            SupplierStatus("pending")
        with self.assertRaises(ValueError):
            SupplierStatus("deleted")

    def test_valid_categories_count(self) -> None:
        self.assertEqual(len(SupplierCategory), 9)

    def test_all_categories_have_labels(self) -> None:
        for cat in SupplierCategory:
            self.assertIn(cat, CATEGORY_LABELS)

    def test_country_currency_mapping(self) -> None:
        self.assertEqual(COUNTRY_CURRENCY[SupplierCountry.SPAIN], "EUR")
        self.assertEqual(COUNTRY_CURRENCY[SupplierCountry.USA], "USD")

    def test_supplier_country_accepts_spain_and_usa(self) -> None:
        self.assertEqual(SupplierCountry("Spain"), SupplierCountry.SPAIN)
        self.assertEqual(SupplierCountry("USA"), SupplierCountry.USA)

    def test_supplier_country_rejects_other(self) -> None:
        with self.assertRaises(ValueError):
            SupplierCountry("France")


# ======================================================================
# SupplierCreate validation
# ======================================================================

_VALID_PAYLOAD: dict[str, Any] = {
    "name": "Test Supplier",
    "country": "Spain",
    "categories": ["job_boards"],
    "monthly_rate": 500.0,
    "currency": "EUR",
    "status": "active",
}


class SupplierCreateTest(unittest.TestCase):
    def test_valid_payload_passes(self) -> None:
        supplier = SupplierCreate.model_validate(_VALID_PAYLOAD)
        self.assertEqual(supplier.name, "Test Supplier")
        self.assertEqual(supplier.country, SupplierCountry.SPAIN)
        self.assertEqual(supplier.categories, [SupplierCategory.JOB_BOARDS])
        self.assertAlmostEqual(supplier.monthly_rate, 500.0)
        self.assertEqual(supplier.currency, "EUR")
        self.assertEqual(supplier.status, SupplierStatus.ACTIVE)

    def test_blank_name_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "name": ""})

    def test_whitespace_only_name_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "name": "   "})

    def test_name_exceeds_max_length_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "name": "X" * 201}
            )

    def test_name_is_stripped(self) -> None:
        supplier = SupplierCreate.model_validate(
            {**_VALID_PAYLOAD, "name": "  My Supplier  "}
        )
        self.assertEqual(supplier.name, "My Supplier")

    def test_invalid_country_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "country": "France"})

    def test_empty_categories_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "categories": []}
            )

    def test_invalid_category_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "categories": ["nonexistent"]}
            )

    # ---- monthly_rate ----

    def test_zero_rate_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "monthly_rate": 0})

    def test_negative_rate_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "monthly_rate": -100})

    def test_rate_as_integer_is_coerced(self) -> None:
        supplier = SupplierCreate.model_validate(
            {**_VALID_PAYLOAD, "monthly_rate": 300}
        )
        self.assertAlmostEqual(supplier.monthly_rate, 300.0)

    # ---- currency ----

    def test_invalid_currency_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "currency": "GBP"})

    def test_spain_with_usd_rejected(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "country": "Spain", "currency": "USD"}
            )
            errors = ctx.exception.errors()
            if not any("must use" in str(e.get("msg", "")) for e in errors):
                raise AssertionError(
                    f"No country-currency mismatch error in {errors}"
                )

    def test_usa_with_eur_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "country": "USA", "currency": "EUR"}
            )

    # ---- status ----

    def test_invalid_status_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({**_VALID_PAYLOAD, "status": "archived"})

    # ---- optional fields ----

    def test_valid_renewal_date(self) -> None:
        supplier = SupplierCreate.model_validate(
            {**_VALID_PAYLOAD, "contract_renewal_date": "2026-06-15"}
        )
        self.assertEqual(supplier.contract_renewal_date, "2026-06-15")

    def test_invalid_renewal_date_format_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "contract_renewal_date": "15-06-2026"}
            )

    def test_invalid_email_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate(
                {**_VALID_PAYLOAD, "contact_email": "not-an-email"}
            )

    def test_valid_email(self) -> None:
        supplier = SupplierCreate.model_validate(
            {**_VALID_PAYLOAD, "contact_email": "user@example.com"}
        )
        self.assertEqual(supplier.contact_email, "user@example.com")

    def test_null_optional_fields(self) -> None:
        supplier = SupplierCreate.model_validate(_VALID_PAYLOAD)
        self.assertIsNone(supplier.contract_renewal_date)
        self.assertIsNone(supplier.contact_email)
        self.assertIsNone(supplier.notes)

    def test_missing_required_field_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierCreate.model_validate({})


# ======================================================================
# SupplierPatch validation
# ======================================================================

class SupplierPatchTest(unittest.TestCase):
    def test_valid_rate_patch(self) -> None:
        patch = SupplierPatch.model_validate({"monthly_rate": 999.0})
        self.assertAlmostEqual(patch.monthly_rate, 999.0)
        self.assertIsNone(patch.status)

    def test_valid_status_patch(self) -> None:
        patch = SupplierPatch.model_validate({"status": "suspended"})
        self.assertEqual(patch.status, SupplierStatus.SUSPENDED)
        self.assertIsNone(patch.monthly_rate)

    def test_both_fields(self) -> None:
        patch = SupplierPatch.model_validate(
            {"monthly_rate": 100.0, "status": "active"}
        )
        self.assertAlmostEqual(patch.monthly_rate, 100.0)
        self.assertEqual(patch.status, SupplierStatus.ACTIVE)

    def test_empty_patch_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierPatch.model_validate({})

    def test_zero_rate_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierPatch.model_validate({"monthly_rate": 0})

    def test_negative_rate_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierPatch.model_validate({"monthly_rate": -1})

    def test_invalid_status_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierPatch.model_validate({"status": "archived"})

    def test_extra_fields_ignored(self) -> None:
        patch = SupplierPatch.model_validate(
            {"monthly_rate": 100, "name": "Hacked"}
        )
        # name should not be accepted — the model has no 'name' field
        self.assertFalse(hasattr(patch, "name"))


# ======================================================================
# SupplierResponse
# ======================================================================

class SupplierResponseTest(unittest.TestCase):
    def test_valid_response_doc(self) -> None:
        doc = {
            "id": "abc12345",
            "name": "Acme Corp",
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 499.0,
            "currency": "EUR",
            "status": "active",
            "updated_at": "2026-11-21T12:00:00Z",
            "contract_renewal_date": "2026-12-01",
            "contact_email": "bob@acme.com",
            "notes": "Some notes",
        }
        resp = SupplierResponse.model_validate(doc)
        self.assertEqual(resp.id, "abc12345")
        self.assertEqual(resp.name, "Acme Corp")
        self.assertEqual(resp.currency, "EUR")

    def test_response_requires_id_and_updated_at(self) -> None:
        with self.assertRaises(ValidationError):
            SupplierResponse.model_validate({
                "name": "No ID",
                "country": "USA",
                "categories": ["assessment_tools"],
                "monthly_rate": 100.0,
                "currency": "USD",
                "status": "active",
                # missing id, updated_at
            })


# ======================================================================
# build_create_doc
# ======================================================================

class BuildCreateDocTest(unittest.TestCase):
    def test_doc_has_id_and_updated_at(self) -> None:
        payload = SupplierCreate.model_validate({
            "name": "NewCo",
            "country": "USA",
            "categories": ["background_check"],
            "monthly_rate": 150.0,
            "currency": "USD",
            "status": "active",
        })
        doc = build_create_doc(payload)
        self.assertIn("id", doc)
        self.assertIn("updated_at", doc)
        self.assertEqual(doc["name"], "NewCo")
        self.assertEqual(doc["country"], "USA")
        self.assertEqual(doc["currency"], "USD")

    def test_enum_values_serialized_to_strings(self) -> None:
        payload = SupplierCreate.model_validate({
            "name": "EnumCo",
            "country": "Spain",
            "categories": ["ats_software", "video_interview"],
            "monthly_rate": 200.0,
            "currency": "EUR",
            "status": "active",
        })
        doc = build_create_doc(payload)
        self.assertIsInstance(doc["country"], str)
        self.assertIsInstance(doc["categories"][0], str)
        self.assertIsInstance(doc["status"], str)
        self.assertEqual(doc["status"], "active")


# ======================================================================
# build_response_from_tinydb
# ======================================================================

class BuildResponseFromTinydbTest(unittest.TestCase):
    def test_strips_doc_id(self) -> None:
        doc = {
            "doc_id": 1,
            "id": "abc12345",
            "name": "Test",
            "country": "Spain",
            "categories": ["job_boards"],
            "monthly_rate": 100.0,
            "currency": "EUR",
            "status": "active",
            "updated_at": "2026-11-21T12:00:00Z",
        }
        resp = build_response_from_tinydb(doc)
        self.assertEqual(resp.id, "abc12345")

    def test_invalid_doc_raises(self) -> None:
        with self.assertRaises(ValidationError):
            build_response_from_tinydb({
                "doc_id": 1,
                "id": "abc",
                "name": "Test",
                # missing most fields
            })


# ======================================================================
# Seeder data validation
# ======================================================================

class SeederDataTest(unittest.TestCase):
    def test_all_seed_suppliers_are_valid(self) -> None:
        for payload in SUPPLIERS_SEED:
            with self.subTest(name=payload["name"]):
                try:
                    SupplierCreate.model_validate(payload)
                except ValidationError as e:
                    self.fail(
                        f"Seed supplier '{payload['name']}' failed validation: {e.errors()}"
                    )

    def test_seed_has_15_entries(self) -> None:
        self.assertEqual(len(SUPPLIERS_SEED), 15)

    def test_each_seed_supplier_produces_a_valid_response_doc(self) -> None:
        for payload in SUPPLIERS_SEED:
            with self.subTest(name=payload["name"]):
                create = SupplierCreate.model_validate(payload)
                doc = build_create_doc(create)
                resp = build_response_from_tinydb(doc)
                self.assertEqual(resp.name, payload["name"])


if __name__ == "__main__":
    unittest.main()