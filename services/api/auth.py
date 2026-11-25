#!/usr/bin/env python3
"""JWT authentication helpers for the User & Profile API.

Provides token creation/validation using python-jose and a
``get_current_user`` dependency function.

Environment variables (loaded from ``.env``):
    SECRET_KEY               — HMAC key for signing JWT tokens.
    ACCESS_TOKEN_EXPIRE_MINUTES — Token lifetime in minutes (default 30).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from jose import JWTError, jwt

from auth_service import UserService

# ------------------------------------------------------------------
# Load environment variables from .env
# ------------------------------------------------------------------

load_dotenv()

_SECRET_KEY: str = os.environ.get("SECRET_KEY", "")
_ALGORITHM = "HS256"
_DEFAULT_EXPIRE_MINUTES = 30


def _get_expire_minutes() -> int:
    try:
        return int(
            os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", str(_DEFAULT_EXPIRE_MINUTES))
        )
    except (ValueError, TypeError):
        return _DEFAULT_EXPIRE_MINUTES


# ------------------------------------------------------------------
# Public helpers
# ------------------------------------------------------------------


def create_access_token(user_id: str) -> str:
    """Create a signed JWT access token for the given user.

    The token carries the user's TinyDB ``id`` in the ``sub`` claim
    and expires after ``ACCESS_TOKEN_EXPIRE_MINUTES``.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=_get_expire_minutes())
    claims: dict[str, Any] = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(claims, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT token.

    Returns the token payload (claims) on success, or ``None`` if
    the token is invalid, expired, or malformed.
    """
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(
    token: str,
    user_service: UserService,
) -> Optional[dict[str, Any]]:
    """Validate the bearer token and return the authenticated user.

    Steps
    -----
    1. Decode the JWT token with ``decode_access_token``.
    2. Extract the ``sub`` claim (user ID).
    3. Look up the user in TinyDB.
    4. Return the raw user document, or ``None`` on failure.

    This is the reusable "dependency" that any protected route can call.
    """
    payload = decode_access_token(token)
    if payload is None:
        return None

    user_id: str | None = payload.get("sub")
    if user_id is None:
        return None

    user = user_service.get_user_by_id(user_id)
    if user is None:
        return None

    return user
