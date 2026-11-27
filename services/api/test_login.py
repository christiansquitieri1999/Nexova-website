"""FastAPI tests for authentication login and protected resources."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from auth_service import UserService
from password_reset import PasswordResetService
from profile_service import ProfileService
from user_api import UserHandler, app


@pytest.fixture
def client() -> Iterator[TestClient]:
    fd_user, user_path = tempfile.mkstemp(suffix=".json")
    fd_profile, profile_path = tempfile.mkstemp(suffix=".json")
    fd_reset, reset_path = tempfile.mkstemp(suffix=".json")
    os.close(fd_user)
    os.close(fd_profile)
    os.close(fd_reset)

    user_service = UserService(user_path)
    profile_service = ProfileService(profile_path)
    reset_service = PasswordResetService(reset_path)
    UserHandler.user_service = user_service
    UserHandler.profile_service = profile_service
    UserHandler.password_reset_service = reset_service

    with TestClient(app) as test_client:
        yield test_client

    reset_service.close()
    profile_service.close()
    user_service.close()
    os.unlink(user_path)
    os.unlink(profile_path)
    os.unlink(reset_path)


def _register(client: TestClient, email: str = "alice@example.com") -> dict[str, object]:
    response = client.post(
        "/users",
        json={"email": email, "password": "secret123"},
    )
    assert response.status_code == 201
    return response.json()["user"]


def test_login_happy_path(client: TestClient) -> None:
    user = _register(client)
    response = client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "secret123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["id"] == user["id"]
    assert body["access_token"]


@pytest.mark.parametrize(
    ("password", "email"),
    [
        ("wrong-password", "alice@example.com"),
        ("secret123", "missing@example.com"),
    ],
)
def test_login_rejects_invalid_credentials(
    client: TestClient,
    password: str,
    email: str,
) -> None:
    _register(client)
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "alice@example.com"},
        {"password": "secret123"},
        {"email": None, "password": "secret123"},
    ],
)
def test_login_rejects_missing_or_invalid_fields(
    client: TestClient,
    payload: dict[str, object],
) -> None:
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 422


def test_auth_me_requires_valid_bearer_token(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401
    assert client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid.token"},
    ).status_code == 401


def test_auth_me_accepts_valid_token(client: TestClient) -> None:
    _register(client)
    login = client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "secret123"},
    )
    token = login.json()["access_token"]
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"
