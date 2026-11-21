#!/usr/bin/env python3
"""Tests for the Supplier Directory TinyDB store + HTTP API.

Run:  python -m unittest test_supplier_api -v
"""

from __future__ import annotations

import json
import os
import threading
import tempfile
import time
import unittest
from http.client import HTTPConnection
from typing import Any

from pydantic import ValidationError

from supplier_models import (
    SUPPLIERS_SEED,
    SupplierCreate,
    SupplierResponse,
    build_create_doc,
)
from supplier_store import SupplierStore
from supplier_api import SupplierHandler, run_server

# ======================================================================
# Constants
# ======================================================================

HOST = "127.0.0.1"
PORT = 18001
_HEADERS = {"Content-Type": "application/json"}

_VALID_PAYLOAD: dict[str, Any] = {
    "name": "Test Supplier",
    "country": "Spain",
    "categories": ["job_boards"],
    "monthly_rate": 500.0,
    "currency": "EUR",
    "status": "active",
}


# ======================================================================
# Helpers
# ======================================================================


def _temp_db() -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    return path


def _request(method: str, path: str, body: Any = None) -> tuple[int, bytes]:
    conn = HTTPConnection(HOST, PORT, timeout=5)
    try:
        raw = None
        if body is not None:
            raw = json.dumps(body).encode("utf-8")
        conn.request(method, path, body=raw, headers=_HEADERS if raw else {})
        resp = conn.getresponse()
        data = resp.read()
        return resp.status, data
    finally:
        conn.close()


# ======================================================================
# Store tests
# ======================================================================


class SupplierStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db_path = _temp_db()
        self.store = SupplierStore(self.db_path)

    def tearDown(self) -> None:
        self.store.close()
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def _seed(self, count: int = 3) -> list[str]:
        ids: list[str] = []
        for raw in SUPPLIERS_SEED[:count]:
            create = SupplierCreate.model_validate(raw)
            doc = build_create_doc(create)
            self.store.insert_raw(doc)
            ids.append(doc["id"])
        return ids

    # ---- create ----

    def test_create_returns_response(self) -> None:
        create = SupplierCreate.model_validate(_VALID_PAYLOAD)
        resp = self.store.create(create)
        self.assertIsInstance(resp, SupplierResponse)
        self.assertEqual(resp.name, "Test Supplier")
        self.assertIsNotNone(resp.id)
        self.assertIsNotNone(resp.updated_at)

    def test_create_persists_to_db(self) -> None:
        create = SupplierCreate.model_validate(_VALID_PAYLOAD)
        self.store.create(create)
        self.assertEqual(self.store.count(), 1)

    # ---- get_by_id ----

    def test_get_by_id_returns_supplier(self) -> None:
        ids = self._seed(1)
        s = self.store.get_by_id(ids[0])
        self.assertIsNotNone(s)
        self.assertEqual(s.id, ids[0])

    def test_get_by_id_nonexistent(self) -> None:
        self.assertIsNone(self.store.get_by_id("deadbeef"))

    # ---- all ----

    def test_all_returns_all(self) -> None:
        ids = self._seed(3)
        all_s = self.store.all()
        self.assertEqual(len(all_s), 3)

    def test_all_empty(self) -> None:
        self.assertEqual(self.store.all(), [])

    # ---- update_rate ----

    def test_update_rate(self) -> None:
        ids = self._seed(1)
        updated = self.store.update_rate(ids[0], 999.0)
        self.assertIsNotNone(updated)
        self.assertAlmostEqual(updated.monthly_rate, 999.0)

    def test_update_rate_also_updates_updated_at(self) -> None:
        ids = self._seed(1)
        original = self.store.get_by_id(ids[0])
        time.sleep(1.1)
        updated = self.store.update_rate(ids[0], 777.0)
        self.assertNotEqual(original.updated_at, updated.updated_at)

    def test_update_rate_nonexistent(self) -> None:
        self.assertIsNone(self.store.update_rate("deadbeef", 100.0))

    # ---- update_status ----

    def test_update_status(self) -> None:
        ids = self._seed(1)
        updated = self.store.update_status(ids[0], "suspended")
        self.assertIsNotNone(updated)
        self.assertEqual(updated.status.value, "suspended")

    def test_update_status_nonexistent(self) -> None:
        self.assertIsNone(self.store.update_status("deadbeef", "active"))

    # ---- delete ----

    def test_delete_returns_true(self) -> None:
        ids = self._seed(1)
        self.assertTrue(self.store.delete(ids[0]))

    def test_delete_removes_from_db(self) -> None:
        ids = self._seed(2)
        self.store.delete(ids[0])
        self.assertEqual(self.store.count(), 1)

    def test_delete_nonexistent(self) -> None:
        self.assertFalse(self.store.delete("deadbeef"))

    # ---- filter ----

    def test_filter_by_country(self) -> None:
        self._seed(15)
        results = self.store.filter(country="Spain")
        for s in results:
            self.assertEqual(s.country.value, "Spain")

    def test_filter_by_category(self) -> None:
        self._seed(15)
        results = self.store.filter(category="job_boards")
        for s in results:
            self.assertIn("job_boards", [c.value for c in s.categories])

    def test_filter_by_both(self) -> None:
        self._seed(15)
        results = self.store.filter(country="USA", category="job_boards")
        for s in results:
            self.assertEqual(s.country.value, "USA")
            self.assertIn("job_boards", [c.value for c in s.categories])

    def test_filter_no_params_returns_all(self) -> None:
        self._seed(5)
        results = self.store.filter()
        self.assertEqual(len(results), 5)


