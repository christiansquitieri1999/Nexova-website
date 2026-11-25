#!/usr/bin/env python3
"""Signed password-reset tokens and Resend email delivery."""

from __future__ import annotations

import json
import os
import uuid
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from jose import JWTError, jwt
from tinydb import Query, TinyDB


load_dotenv()

_HERE = Path(__file__).resolve().parent
_ALGORITHM = "HS256"
_PURPOSE = "password-reset"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().isoformat(timespec="seconds").replace("+00:00", "Z")


class PasswordResetService:
    """Create, validate, consume, and persist password-reset tokens."""

    def __init__(self, db_path: str | None = None) -> None:
        db_dir = _HERE / "db"
        db_dir.mkdir(parents=True, exist_ok=True)
        self._db = TinyDB(db_path or str(db_dir / "password_resets.json"))
        self._lock = threading.RLock()

    def _secret(self) -> str:
        return os.environ.get("RESET_TOKEN_SECRET", "").strip()

    def create_token(self, user_id: str, expiry_minutes: int = 30) -> str:
        secret = self._secret()
        if not secret:
            raise RuntimeError("RESET_TOKEN_SECRET must be configured")

        expires = _utcnow() + timedelta(minutes=expiry_minutes)
        jti = uuid.uuid4().hex
        claims = {
            "sub": user_id,
            "jti": jti,
            "purpose": _PURPOSE,
            "iat": _utcnow(),
            "exp": expires,
        }
        token = jwt.encode(claims, secret, algorithm=_ALGORITHM)

        Reset = Query()
        self._db.insert(
            {
                "jti": jti,
                "user_id": user_id,
                "expires_at": expires.isoformat(timespec="seconds"),
                "used_at": None,
            }
        )
        return token

    def validate_token(self, token: str) -> str | None:
        secret = self._secret()
        if not secret:
            return None
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[_ALGORITHM],
                options={"require": ["sub", "jti", "exp", "purpose"]},
            )
        except JWTError:
            return None

        if payload.get("purpose") != _PURPOSE:
            return None

        jti = payload.get("jti")
        user_id = payload.get("sub")
        if not isinstance(jti, str) or not isinstance(user_id, str):
            return None

        Reset = Query()
        records = self._db.search(Reset.jti == jti)
        if len(records) != 1:
            return None

        record = records[0]
        if record.get("used_at") is not None:
            return None
        if record.get("user_id") != user_id:
            return None
        expires_at = record.get("expires_at")
        if isinstance(expires_at, str):
            try:
                persisted_expiry = datetime.fromisoformat(
                    expires_at.replace("Z", "+00:00")
                )
                if persisted_expiry <= _utcnow():
                    return None
            except ValueError:
                return None
        else:
            return None
        return user_id

    def consume_token(self, token: str) -> str | None:
        with self._lock:
            user_id = self.validate_token(token)
            if user_id is None:
                return None
            return self._consume_validated_token(token, user_id)

    def _consume_validated_token(self, token: str, user_id: str) -> str | None:
        secret = self._secret()
        try:
            payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
        except JWTError:
            return None

        jti = payload.get("jti")
        if not isinstance(jti, str):
            return None

        Reset = Query()
        marked = self._db.update(
            {"used_at": _utcnow_iso()},
            (Reset.jti == jti) & (Reset.used_at == None),
        )
        return user_id if marked else None

    def consume_token_after_action(
        self,
        token: str,
        action: Callable[[str], bool],
    ) -> str | None:
        """Validate under a lock, run one password update, then consume."""
        with self._lock:
            user_id = self.validate_token(token)
            if user_id is None:
                return None
            if not action(user_id):
                return None
            return self._consume_validated_token(token, user_id)

    def close(self) -> None:
        self._db.close()


def send_password_reset_email(email: str, reset_link: str) -> None:
    """Send a mobile-readable reset email through Resend."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    from_email = os.environ.get("RESEND_FROM_EMAIL", "").strip()
    if not api_key or not from_email:
        raise RuntimeError("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured")

    html = f"""
    <div style="max-width:480px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;color:#18211d">
      <h1 style="font-size:22px">Reset your Nexova password</h1>
      <p>We received a request to reset your password. The link expires in 30 minutes.</p>
      <p style="margin:24px 0">
        <a href="{reset_link}" style="display:inline-block;padding:12px 18px;background:#176b52;color:#fff;text-decoration:none;border-radius:6px">
          Reset password
        </a>
      </p>
      <p style="font-size:13px;color:#5f6b66">If you did not request this, you can safely ignore this email.</p>
    </div>
    """.strip()

    payload = json.dumps(
        {
            "from": from_email,
            "to": [email],
            "subject": "Reset your Nexova password",
            "html": html,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status not in (200, 201):
                raise RuntimeError("Resend returned an unsuccessful response")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Unable to send password reset email") from exc
