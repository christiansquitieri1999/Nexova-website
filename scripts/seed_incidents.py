#!/usr/bin/env python3
"""Seed the incident manager database from the historical CSV file.

Reads ``info-nexova/incidents-nexova.csv``, validates each row using the
shared CSV validation rules, transforms CSV columns into the incident model
fields (see the BRIEFING mapping table), and inserts validated records into
the TinyDB incidents store.

Idempotent: uses ``ticket_id`` from the CSV as a deduplication key.  Running
the script twice will not create duplicate records.

Usage::

    uv run python scripts/seed_incidents.py

Or from the services/api directory::

    python -m scripts.seed_incidents
"""

from __future__ import annotations

import csv
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Ensure shared package is on sys.path ───────────────────────────────────
_HERE = Path(__file__).resolve().parent
_PROJECT_ROOT = _HERE.parent
_SHARED_PY = _PROJECT_ROOT / "packages" / "shared" / "python"
_API_DIR = _PROJECT_ROOT / "services" / "api"

for _p in (_SHARED_PY, _API_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from csv_validator import (
    CATEGORY_MAP,
    STATUS_MAP,
    CSV_INVALID_LABELS,
    EXPECTED_CSV_FIELDS,
    is_valid_csv_row,
    validate_csv_row,
)
from incident_models import (
    IncidentBranch,
    IncidentOrigin,
    IncidentSeed,
    build_incident_seed_doc,
)

# ── Paths (canonical locations) ─────────────────────────────────────────────

CSV_PATH = _PROJECT_ROOT / "info-nexova" / "incidents-nexova.csv"
DB_DIR = _API_DIR / "db"
DB_PATH = DB_DIR / "incidents.json"
TICKET_ID_INDEX_PATH = DB_DIR / "incidents_ticket_ids.txt"


# ── Helpers ─────────────────────────────────────────────────────────────────


def _parse_date(date_str: str) -> datetime:
    """Parse a ``YYYY-MM-DD`` string into an aware midnight-UTC datetime."""
    parts = date_str.strip().split("-")
    if len(parts) != 3:
        raise ValueError(f"Cannot parse date: {date_str!r}")
    return datetime(int(parts[0]), int(parts[1]), int(parts[2]), tzinfo=timezone.utc)


def _transform_row(row: dict[str, str]) -> dict[str, Any]:
    """Convert a validated CSV row into an ``IncidentSeed``-compatible dict."""
    csv_category = row["category"].strip().upper()
    csv_status = row["status"].strip().upper()
    description_raw = row["description"].strip()

    return {
        "title": description_raw[:120],
        "description": description_raw,
        "category": CATEGORY_MAP[csv_category],
        "origin": IncidentOrigin.CUSTOMER.value,
        "branch": IncidentBranch.CENTRAL.value,
        "status": STATUS_MAP[csv_status],
        "created_at": _parse_date(row["date"]),
    }


# ── Seed logic ──────────────────────────────────────────────────────────────


def _read_ticket_ids() -> set[str]:
    """Return the set of ticket_ids that have already been seeded.

    Reads from a sidecar text file (one ticket_id per line) to avoid coupling
    the seed script to TinyDB.
    """
    if TICKET_ID_INDEX_PATH.is_file():
        try:
            raw = TICKET_ID_INDEX_PATH.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError) as exc:
            raise RuntimeError("Unable to read the seeded-ticket index.") from exc
        return set(raw.splitlines()) if raw else set()
    return set()


def _append_ticket_ids(ticket_ids: list[str]) -> None:
    """Append newly seeded ticket_ids to the index file."""
    try:
        DB_DIR.mkdir(parents=True, exist_ok=True)
        with TICKET_ID_INDEX_PATH.open("a", encoding="utf-8") as fh:
            for tid in ticket_ids:
                fh.write(tid + "\n")
    except (OSError, UnicodeError) as exc:
        raise RuntimeError("Unable to update the seeded-ticket index.") from exc


def _load_tinydb():
    """Lazy TinyDB import to keep the import fast when only help is needed."""
    from tinydb import TinyDB, Query

    try:
        DB_DIR.mkdir(parents=True, exist_ok=True)
        db = TinyDB(DB_PATH)
        return db, Query()
    except (OSError, ValueError) as exc:
        raise RuntimeError("Unable to open the incident database.") from exc


