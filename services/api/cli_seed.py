#!/usr/bin/env python3
"""Seed the TinyDB database with the initial 15 suppliers from the Nexova briefing.

Usage:
    uv run seed
"""

from __future__ import annotations

import sys
from pathlib import Path
from tinydb import TinyDB, Query


def _supplier_models():
    """Lazy import supplier_models after ensuring the package is on sys.path."""
    # Ensure the services/api directory is on sys.path so we can import
    # the supplier_models module.
    _HERE = Path(__file__).resolve().parent
    if str(_HERE) not in sys.path:
        sys.path.insert(0, str(_HERE))

    from supplier_models import SUPPLIERS_SEED, SupplierCreate, build_create_doc

    return SUPPLIERS_SEED, SupplierCreate, build_create_doc


def _db_path() -> str:
    """Return the path to the TinyDB JSON file."""
    return str(Path(__file__).resolve().parent / "db" / "suppliers.json")


def seed() -> int:
    """Insert seed suppliers that are not already in the database.

    Returns the number of new records inserted.
    """
    db_path = _db_path()
    # Ensure the db directory exists
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    SUPPLIERS_SEED, SupplierCreate, build_create_doc = _supplier_models()

    db = TinyDB(db_path)
    Supplier = Query()
    inserted = 0

    for raw in SUPPLIERS_SEED:
        # Validate via Pydantic
        create = SupplierCreate.model_validate(raw)
        doc = build_create_doc(create)

        # Duplicate check: match on name (unique identifier for seeding)
        if db.contains(Supplier.name == doc["name"]):
            continue

        db.insert(doc)
        inserted += 1

    db.close()
    return inserted


def main() -> None:
    count = seed()
    if count:
        print(f"[OK] Seeded {count} supplier(s) into the database.")
    else:
        print("[OK] Database already up to date -- no new records inserted.")


if __name__ == "__main__":
    main()
