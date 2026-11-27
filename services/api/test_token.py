"""Unit tests for session and password-reset token behavior."""

from __future__ import annotations

import os
import tempfile

import pytest

from auth import create_access_token, decode_access_token
from password_reset import PasswordResetService


def test_access_token_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "test-session-secret")
    token = create_access_token("user-123")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["exp"]


def test_access_token_rejects_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "test-secret-one")
    token = create_access_token("user-123")
    monkeypatch.setenv("SECRET_KEY", "test-secret-two")
    assert decode_access_token(token) is None


def test_access_token_rejects_malformed_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "test-session-secret")
    assert decode_access_token("not-a-jwt") is None


def test_reset_token_is_consumed_once(monkeypatch: pytest.MonkeyPatch) -> None:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    monkeypatch.setenv("RESET_TOKEN_SECRET", "test-reset-secret")
    service = PasswordResetService(path)
    try:
        token = service.create_token("user-123")
        assert service.validate_token(token) == "user-123"
        assert service.consume_token(token) == "user-123"
        assert service.consume_token(token) is None
    finally:
        service.close()
        os.unlink(path)


def test_reset_token_rejects_expired_token(monkeypatch: pytest.MonkeyPatch) -> None:
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    monkeypatch.setenv("RESET_TOKEN_SECRET", "test-reset-secret")
    service = PasswordResetService(path)
    try:
        token = service.create_token("user-123", expiry_minutes=-1)
        assert service.validate_token(token) is None
    finally:
        service.close()
        os.unlink(path)