def seed() -> int:
    """Read the CSV, transform, validate, and insert records.

    Returns the number of new records inserted.
    Returns -1 if the CSV file cannot be read.
    """
    # ── 1. Read CSV ─────────────────────────────────────────────────────
    try:
        with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                print("[FAIL] The CSV file is empty or missing its header row.", file=sys.stderr)
                return -1

            normalized = tuple((f or "").strip() for f in reader.fieldnames)
            if normalized != EXPECTED_CSV_FIELDS:
                missing = [f for f in EXPECTED_CSV_FIELDS if f not in normalized]
                print(
                    f"[FAIL] CSV header mismatch. Missing columns: {', '.join(missing)}.",
                    file=sys.stderr,
                )
                return -1

            rows = list(reader)
    except (OSError, UnicodeError):
        print(
            "[FAIL] Unable to read the incident CSV. Check that it exists and is readable.",
            file=sys.stderr,
        )
        return -1

    total = len(rows)
    print(f"[INFO] Read {total} row(s) from {CSV_PATH.name}.")

    # ── 2. CSV-level validation ──────────────────────────────────────────
    valid_rows: list[dict[str, str]] = []
    csv_invalid_counts: Counter[str] = Counter()

    for row in rows:
        # Normalise
        clean = {k: (v or "").strip() for k, v in row.items()}
        if not any(clean.values()):
            continue  # skip completely empty rows

        if is_valid_csv_row(clean):
            valid_rows.append(clean)
        else:
            csv_invalid_counts.update(validate_csv_row(clean))

    csv_invalid_total = total - len(valid_rows)

    # ── 3. CSV → Model transformation + Pydantic validation ─────────────
    db_docs: list[dict[str, Any]] = []
    ticket_ids: list[str] = []
    model_invalid_count = 0

    for row in valid_rows:
        try:
            seed_data = _transform_row(row)
            seed_model = IncidentSeed.model_validate(seed_data)
            doc = build_incident_seed_doc(seed_model)
            db_docs.append(doc)
            ticket_ids.append(row["ticket_id"])
        except (TypeError, ValueError):
            model_invalid_count += 1

    print(f"[INFO] CSV-valid rows: {len(valid_rows)}  |  "
          f"Model-valid: {len(db_docs)}  |  "
          f"Model-invalid: {model_invalid_count}")

    # ── 4. Idempotent insert ─────────────────────────────────────────────
    try:
        already_seen = _read_ticket_ids()
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return -1
    new_docs: list[dict[str, Any]] = []
    new_ticket_ids: list[str] = []

    db = None
    try:
        if db_docs:
            db, Record = _load_tinydb()

            for doc, tid in zip(db_docs, ticket_ids):
                if tid in already_seen:
                    continue

                existing = db.search(
                    (Record.title == doc["title"])
                    & (Record.created_at == doc["created_at"])
                    & (Record.origin == doc["origin"])
                    & (Record.branch == doc["branch"])
                )
                if existing:
                    continue

                new_docs.append(doc)
                new_ticket_ids.append(tid)
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return -1
    except (OSError, ValueError):
        print("[FAIL] Unable to search the incident database.", file=sys.stderr)
        return -1
    finally:
        if db is not None:
            try:
                db.close()
            except OSError:
                print("[FAIL] Unable to close the incident database.", file=sys.stderr)
                return -1

    if not new_docs:
        print("[OK] All records already seeded — no new inserts.")
        return 0

    # Insert into TinyDB
    try:
        db, _ = _load_tinydb()
        db.insert_multiple(new_docs)
        db.close()
    except (RuntimeError, OSError, ValueError):
        print("[FAIL] Unable to insert incidents into the database.", file=sys.stderr)
        return -1

    # Persist the ticket_id index
    try:
        _append_ticket_ids(new_ticket_ids)
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return -1

    inserted = len(new_docs)
    print(f"[OK] Inserted {inserted} new incident record(s) into the database.")
    return inserted


# ── Report ──────────────────────────────────────────────────────────────────


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__.partition("Usage")[0])
    parser.add_argument(
        "--report-invalid",
        action="store_true",
        help="Print a detailed breakdown of invalid and duplicate records",
    )
    args = parser.parse_args()

    inserted = seed()

    if inserted == -1:
        raise SystemExit(1)

    # Invalid historical records must always be visible to operators.
    print_detailed_report()

    raise SystemExit(0)


def print_detailed_report() -> None:
    """Re-read the CSV and print a validation report (informational)."""
    try:
        with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            rows = list(reader)
    except (OSError, UnicodeError):
        print("  Cannot read the incident CSV for the report.")
        return

    from csv_validator import validate_csv_row

    total = len(rows)
    violations: Counter[str] = Counter()
    valid_count = 0

    for row in rows:
        clean = {k: (v or "").strip() for k, v in row.items()}
        if not any(clean.values()):
            continue
        rules = validate_csv_row(clean)
        if not rules:
            valid_count += 1
        else:
            violations.update(rules)

    invalid_count = total - valid_count - sum(
        1 for r in rows if not any((r.get(k) or "").strip() for k in r)
    )

    print()
    print("=" * 58)
    print("  SEED VALIDATION REPORT")
    print("=" * 58)
    print(f"  Total rows read:      {total}")
    print(f"  CSV-valid:            {valid_count}")
    print(f"  CSV-invalid:          {invalid_count}")
    print()
    if violations:
        print("  Rule violations (count):")
        for rule in CSV_INVALID_LABELS:
            count = violations.get(rule, 0)
            if count:
                print(f"    {CSV_INVALID_LABELS[rule]:.<40s} {count}")

    invalid_rows = []
    for row_number, row in enumerate(rows, start=2):
        clean = {k: (v or "").strip() for k, v in row.items()}
        if not any(clean.values()):
            continue
        rules = validate_csv_row(clean)
        if rules:
            labels = [CSV_INVALID_LABELS.get(rule, rule) for rule in rules]
            invalid_rows.append((row_number, clean.get("ticket_id", ""), labels))

    if invalid_rows:
        print()
        print("  Invalid rows:")
        for row_number, ticket_id, labels in invalid_rows:
            ticket = ticket_id or "(no ticket_id)"
            print(f"    Row {row_number} [{ticket}]: {', '.join(labels)}")
    print()

    # Model validation pass
    from csv_validator import is_valid_csv_row

    model_ok = 0
    model_fail = 0
    for row in rows:
        clean = {k: (v or "").strip() for k, v in row.items()}
        if not any(clean.values()):
            continue
        if not is_valid_csv_row(clean):
            continue
        try:
            seed_data = _transform_row(clean)
            _ = IncidentSeed.model_validate(seed_data)
            model_ok += 1
        except (TypeError, ValueError):
            model_fail += 1

    already_seen = _read_ticket_ids()
    duplicate_count = sum(
        1
        for row in rows
        if (row.get("ticket_id") or "").strip() in already_seen
    )

    print(f"  Model-valid:          {model_ok}")
    print(f"  Model-invalid:        {model_fail}")
    print(f"  Duplicate-skipped:    {duplicate_count}")
    print("=" * 58)


if __name__ == "__main__":
    main()