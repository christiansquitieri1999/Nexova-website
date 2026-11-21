#!/usr/bin/env python3
"""TinyDB-backed store for the Supplier Directory.

Provides CRUD operations, filtering, and seeding, wrapping TinyDB so the
HTTP layer never talks directly to the database.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from tinydb import TinyDB, Query

from supplier_models import (
    SupplierCreate,
    SupplierPatch,
    SupplierResponse,
    build_create_doc,
    build_response_from_tinydb,
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
    return str(_DB_DIR / "suppliers.json")


# ------------------------------------------------------------------
# Store class
# ------------------------------------------------------------------

class SupplierStore:
    """Manages supplier persistence via TinyDB.

    Thread-safety: TinyDB uses file-level locking, safe for the
    single-process threaded HTTP server we run.
    """

    def __init__(self, db_path: str | None = None) -> None:
        self._db = TinyDB(db_path or _db_path())

    # ---- helpers ----

    def _all_raw(self) -> list[dict[str, Any]]:
        return self._db.all()

    def _get_raw(self, supplier_id: str) -> dict[str, Any] | None:
        Supplier = Query()
        result = self._db.search(Supplier.id == supplier_id)
        return result[0] if result else None

    # ---- CRUD ----

    def create(self, payload: SupplierCreate) -> SupplierResponse:
        doc = build_create_doc(payload)
        self._db.insert(doc)
        return build_response_from_tinydb(doc)

    def all(self) -> list[SupplierResponse]:
        return [
            build_response_from_tinydb(doc)
            for doc in self._all_raw()
        ]

    def get_by_id(self, supplier_id: str) -> SupplierResponse | None:
        doc = self._get_raw(supplier_id)
        return build_response_from_tinydb(doc) if doc else None

    def update_rate(self, supplier_id: str, new_rate: float) -> SupplierResponse | None:
        raw = self._get_raw(supplier_id)
        if raw is None:
            return None
        raw["monthly_rate"] = new_rate
        raw["updated_at"] = _utcnow_iso()
        self._db.update(raw, doc_ids=[raw.doc_id])
        return build_response_from_tinydb(raw)

    def update_status(self, supplier_id: str, new_status: str) -> SupplierResponse | None:
        raw = self._get_raw(supplier_id)
        if raw is None:
            return None
        raw["status"] = new_status
        self._db.update(raw, doc_ids=[raw.doc_id])
        return build_response_from_tinydb(raw)

    def delete(self, supplier_id: str) -> bool:
        raw = self._get_raw(supplier_id)
        if raw is None:
            return False
        self._db.remove(doc_ids=[raw.doc_id])
        return True

    # ---- filtering ----

    def filter(
        self,
        country: str | None = None,
        category: str | None = None,
    ) -> list[SupplierResponse]:
        results = self._all_raw()
        if country:
            results = [d for d in results if d.get("country") == country]
        if category:
            results = [d for d in results if category in d.get("categories", [])]
        return [build_response_from_tinydb(d) for d in results]

    # ---- seeding ----

    def count(self) -> int:
        return len(self._db)

    def contains_name(self, name: str) -> bool:
        Supplier = Query()
        return self._db.contains(Supplier.name == name)

    def insert_raw(self, doc: dict[str, Any]) -> None:
        self._db.insert(doc)

    # ---- lifecycle ----

    def close(self) -> None:
        self._db.close()