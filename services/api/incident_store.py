#!/usr/bin/env python3
"""TinyDB-backed store for the Nexova Incident Manager.

Provides CRUD, filtering, pagination, status transitions, and summary
aggregation, wrapping TinyDB so the HTTP layer never talks directly to
the database.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tinydb import TinyDB, Query

from incident_models import (
    VALID_STATUS_TRANSITIONS,
    IncidentCreate,
    IncidentResponse,
    IncidentStatus,
    build_incident_create_doc,
    build_incident_response,
)

_HERE = Path(__file__).resolve().parent
_DB_DIR = _HERE / "db"


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


def _utcnow_iso() -> str:
    """Return current UTC time as ISO-8601 with Z suffix, no microseconds."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _db_path() -> str:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    return str(_DB_DIR / "incidents.json")


# ------------------------------------------------------------------
# Store class
# ------------------------------------------------------------------


class IncidentStore:
    """Manages incident persistence via TinyDB.

    Thread-safety: TinyDB uses file-level locking, safe for the
    single-process threaded HTTP server we run.
    """

    def __init__(self, db_path: str | None = None) -> None:
        self._db = TinyDB(db_path or _db_path())

    # ---- raw helpers ----

    def _all_raw(self) -> list[dict[str, Any]]:
        return self._db.all()

    def _get_raw(self, incident_id: str) -> dict[str, Any] | None:
        Incident = Query()
        results = self._db.search(Incident.id == incident_id)
        return results[0] if results else None

    def _upsert_raw(self, doc: dict[str, Any]) -> None:
        """Replace an existing document (matched by its TinyDB doc_id)."""
        self._db.update(doc, doc_ids=[doc.doc_id])

    # ---- CRUD ----

    def create(self, payload: IncidentCreate) -> IncidentResponse:
        doc = build_incident_create_doc(payload)
        self._db.insert(doc)
        return build_incident_response(doc)

    def get_by_id(self, incident_id: str) -> IncidentResponse | None:
        doc = self._get_raw(incident_id)
        return build_incident_response(doc) if doc else None

    # ---- list + filtering ----

    def list_all(
        self,
        status: str | None = None,
        origin: str | None = None,
        branch: str | None = None,
        category: str | None = None,
    ) -> list[IncidentResponse]:
        results = self._all_raw()
        if status:
            results = [d for d in results if d.get("status") == status]
        if origin:
            results = [d for d in results if d.get("origin") == origin]
        if branch:
            results = [d for d in results if d.get("branch") == branch]
        if category:
            results = [d for d in results if d.get("category") == category]
        return [build_incident_response(d) for d in results]

    # ---- status transitions ----

    def update_status(self, incident_id: str, new_status: str) -> IncidentResponse | None:
        """Advance an incident's status.

        Returns None if the incident does not exist or the transition is
        invalid.  Callers should check the return value and respond
        accordingly.
        """
        raw = self._get_raw(incident_id)
        if raw is None:
            return None

        current = raw["status"]
        # Validate the transition
        try:
            current_enum = IncidentStatus(current)
            target_enum = IncidentStatus(new_status)
        except ValueError:
            return None  # invalid status value

        allowed = VALID_STATUS_TRANSITIONS.get(current_enum)
        if allowed is None or target_enum not in allowed:
            return None  # not a valid transition

        raw["status"] = new_status
        raw["updated_at"] = _utcnow_iso()
        self._upsert_raw(raw)
        return build_incident_response(raw)

    # ---- summary / aggregation ----

    def summary(self) -> dict[str, Any]:
        """Return aggregated metrics across all incidents."""
        raw = self._all_raw()
        if not raw:
            return {
                "by_status": {},
                "by_category": {},
                "by_origin": {},
                "by_branch": {},
                "total": 0,
            }

        statuses: Counter[str] = Counter()
        categories: Counter[str] = Counter()
        origins: Counter[str] = Counter()
        branches: Counter[str] = Counter()

        for doc in raw:
            statuses[doc.get("status", "unknown")] += 1
            categories[doc.get("category", "unknown")] += 1
            origins[doc.get("origin", "unknown")] += 1
            branches[doc.get("branch", "unknown")] += 1

        return {
            "by_status": dict(statuses.most_common()),
            "by_category": dict(categories.most_common()),
            "by_origin": dict(origins.most_common()),
            "by_branch": dict(branches.most_common()),
            "total": len(raw),
        }

    # ---- seeding support ----

    def count(self) -> int:
        return len(self._db)

    def insert_raw(self, doc: dict[str, Any]) -> None:
        self._db.insert(doc)

    def insert_multiple_raw(self, docs: list[dict[str, Any]]) -> None:
        self._db.insert_multiple(docs)

    # ---- lifecycle ----

    def close(self) -> None:
        self._db.close()

    def drop_all(self) -> None:
        self._db.truncate()