# ======================================================================
# HTTP API integration tests
# ======================================================================


class SupplierApiTest(unittest.TestCase):
    """Starts a real HTTP server for integration tests."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.db_path = _temp_db()
        SupplierHandler.store = SupplierStore(cls.db_path)
        cls.server = run_server(HOST, PORT)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        SupplierHandler.store.close()
        try:
            os.unlink(cls.db_path)
        except OSError:
            pass

    def setUp(self) -> None:
        SupplierHandler.store.close()
        self.db_path = _temp_db()
        SupplierHandler.store = SupplierStore(self.db_path)

    # ---- POST /suppliers ----

    def test_post_201(self) -> None:
        status, data = _request("POST", "/suppliers", _VALID_PAYLOAD)
        self.assertEqual(status, 201)
        body = json.loads(data)
        self.assertEqual(body["name"], "Test Supplier")
        self.assertIn("id", body)
        self.assertIn("updated_at", body)

    def test_post_422_invalid_body(self) -> None:
        status, data = _request("POST", "/suppliers", {"name": ""})
        self.assertEqual(status, 422)
        body = json.loads(data)
        self.assertIn("error", body)

    def test_post_422_zero_rate(self) -> None:
        status, data = _request(
            "POST", "/suppliers",
            {**_VALID_PAYLOAD, "monthly_rate": 0},
        )
        self.assertEqual(status, 422)

    def test_post_400_bad_json(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        conn.request("POST", "/suppliers", body=b"not json", headers=_HEADERS)
        resp = conn.getresponse()
        resp.read()
        conn.close()
        self.assertEqual(resp.status, 400)

    # ---- GET /suppliers ----

    def test_get_all(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        status, data = _request("GET", "/suppliers")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertIsInstance(body, list)
        self.assertGreaterEqual(len(body), 1)

    def test_get_empty(self) -> None:
        status, data = _request("GET", "/suppliers")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data), [])

    def test_get_filter_by_country(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate({
                **_VALID_PAYLOAD,
                "name": "USA Supplier",
                "country": "USA",
                "currency": "USD",
            }))
        )
        status, data = _request("GET", "/suppliers?country=Spain")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["country"], "Spain")

    def test_get_filter_by_category(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        status, data = _request("GET", "/suppliers?category=job_boards")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertGreaterEqual(len(body), 1)

    def test_get_filter_no_match(self) -> None:
        status, data = _request("GET", "/suppliers?country=France")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data), [])

    # ---- GET /suppliers/{id} ----

    def test_get_by_id_200(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        detail = SupplierHandler.store.all()[0]
        status, data = _request("GET", f"/suppliers/{detail.id}")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["id"], detail.id)

    def test_get_by_id_404(self) -> None:
        status, data = _request("GET", "/suppliers/deadbeef")
        self.assertEqual(status, 404)

    # ---- PATCH /suppliers/{id}/rate ----

    def test_patch_rate_200(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/rate", {"monthly_rate": 999.0})
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertAlmostEqual(body["monthly_rate"], 999.0)

    def test_patch_rate_422_zero(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/rate", {"monthly_rate": 0})
        self.assertEqual(status, 422)

    def test_patch_rate_422_negative(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/rate", {"monthly_rate": -100})
        self.assertEqual(status, 422)

    def test_patch_rate_422_missing_field(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/rate", {})
        self.assertEqual(status, 422)

    def test_patch_rate_404(self) -> None:
        status, data = _request("PATCH", "/suppliers/deadbeef/rate", {"monthly_rate": 100})
        self.assertEqual(status, 404)

    # ---- PATCH /suppliers/{id}/status ----

    def test_patch_status_200(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/status", {"status": "suspended"})
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["status"], "suspended")

    def test_patch_status_422_invalid(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("PATCH", f"/suppliers/{sid}/status", {"status": "archived"})
        self.assertEqual(status, 422)

    def test_patch_status_404(self) -> None:
        status, data = _request("PATCH", "/suppliers/deadbeef/status", {"status": "active"})
        self.assertEqual(status, 404)

    # ---- DELETE /suppliers/{id} ----

    def test_delete_200(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        status, data = _request("DELETE", f"/suppliers/{sid}")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["deleted"], sid)

    def test_delete_404(self) -> None:
        status, data = _request("DELETE", "/suppliers/deadbeef")
        self.assertEqual(status, 404)

    def test_delete_removes_from_store(self) -> None:
        SupplierHandler.store.insert_raw(
            build_create_doc(SupplierCreate.model_validate(_VALID_PAYLOAD))
        )
        sid = SupplierHandler.store.all()[0].id
        _request("DELETE", f"/suppliers/{sid}")
        self.assertIsNone(SupplierHandler.store.get_by_id(sid))

    # ---- CORS ----

    def test_cors_preflight(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        conn.request("OPTIONS", "/suppliers")
        resp = conn.getresponse()
        resp.read()
        conn.close()
        self.assertEqual(resp.status, 204)
        self.assertEqual(
            resp.getheader("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )

    # ---- 404 for unknown paths ----

    def test_unknown_path(self) -> None:
        status, data = _request("GET", "/nope")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()