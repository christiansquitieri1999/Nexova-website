#!/usr/bin/env python3
"""Service layer for User authentication and CRUD operations.

Provides functions that wrap TinyDB with password hashing, email
uniqueness enforcement, and safe response serialisation.

Thread-safety: TinyDB uses file-level locking, safe for the
single-process threaded HTTP server we run.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from passlib.hash import bcrypt
from tinydb import TinyDB, Query

from auth_models import (
    UserCreate,
    UserUpdate,
    UserResponse,
    build_user_create_doc,
    build_user_response_from_tinydb,
    build_user_create_from_tinydb,
)


_HERE = Path(__file__).resolve().parent
_DB_DIR = _HERE / "db"


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


def _db_path() -> str:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    return str(_DB_DIR / "users.json")


def _hash_password(plain: str) -> str:
    """Return a bcrypt hash of the given plain-text password."""
    return bcrypt.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return bcrypt.verify(plain, hashed)


# ------------------------------------------------------------------
# Service class
# ------------------------------------------------------------------


class UserService:
    """Manages user persistence via TinyDB."""

    def __init__(self, db_path: str | None = None) -> None:
        self._db = TinyDB(db_path or _db_path())

    # ---- helpers ----

    def _email_exists(self, email: str) -> bool:
        """Return True if a user with this email already exists."""
        User = Query()
        return self._db.contains(User.email == email.lower())

    # ---- CRUD ----

    def create_user(self, payload: UserCreate) -> UserResponse:
        """Create a new user with a hashed password.

        Raises
        ------
        ValueError
            If a user with this email already exists.
        """
        email_lower = payload.email.lower()
        if self._email_exists(email_lower):
            raise ValueError(f"A user with email '{email_lower}' already exists.")

        hashed = _hash_password(payload.password)
        doc = build_user_create_doc(payload, hashed)
        # Override with lowercased email
        doc["email"] = email_lower
        self._db.insert(doc)
        return build_user_response_from_tinydb(doc)

    def get_user_by_id(self, user_id: str) -> Optional[dict[str, Any]]:
        """Return the raw TinyDB document for a user ID, or None.

        Returns the full document (including hashed_password) for
        internal use — e.g. by ``authenticate``.
        """
        User = Query()
        results = self._db.search(User.id == user_id)
        return build_user_create_from_tinydb(results[0]) if results else None

    def get_user_by_email(self, email: str) -> Optional[dict[str, Any]]:
        """Return the raw TinyDB document for an email, or None.

        Returns the full document (including hashed_password) for
        internal use — e.g. by ``authenticate``.
        """
        User = Query()
        results = self._db.search(User.email == email.lower())
        return build_user_create_from_tinydb(results[0]) if results else None

    def get_user_response_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Return a safe (no-password) UserResponse for API output."""
        raw = self.get_user_by_id(user_id)
        return build_user_response_from_tinydb(raw) if raw else None

    def get_user_response_by_email(self, email: str) -> Optional[UserResponse]:
        """Return a safe (no-password) UserResponse for API output."""
        raw = self.get_user_by_email(email)
        return build_user_response_from_tinydb(raw) if raw else None

    def update_user(self, user_id: str, payload: UserUpdate) -> Optional[UserResponse]:
        """Update a user's mutable fields.

        Only the fields provided in ``payload`` are changed.  Returns
        the updated UserResponse, or None if the user ID was not found.

        Raises
        ------
        ValueError
            If the new email conflicts with an existing user.
        """
        raw = None
        User = Query()
        results = self._db.search(User.id == user_id)
        if not results:
            return None
        raw = results[0]

        # Apply each provided field
        if payload.email is not None:
            new_email = payload.email.lower()
            # Ensure the new email is not taken by another user
            conflict = self._db.search((User.email == new_email) & (User.id != user_id))
            if conflict:
                raise ValueError(f"Email '{new_email}' is already in use.")
            raw["email"] = new_email

        if payload.password is not None:
            raw["hashed_password"] = _hash_password(payload.password)

        if payload.is_active is not None:
            raw["is_active"] = payload.is_active

        if payload.role is not None:
            raw["role"] = payload.role.value

        self._db.update(raw, doc_ids=[raw.doc_id])
        return build_user_response_from_tinydb(raw)

    def delete_user(self, user_id: str) -> bool:
        """Delete a user by ID.  Returns True if deleted, False if not found."""
        User = Query()
        results = self._db.search(User.id == user_id)
        if not results:
            return False
        self._db.remove(doc_ids=[results[0].doc_id])
        return True

    def list_users(self) -> list[UserResponse]:
        """Return all users as safe response objects."""
        return [build_user_response_from_tinydb(doc) for doc in self._db.all()]

    def count(self) -> int:
        return len(self._db)

    # ---- authentication ----

    def authenticate(self, email: str, password: str) -> Optional[dict[str, Any]]:
        """Validate credentials and return the raw user document, or None.

        Returns None if the email was not found, the password is wrong,
        or the account is deactivated.
        """
        user = self.get_user_by_email(email)
        if user is None:
            return None
        if not user["is_active"]:
            return None
        if not _verify_password(password, user["hashed_password"]):
            return None
        return user

    # ---- lifecycle ----

    def close(self) -> None:
        self._db.close()
