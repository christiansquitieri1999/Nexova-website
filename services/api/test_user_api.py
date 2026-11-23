#!/usr/bin/env python3
"""Integration tests for the User & Profile HTTP API.

Run:  uv run python -m unittest test_user_api -v
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

from auth import create_access_token
from user_api import UserHandler, run_server

# ======================================================================
# Constants
# ======================================================================

HOST = "127.0.0.1"
PORT = 18002
_HEADERS = {"Content-Type": "application/json"}

_VALID_PAYLOAD: dict[str, Any] = {
    "email": "alice@example.com",
    "password": "secret123",
}


# ======================================================================
# Helpers
# ======================================================================


def _temp_db(suffix: str = ".json") -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return path


def _request(
    method: str,
    path: str,
    body: Any = None,
    token: str | None = None,
) -> tuple[int, bytes]:
    headers = dict(_HEADERS)
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


def _token_for(uid: str) -> str:
    """Create a JWT for the given user ID (for test purposes)."""
    return create_access_token(uid)


# ======================================================================
# Test class
# ======================================================================


class UserApiTest(unittest.TestCase):
    """Starts a real HTTP server for integration tests."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.user_db_path = _temp_db()
        cls.profile_db_path = _temp_db()
        # Import services here so they use our temp paths
        from auth_service import UserService
        from profile_service import ProfileService

        UserHandler.user_service = UserService(cls.user_db_path)
        UserHandler.profile_service = ProfileService(cls.profile_db_path)
        cls.server = run_server(HOST, PORT)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.2)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        UserHandler.user_service.close()
        UserHandler.profile_service.close()
        try:
            os.unlink(cls.user_db_path)
            os.unlink(cls.profile_db_path)
        except OSError:
            pass

    def setUp(self) -> None:
        # Fresh services per test
        from auth_service import UserService
        from profile_service import ProfileService

        UserHandler.user_service.close()
        UserHandler.profile_service.close()
        self.user_db = _temp_db()
        self.profile_db = _temp_db()
        UserHandler.user_service = UserService(self.user_db)
        UserHandler.profile_service = ProfileService(self.profile_db)

    def tearDown(self) -> None:
        try:
            os.unlink(self.user_db)
            os.unlink(self.profile_db)
        except OSError:
            pass

    # ==============================================================
    # POST /users
    # ==============================================================

    def test_post_201(self) -> None:
        status, data = _request("POST", "/users", _VALID_PAYLOAD)
        self.assertEqual(status, 201)
        body = json.loads(data)
        self.assertIn("user", body)
        self.assertIn("profile", body)
        self.assertEqual(body["user"]["email"], "alice@example.com")
        self.assertEqual(body["user"]["role"], "user")
        self.assertIn("id", body["user"])
        self.assertNotIn("hashed_password", body["user"])

    def test_post_201_with_profile(self) -> None:
        status, data = _request(
            "POST",
            "/users",
            {
                "email": "bob@example.com",
                "password": "bob123",
                "name": "Bob Builder",
                "phone": "+34 600 111 222",
            },
        )
        self.assertEqual(status, 201)
        body = json.loads(data)
        self.assertEqual(body["profile"]["name"], "Bob Builder")
        self.assertEqual(body["profile"]["phone"], "+34 600 111 222")
        self.assertIsNone(body["profile"]["address"])

    def test_post_201_admin_role(self) -> None:
        status, data = _request(
            "POST",
            "/users",
            {
                "email": "admin@example.com",
                "password": "admin123",
                "role": "admin",
            },
        )
        self.assertEqual(status, 201)
        body = json.loads(data)
        self.assertEqual(body["user"]["role"], "admin")

    def test_post_409_duplicate_email(self) -> None:
        _request("POST", "/users", _VALID_PAYLOAD)
        status, data = _request("POST", "/users", _VALID_PAYLOAD)
        self.assertEqual(status, 409)

    def test_post_422_invalid_body(self) -> None:
        status, data = _request("POST", "/users", {"email": "bad"})
        self.assertEqual(status, 422)
        body = json.loads(data)
        self.assertIn("error", body)
        self.assertIn("details", body)

    def test_post_400_bad_json(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        conn.request("POST", "/users", body=b"not json", headers=_HEADERS)
        resp = conn.getresponse()
        resp.read()
        conn.close()
        self.assertEqual(resp.status, 400)

    # ==============================================================
    # GET /users
    # ==============================================================

    def test_get_all_requires_auth(self) -> None:
        status, data = _request("GET", "/users")
        self.assertEqual(status, 401)

    def test_get_all_200(self) -> None:
        # Create a user to get a valid token
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("GET", "/users", token=_token_for(uid))
        self.assertEqual(status, 200)
        users = json.loads(data)
        self.assertIsInstance(users, list)
        self.assertGreaterEqual(len(users), 1)

    def test_get_all_includes_profiles(self) -> None:
        _, resp = _request(
            "POST", "/users", {**_VALID_PAYLOAD, "name": "Alice", "phone": "+34"}
        )
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("GET", "/users", token=_token_for(uid))
        users = json.loads(data)
        self.assertIsNotNone(users[0].get("profile"))

    # ==============================================================
    # GET /users/{id}
    # ==============================================================

    def test_get_by_id_200(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("GET", f"/users/{uid}", token=_token_for(uid))
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["id"], uid)
        self.assertEqual(body["email"], "alice@example.com")

    def test_get_by_id_401_no_auth(self) -> None:
        status, data = _request("GET", "/users/someid")
        self.assertEqual(status, 401)

    def test_get_by_id_404(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]
        status, data = _request("GET", "/users/deadbeef", token=_token_for(uid))
        self.assertEqual(status, 404)

    # ==============================================================
    # PUT /users/{id}
    # ==============================================================

    def test_put_200_self_update_email(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request(
            "PUT", f"/users/{uid}", {"email": "alice_new@example.com"}, _token_for(uid)
        )
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["email"], "alice_new@example.com")

    def test_put_200_self_update_password(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request(
            "PUT", f"/users/{uid}", {"password": "newpass123"}, _token_for(uid)
        )
        self.assertEqual(status, 200)
        # Verify password was updated by authenticating
        user = UserHandler.user_service.authenticate("alice@example.com", "newpass123")
        self.assertIsNotNone(user)

    def test_put_200_admin_can_change_role(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]
        _, resp2 = _request(
            "POST",
            "/users",
            {"email": "admin@example.com", "password": "admin123", "role": "admin"},
        )
        admin_id = json.loads(resp2)["user"]["id"]

        status, data = _request(
            "PUT", f"/users/{uid}", {"role": "manager"}, _token_for(admin_id)
        )
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["role"], "manager")

    def test_put_403_non_admin_cannot_change_role(self) -> None:
        _, resp = _request(
            "POST", "/users", {"email": "a@example.com", "password": "secretA"}
        )
        uid1 = json.loads(resp)["user"]["id"]
        _, resp2 = _request(
            "POST", "/users", {"email": "b@example.com", "password": "secretB"}
        )
        uid2 = json.loads(resp2)["user"]["id"]
        status, data = _request(
            "PUT", f"/users/{uid2}", {"role": "admin"}, _token_for(uid1)
        )
        self.assertEqual(status, 403)

    def test_put_403_other_user(self) -> None:
        _, resp = _request(
            "POST", "/users", {"email": "a@example.com", "password": "secretA"}
        )
        uid1 = json.loads(resp)["user"]["id"]
        _, resp2 = _request(
            "POST", "/users", {"email": "b@example.com", "password": "secretB"}
        )
        uid2 = json.loads(resp2)["user"]["id"]
        status, data = _request(
            "PUT", f"/users/{uid2}", {"email": "hacked@example.com"}, _token_for(uid1)
        )
        self.assertEqual(status, 403)

    def test_put_404(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]
        status, data = _request(
            "PUT", "/users/deadbeef", {"email": "x@x.com"}, _token_for(uid)
        )
        self.assertEqual(status, 404)

    # ==============================================================
    # DELETE /users/{id}
    # ==============================================================

    def test_delete_200_self(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("DELETE", f"/users/{uid}", token=_token_for(uid))
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["deleted"], uid)

    def test_delete_200_admin(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]
        _, resp2 = _request(
            "POST",
            "/users",
            {"email": "admin@example.com", "password": "admin123", "role": "admin"},
        )
        admin_id = json.loads(resp2)["user"]["id"]

        status, data = _request("DELETE", f"/users/{uid}", token=_token_for(admin_id))
        self.assertEqual(status, 200)

    def test_delete_403_other_user(self) -> None:
        _, resp = _request(
            "POST", "/users", {"email": "a@example.com", "password": "secretA"}
        )
        uid1 = json.loads(resp)["user"]["id"]
        _, resp2 = _request(
            "POST", "/users", {"email": "b@example.com", "password": "secretB"}
        )
        uid2 = json.loads(resp2)["user"]["id"]
        status, data = _request("DELETE", f"/users/{uid2}", token=_token_for(uid1))
        self.assertEqual(status, 403)

    def test_delete_also_removes_profile(self) -> None:
        _, resp = _request(
            "POST", "/users", {**_VALID_PAYLOAD, "name": "Alice", "phone": "+34"}
        )
        uid = json.loads(resp)["user"]["id"]

        # Verify profile exists
        profile = UserHandler.profile_service.get_profile_by_user_id(uid)
        self.assertIsNotNone(profile)

        # Delete user
        _request("DELETE", f"/users/{uid}", token=_token_for(uid))

        # Profile should be gone too
        profile = UserHandler.profile_service.get_profile_by_user_id(uid)
        self.assertIsNone(profile)

    def test_delete_401_no_auth(self) -> None:
        status, data = _request("DELETE", "/users/someid")
        self.assertEqual(status, 401)

    # ==============================================================
    # CORS
    # ==============================================================

    def test_cors_preflight(self) -> None:
        conn = HTTPConnection(HOST, PORT, timeout=5)
        conn.request("OPTIONS", "/users")
        resp = conn.getresponse()
        resp.read()
        conn.close()
        self.assertEqual(resp.status, 204)
        self.assertEqual(
            resp.getheader("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )

    # ==============================================================
    # 404
    # ==============================================================

    def test_unknown_path(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]
        status, data = _request("GET", "/nope", token=_token_for(uid))
        self.assertEqual(status, 404)

        # ==============================================================
        # GET /profiles/me
        # ==============================================================

    def test_get_my_profile_200(self) -> None:
        _, resp = _request(
            "POST",
            "/users",
            {**_VALID_PAYLOAD, "name": "Alice", "phone": "+34 600 000 000"},
        )
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("GET", "/profiles/me", token=_token_for(uid))
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["name"], "Alice")
        self.assertEqual(body["phone"], "+34 600 000 000")
        self.assertEqual(body["user_id"], uid)

    def test_get_my_profile_401_no_auth(self) -> None:
        status, data = _request("GET", "/profiles/me")
        self.assertEqual(status, 401)

    # ==============================================================
    # PUT /profiles/me
    # ==============================================================

    def test_put_my_profile_200(self) -> None:
        _, resp = _request("POST", "/users", {**_VALID_PAYLOAD, "name": "Alice"})
        uid = json.loads(resp)["user"]["id"]

        status, data = _request(
            "PUT",
            "/profiles/me",
            {"name": "Alice Updated", "phone": "+34 666 777 888"},
            _token_for(uid),
        )
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertEqual(body["name"], "Alice Updated")
        self.assertEqual(body["phone"], "+34 666 777 888")

    def test_put_my_profile_401_no_auth(self) -> None:
        status, data = _request("PUT", "/profiles/me", {"name": "X"})
        self.assertEqual(status, 401)

    def test_put_my_profile_422_empty_body(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("PUT", "/profiles/me", {}, _token_for(uid))
        self.assertEqual(status, 422)
        body = json.loads(data)
        self.assertIn("error", body)

    def test_put_my_profile_422_invalid_field(self) -> None:
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request(
            "PUT",
            "/profiles/me",
            {
                "name": "a" * 300  # exceeds max_length=200
            },
            _token_for(uid),
        )
        self.assertEqual(status, 422)
        body = json.loads(data)
        self.assertIn("error", body)


# ==============================================================
    # POST /auth/login
    # ==============================================================

    def test_auth_login_200(self) -> None:
        # First create a user
        _, resp = _request("POST", "/users", _VALID_PAYLOAD)
        uid = json.loads(resp)["user"]["id"]

        status, data = _request(
            "POST", "/auth/login",
            {"email": "alice@example.com", "password": "secret123"},
        )
        self.assertEqual(status, 200)
        body = json.loads(data)
        self.assertIn("access_token", body)
        self.assertEqual(body["token_type"], "bearer")
        self.assertIn("user", body)
        self.assertEqual(body["user"]["id"], uid)
        self.assertEqual(body["user"]["email"], "alice@example.com")
        self.assertEqual(body["user"]["role"], "user")

    def test_auth_login_401_invalid_password(self) -> None:
        _request("POST", "/users", _VALID_PAYLOAD)

        status, data = _request(
            "POST", "/auth/login",
            {"email": "alice@example.com", "password": "wrongpass"},
        )
        self.assertEqual(status, 401)
        body = json.loads(data)
        self.assertIn("error", body)

    def test_auth_login_401_unknown_user(self) -> None:
        status, data = _request(
            "POST", "/auth/login",
            {"email": "nobody@example.com", "password": "secret123"},
        )
        self.assertEqual(status, 401)

    def test_auth_login_422_missing_fields(self) -> None:
        status, data = _request("POST", "/auth/login", {"email": "only"})
        self.assertEqual(status, 422)

        status, data = _request("POST", "/auth/login", {"password": "only"})
        self.assertEqual(status, 422)

    # ==============================================================
    # GET /auth/me
    # ==============================================================

    def test_auth_me_200(self) -> None:
        _, resp = _request(
            "POST", "/users",
            {**_VALID_PAYLOAD, "name": "Alice", "phone": "+34 600 111 222"},
        )
        uid = json.loads(resp)["user"]["id"]

        status, data = _request("GET", "/auth/me", token=_token_for(uid))
        self.assertEqual(status, 200)
        body = json.loads(data)
        # User fields
        self.assertEqual(body["email"], "alice@example.com")
        self.assertEqual(body["role"], "user")
        # Profile fields
        self.assertIn("profile", body)
        self.assertEqual(body["profile"]["name"], "Alice")
        self.assertEqual(body["profile"]["phone"], "+34 600 111 222")

    def test_auth_me_401_no_token(self) -> None:
        status, data = _request("GET", "/auth/me")
        self.assertEqual(status, 401)

    def test_auth_me_401_invalid_token(self) -> None:
        status, data = _request("GET", "/auth/me", token="invalid.jwt.token")
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
