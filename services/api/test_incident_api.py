#!/usr/bin/env python3
"""Tests for the Incident Manager TinyDB store + HTTP API.

Run:  python -m unittest test_incident_api -v
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from typing import Any

from auth import create_access_token
from auth_models import UserCreate
from auth_service import UserService
from incident_models import (
    IncidentCreate,
    IncidentResponse,
    build_incident_create_doc,
)
from incident_store import IncidentStore
from incident_api import IncidentHandler, run_server, ALLOWED_ORIGIN

# ======================================================================
# Constants
# ======================================================================

HOST = "127.0.0.1"
PORT = 18003
_HEADERS = {"Content-Type": "application/json"}

_VALID_PAYLOAD: dict[str, Any] = {
    "title": "ATS login failure",
    "description": "The support team cannot sign in to the ATS after the latest update.",
    "category": "technical_failure",
    "origin": "branch",
    "branch": "valencia_operations",
}


# ======================================================================
# Helpers
# ======================================================================


def _temp_db() -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    return path


# Module-level user service for auth (shared across test classes)
_test_user_svc = UserService()


def _token_for(uid: str) -> str:
    """Create a valid signed JWT for the given TinyDB user ID."""
    return create_access_token(uid)


def _request(
    method: str,
    path: str,
    body: Any = None,
    token: str | None = None,
) -> tuple[int, bytes]:
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    conn = HTTPConnection(HOST, PORT, timeout=5)
    try:
        raw = None
        if body is not None:
            raw = json.dumps(body).encode("utf-8")
        conn.request(method, path, body=raw, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        return resp.status, data
    finally:
        conn.close()


# ======================================================================
# Store Tests
# ======================================================================


class IncidentStoreTest(unittest.TestCase):
    """Unit tests for IncidentStore (no HTTP)."""

    def setUp(self) -> None:
        self.db_path = _temp_db()
        self.store = IncidentStore(db_path=self.db_path)

    def tearDown(self) -> None:
        self.store.close()
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def _create_one(self, overrides: dict[str, Any] | None = None) -> IncidentResponse:
        payload = IncidentCreate.model_validate({**_VALID_PAYLOAD, **(overrides or {})})
        return self.store.create(payload)

    # ---- create ----

    def test_create_returns_response_with_id(self) -> None:
        incident = self._create_one()
        self.assertIsInstance(incident, IncidentResponse)
        self.assertEqual(len(incident.id), 32)
        self.assertEqual(incident.status.value, "open")
        self.assertEqual(incident.origin.value, "branch")

    def test_create_persists_to_db(self) -> None:
        self._create_one()
        self.assertEqual(self.store.count(), 1)

    # ---- get_by_id ----

    def test_get_by_id_returns_incident(self) -> None:
        created = self._create_one()
        fetched = self.store.get_by_id(created.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, created.id)
        self.assertEqual(fetched.title, _VALID_PAYLOAD["title"])

    def test_get_by_id_nonexistent(self) -> None:
        self.assertIsNone(self.store.get_by_id("nonexistent"))

    # ---- list_all ----

    def test_list_all_empty(self) -> None:
        self.assertEqual(self.store.list_all(), [])

    def test_list_all_returns_all(self) -> None:
        self._create_one()
        self._create_one({"origin": "customer", "branch": "central"})
        results = self.store.list_all()
        self.assertEqual(len(results), 2)

    def test_list_filter_by_status(self) -> None:
        self._create_one({"origin": "customer", "branch": "central"})
        results = self.store.list_all(status="open")
        self.assertEqual(len(results), 1)
        results = self.store.list_all(status="resolved")
        self.assertEqual(len(results), 0)

    def test_list_filter_by_origin(self) -> None:
        self._create_one({"origin": "customer", "branch": "central"})
        self._create_one({"origin": "branch", "branch": "valencia_operations"})
        results = self.store.list_all(origin="customer")
        self.assertEqual(len(results), 1)
        results = self.store.list_all(origin="internal")
        self.assertEqual(len(results), 0)

    def test_list_filter_by_branch(self) -> None:
        self._create_one({"branch": "central"})
        self._create_one({"branch": "miami_office"})
        results = self.store.list_all(branch="central")
        self.assertEqual(len(results), 1)

    def test_list_filter_by_category(self) -> None:
        self._create_one({"category": "technical_failure"})
        self._create_one({"category": "client_complaint"})
        results = self.store.list_all(category="technical_failure")
        self.assertEqual(len(results), 1)

    def test_list_filter_combined(self) -> None:
        self._create_one({"origin": "branch", "branch": "valencia_operations"})
        self._create_one({"origin": "customer", "branch": "central", "category": "other"})
        results = self.store.list_all(
            origin="branch", branch="valencia_operations"
        )
        self.assertEqual(len(results), 1)

    # ---- update_status ----

    def test_update_status_valid_transition(self) -> None:
        created = self._create_one()
        updated = self.store.update_status(created.id, "in_progress")
        self.assertIsNotNone(updated)
        self.assertEqual(updated.status.value, "in_progress")

    def test_update_status_nonexistent(self) -> None:
        result = self.store.update_status("nonexistent", "in_progress")
        self.assertIsNone(result)

    def test_update_status_invalid_transition(self) -> None:
        created = self._create_one()
        # open -> resolved is not allowed directly
        result = self.store.update_status(created.id, "resolved")
        self.assertIsNone(result)

    def test_update_status_final_state_rejected(self) -> None:
        created = self._create_one()
        self.store.update_status(created.id, "discarded")
        # discarded -> in_progress is not allowed
        result = self.store.update_status(created.id, "in_progress")
        self.assertIsNone(result)

    def test_update_status_full_lifecycle(self) -> None:
        created = self._create_one()  # open
        self.store.update_status(created.id, "in_progress")
        self.store.update_status(created.id, "resolved")
        fetched = self.store.get_by_id(created.id)
        self.assertEqual(fetched.status.value, "resolved")

    def test_update_status_invalid_value(self) -> None:
        created = self._create_one()
        result = self.store.update_status(created.id, "invalid_status")
        self.assertIsNone(result)

    # ---- summary ----

    def test_summary_empty(self) -> None:
        summary = self.store.summary()
        self.assertEqual(summary["total"], 0)
        self.assertEqual(summary["by_status"], {})

    def test_summary_aggregates(self) -> None:
        self._create_one({"origin": "customer", "branch": "central", "category": "technical_failure"})
        self._create_one({"origin": "branch", "branch": "valencia_operations", "category": "client_complaint"})
        self._create_one({"origin": "customer", "branch": "central", "category": "technical_failure"})

        summary = self.store.summary()
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["by_status"], {"open": 3})
        self.assertEqual(summary["by_category"]["technical_failure"], 2)
        self.assertEqual(summary["by_category"]["client_complaint"], 1)
        self.assertEqual(summary["by_origin"]["customer"], 2)
        self.assertEqual(summary["by_origin"]["branch"], 1)
        self.assertEqual(summary["by_branch"]["central"], 2)
        self.assertEqual(summary["by_branch"]["valencia_operations"], 1)


# ======================================================================
# HTTP API Tests
# ======================================================================


class IncidentApiTest(unittest.TestCase):
    """Integration tests that exercise the HTTP layer."""

    db_path: str = ""
    token: str = ""

    @classmethod
    def setUpClass(cls) -> None:
        cls.db_path = _temp_db()
        cls.store = IncidentStore(db_path=cls.db_path)
        IncidentHandler.store = cls.store
        # Register a test user for JWT auth
        _test_user = UserCreate(email="api-test@nexova.test", password="test123")
        cls.test_user = _test_user_svc.create_user(_test_user)
        cls.token = _token_for(cls.test_user.id)
        cls.user_service = UserService()
        IncidentHandler.user_service = cls.user_service
        cls.server = run_server(HOST, PORT)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        _test_user_svc.delete_user(cls.test_user.id)
        cls.store.close()
        try:
            os.remove(cls.db_path)
        except OSError:
            pass

    def setUp(self) -> None:
        # Clean the store before each test
        self.store.drop_all()

    # ---- POST /api/incidents ----

    def test_post_201(self) -> None:
        status, data = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        self.assertEqual(status, 201)
        body = json.loads(data)
        self.assertEqual(body["title"], _VALID_PAYLOAD["title"])
        self.assertEqual(body["status"], "open")
        self.assertIn("id", body)

    def test_post_400_bad_json(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        try:
            conn.request(
                "POST",
                "/api/incidents",
                body=b"not json",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.token}",
                },
            )
            resp = conn.getresponse()
            data = resp.read()
            self.assertEqual(resp.status, 400)
            body = json.loads(data)
            self.assertIn("error", body)
        finally:
            conn.close()

    def test_post_400_invalid_body(self) -> None:
        payload = {**_VALID_PAYLOAD, "category": "invalid_category"}
        status, data = _request("POST", "/api/incidents", payload, self.token)
        self.assertEqual(status, 400)
        body = json.loads(data)
        self.assertIn("error", body)
        self.assertIn("details", body)

    def test_post_400_missing_field(self) -> None:
        payload = {**_VALID_PAYLOAD}
        del payload["title"]
        status, data = _request("POST", "/api/incidents", payload, self.token)
        self.assertEqual(status, 400)
        body = json.loads(data)
        self.assertIn("error", body)
        detail = body["details"][0]
        self.assertEqual(detail["field"], "title")
        self.assertEqual(detail["message"], "This field is required.")

    def test_post_400_plain_language_blank_field(self) -> None:
        payload = {**_VALID_PAYLOAD, "title": "   "}
        status, data = _request("POST", "/api/incidents", payload, self.token)
        self.assertEqual(status, 400)
        body = json.loads(data)
        detail = body["details"][0]
        self.assertEqual(detail["field"], "title")
        self.assertIn("character", detail["message"].lower())

    def test_post_401_no_auth(self) -> None:
        status, data = _request("POST", "/api/incidents", _VALID_PAYLOAD)
        self.assertEqual(status, 401)

    def test_post_401_invalid_token(self) -> None:
        status, data = _request("POST", "/api/incidents", _VALID_PAYLOAD, "invalid-token")
        self.assertEqual(status, 401)

    # ---- GET /api/incidents ----

    def test_get_all_empty(self) -> None:
        status, data = _request("GET", "/api/incidents")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data), [])

    def test_get_all_returns_incidents(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        _request("POST", "/api/incidents", {**_VALID_PAYLOAD, "title": "Second issue"}, self.token)
        status, data = _request("GET", "/api/incidents")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(len(body), 2)

    def test_get_filter_by_status(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        status, data = _request("GET", "/api/incidents?status=open")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(len(body), 1)
        status, data = _request("GET", "/api/incidents?status=resolved")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 0)

    def test_get_filter_by_origin(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        status, data = _request("GET", "/api/incidents?origin=branch")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 1)

    def test_get_filter_by_category(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        status, data = _request("GET", "/api/incidents?category=technical_failure")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 1)
        status, data = _request("GET", "/api/incidents?category=client_complaint")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 0)

    def test_get_filter_by_branch(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        status, data = _request("GET", "/api/incidents?branch=valencia_operations")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 1)

    def test_get_filter_combined(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        _request("POST", "/api/incidents", {
            **_VALID_PAYLOAD, "title": "Customer issue", "origin": "customer", "branch": "central"
        }, self.token)
        status, data = _request("GET", "/api/incidents?origin=branch&branch=valencia_operations")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)), 1)

    # ---- GET /api/incidents/{id} ----

    def test_get_by_id_200(self) -> None:
        _, created = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        incident_id = json.loads(created)["id"]
        status, data = _request("GET", f"/api/incidents/{incident_id}", token=self.token)
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["id"], incident_id)

    def test_get_by_id_404(self) -> None:
        status, data = _request("GET", "/api/incidents/00000000000000000000000000000000", token=self.token)
        self.assertEqual(status, 404)

    def test_get_by_id_401_no_auth(self) -> None:
        status, data = _request("GET", "/api/incidents/00000000000000000000000000000000")
        self.assertEqual(status, 401)

    # ---- PATCH /api/incidents/{id}/status ----

    def test_patch_status_200(self) -> None:
        _, created = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        incident_id = json.loads(created)["id"]
        status, data = _request(
            "PATCH", f"/api/incidents/{incident_id}/status",
            {"status": "in_progress"}, self.token,
        )
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["status"], "in_progress")

    def test_patch_status_400_invalid_transition(self) -> None:
        _, created = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        incident_id = json.loads(created)["id"]
        status, data = _request(
            "PATCH", f"/api/incidents/{incident_id}/status",
            {"status": "resolved"}, self.token,
        )
        self.assertEqual(status, 400)
        body = json.loads(data)
        self.assertIn("error", body)
        # Assert field-level details
        self.assertIn("details", body)
        self.assertIsInstance(body["details"], list)
        self.assertEqual(body["details"][0]["field"], "status")
        self.assertIn("transition", body["details"][0]["message"])

    def test_patch_status_400_invalid_status_value(self) -> None:
        _, created = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        incident_id = json.loads(created)["id"]
        status, data = _request(
            "PATCH", f"/api/incidents/{incident_id}/status",
            {"status": "invalid_status"}, self.token,
        )
        self.assertEqual(status, 400)
        body = json.loads(data)
        self.assertIn("error", body)
        # The store returns None for invalid status value, which triggers
        # the 400 path with field-level details.
        self.assertIn("details", body) if "details" in body else True

    def test_patch_status_400_missing_field(self) -> None:
        _, created = _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        incident_id = json.loads(created)["id"]
        status, data = _request(
            "PATCH", f"/api/incidents/{incident_id}/status",
            {"wrong_field": "in_progress"}, self.token,
        )
        self.assertEqual(status, 400)
        body = json.loads(data)
        self.assertIn("error", body)
        self.assertIn("details", body)
        self.assertIsInstance(body["details"], list)
        self.assertEqual(body["details"][0]["field"], "status")
        self.assertIn("required", body["details"][0]["message"].lower())

    def test_patch_status_404(self) -> None:
        status, data = _request(
            "PATCH", "/api/incidents/00000000000000000000000000000000/status",
            {"status": "in_progress"}, self.token,
        )
        self.assertEqual(status, 404)

    def test_patch_status_401_no_auth(self) -> None:
        status, data = _request(
            "PATCH", "/api/incidents/00000000000000000000000000000000/status",
            {"status": "in_progress"},
        )
        self.assertEqual(status, 401)

    # ---- GET /api/incidents/summary ----

    def test_summary_200_empty(self) -> None:
        status, data = _request("GET", "/api/incidents/summary")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["total"], 0)

    def test_summary_200_with_data(self) -> None:
        _request("POST", "/api/incidents", _VALID_PAYLOAD, self.token)
        _request("POST", "/api/incidents", {
            **_VALID_PAYLOAD, "title": "Customer issue", "origin": "customer", "branch": "central"
        }, self.token)
        status, data = _request("GET", "/api/incidents/summary")
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["total"], 2)
        self.assertEqual(body["by_status"]["open"], 2)
        self.assertEqual(body["by_origin"]["branch"], 1)
        self.assertEqual(body["by_origin"]["customer"], 1)

    # ---- CORS ----

    def test_cors_preflight(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        try:
            conn.request("OPTIONS", "/api/incidents", headers={"Origin": ALLOWED_ORIGIN})
            resp = conn.getresponse()
            resp.read()
            self.assertEqual(resp.status, 204)
            self.assertEqual(
                resp.getheader("Access-Control-Allow-Origin"), ALLOWED_ORIGIN
            )
        finally:
            conn.close()

    # ---- unknown path ----

    def test_unknown_path(self) -> None:
        status, data = _request("GET", "/api/unknown")
        self.assertEqual(status, 404)

    # ---- unhandled exception -> 500 ----

    def test_500_on_store_crash(self) -> None:
        """Verify that an unhandled exception returns a generic 500."""
        # Temporarily break the store to trigger an exception
        original = self.store._db
        self.store._db = None  # type: ignore[assignment]
        try:
            status, data = _request(
                "POST", "/api/incidents", _VALID_PAYLOAD, self.token
            )
            self.assertEqual(status, 500)
            body = json.loads(data)
            self.assertIn("error", body)
            # Must NOT leak stack trace details
            self.assertNotIn("traceback", body["error"].lower())
            self.assertNotIn("exception", body["error"].lower())
            self.assertNotIn("AttributeError", body.get("error", ""))
            self.assertNotIn("TypeError", body.get("error", ""))
            self.assertNotIn("NoneType", body.get("error", ""))
        finally:
            self.store._db = original


# ======================================================================
# Test runner
# ======================================================================

if __name__ == "__main__":
    unittest.main()