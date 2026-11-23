#!/usr/bin/env python3
"""TinyDB-backed store for User Profile data.

A Profile has a one-to-one relationship with a User (linked by
``user_id``).  When a User is deleted, the linked Profile is also
removed.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from tinydb import TinyDB, Query

from profile_models import (
    ProfileCreate,
    ProfileUpdate,
    ProfileResponse,
    build_profile_create_doc,
    build_profile_response_from_tinydb,
)


_HERE = Path(__file__).resolve().parent
_DB_DIR = _HERE / "db"


def _db_path() -> str:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    return str(_DB_DIR / "profiles.json")


class ProfileService:
    """Manages profile persistence via TinyDB."""

    def __init__(self, db_path: str | None = None) -> None:
        self._db = TinyDB(db_path or _db_path())

    # ---- CRUD ----

    def create_profile(self, user_id: str, payload: ProfileCreate) -> ProfileResponse:
        """Create a profile linked to a user."""
        doc = build_profile_create_doc(user_id, payload)
        self._db.insert(doc)
        return build_profile_response_from_tinydb(doc)

    def get_profile_by_user_id(self, user_id: str) -> Optional[ProfileResponse]:
        """Get a profile by its linked user ID."""
        Profile = Query()
        results = self._db.search(Profile.user_id == user_id)
        if not results:
            return None
        return build_profile_response_from_tinydb(results[0])

    def get_profile_by_id(self, profile_id: str) -> Optional[ProfileResponse]:
        """Get a profile by its own ID."""
        Profile = Query()
        results = self._db.search(Profile.id == profile_id)
        if not results:
            return None
        return build_profile_response_from_tinydb(results[0])

    def update_profile(
        self, user_id: str, payload: ProfileUpdate
    ) -> Optional[ProfileResponse]:
        """Update a profile by its linked user ID.  Returns None if not found."""
        Profile = Query()
        results = self._db.search(Profile.user_id == user_id)
        if not results:
            return None
        doc = results[0]
        if payload.name is not None:
            doc["name"] = payload.name
        if payload.phone is not None:
            doc["phone"] = payload.phone
        if payload.address is not None:
            doc["address"] = payload.address
        self._db.update(doc, doc_ids=[doc.doc_id])
        return build_profile_response_from_tinydb(doc)

    def delete_profile_by_user_id(self, user_id: str) -> bool:
        """Delete a profile by its linked user ID.  Returns True if deleted."""
        Profile = Query()
        results = self._db.search(Profile.user_id == user_id)
        if not results:
            return False
        self._db.remove(doc_ids=[results[0].doc_id])
        return True

    def close(self) -> None:
        self._db.close()
