"""FastAPI tests for user registration."""

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
def temp_services(
    tmp_path: object,
) -> Iterator[tuple[UserService, ProfileService, PasswordResetService]]:
    del tmp_path
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
    yield user_service, profile_service, reset_service
    reset_service.close()
    profile_service.close()
    user_service.close()
    os.unlink(user_path)
    os.unlink(profile_path)
    os.unlink(reset_path)


@pytest.fixture
def client(temp_services: object) -> Iterator[TestClient]:
    del temp_services
    with TestClient(app) as test_client:
        yield test_client


def test_registration_happy_path(client: TestClient) -> None:
    response = client.post(
        "/users",
        json={
            "email": "alice@example.com",
            "password": "secret123",
            "name": "Alice",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["profile"]["name"] == "Alice"
    assert "hashed_password" not in body["user"]


def test_registration_rejects_duplicate_email(client: TestClient) -> None:
    payload = {"email": "alice@example.com", "password": "secret123"}
    assert client.post("/users", json=payload).status_code == 201
    duplicate = client.post("/users", json=payload)
    assert duplicate.status_code == 409
    assert "already exists" in duplicate.json()["error"]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "invalid", "password": "secret123"},
        {"email": "alice@example.com", "password": "123"},
        {"email": "alice@example.com", "password": "123", "name": "x" * 201},
    ],
)
def test_registration_rejects_invalid_input(
    client: TestClient,
    payload: dict[str, object],
) -> None:
    response = client.post("/users", json=payload)
    assert response.status_code == 422


def test_registration_rejects_invalid_json(client: TestClient) -> None:
    response = client.post(
        "/users",
        content=b"not-json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
