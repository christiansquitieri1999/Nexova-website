#!/usr/bin/env python3
"""Analyze Nexova support-ticket CSV files without exposing customer data."""

from __future__ import annotations

import argparse
import csv
import io
import sys
from collections import Counter
from pathlib import Path
from typing import Any, TextIO


EXPECTED_FIELDS = (
    "ticket_id",
    "date",
    "client_company",
    "category",
    "description",
    "agent_id",
    "status",
    "customer_email",
    "satisfaction_score",
)
VALID_CATEGORIES = ("TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT")
VALID_STATUSES = ("OPEN", "CLOSED", "DISCARDED")
INVALID_RULE_LABELS = {
    "missing_client_company": "Missing client_company",
    "invalid_category": "Invalid or missing category",
    "invalid_description": "Invalid or missing description",
    "invalid_agent_id": "Invalid or missing agent_id",
    "invalid_email": "Invalid or missing email",
    "closed_without_score": "Closed ticket, no score",
    "score_out_of_range": "Satisfaction score out of range",
}
SCORE_LABELS = {
    1: "Very dissatisfied",
    2: "Dissatisfied",
    3: "Neutral",
    4: "Satisfied",
    5: "Very satisfied",
}


class AnalysisError(ValueError):
    """Raised when a CSV cannot be analyzed safely."""


def _parse_score(value: str) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _invalid_rules(row: dict[str, str]) -> list[str]:
    rules: list[str] = []
    company = row["client_company"].strip()
    category = row["category"].strip().upper()
    description = row["description"].strip()
    agent_id = row["agent_id"].strip()
    status = row["status"].strip().upper()
    email = row["customer_email"].strip()
    score_text = row["satisfaction_score"].strip()

    if not company:
        rules.append("missing_client_company")
    if category not in VALID_CATEGORIES:
        rules.append("invalid_category")
    if len(description) < 5:
        rules.append("invalid_description")
    if len(agent_id) != 6 or not agent_id.startswith("AGT-") or not agent_id[4:].isdigit():
        rules.append("invalid_agent_id")
    if not email or "@" not in email:
        rules.append("invalid_email")
    if status == "CLOSED" and not score_text:
        rules.append("closed_without_score")
    if score_text:
        score = _parse_score(score_text)
        if score is None or score < 1 or score > 5:
            rules.append("score_out_of_range")

    return rules


def analyze_stream(stream: TextIO, source_file: str = "uploaded.csv") -> dict[str, Any]:
    """Return aggregate ticket metrics. Raw row values are never returned."""
    reader = csv.DictReader(stream)
    if reader.fieldnames is None:
        raise AnalysisError("The CSV file is empty or missing its header row.")

    normalized_fields = tuple((field or "").strip() for field in reader.fieldnames)
    if normalized_fields != EXPECTED_FIELDS:
        missing = [field for field in EXPECTED_FIELDS if field not in normalized_fields]
        raise AnalysisError(
            "The CSV header is invalid."
            + (f" Missing columns: {', '.join(missing)}." if missing else "")
        )

    category_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()
    score_counts: Counter[int] = Counter()
    invalid_counts: Counter[str] = Counter()
    total_records = 0
    valid_records = 0
    closed_records = 0

    for values in reader:
        if None in values:
            raise AnalysisError("At least one CSV row contains more fields than the header.")

        row = {field: (values.get(field) or "").strip() for field in EXPECTED_FIELDS}
        if not any(row.values()):
            continue

        total_records += 1
        rules = _invalid_rules(row)
        if rules:
            invalid_counts.update(rules)
            continue

        valid_records += 1
        category_counts[row["category"].upper()] += 1
        status_counts[row["status"].upper()] += 1

        if row["status"].upper() == "CLOSED":
            closed_records += 1
            score = _parse_score(row["satisfaction_score"])
            if score is not None:
                score_counts[score] += 1

    scored_tickets = sum(score_counts.values())
    total_score = sum(score * count for score, count in score_counts.items())
    average_score = round(total_score / scored_tickets, 2) if scored_tickets else 0.0

    categories = {category: category_counts.get(category, 0) for category in VALID_CATEGORIES}
    statuses = {status: status_counts.get(status, 0) for status in VALID_STATUSES}
    invalid_breakdown = {
        rule: invalid_counts.get(rule, 0) for rule in INVALID_RULE_LABELS
    }

    return {
        "source_file": Path(source_file).name,
        "total_records": total_records,
        "valid_records": valid_records,
        "invalid_records": total_records - valid_records,
        "invalid_breakdown": invalid_breakdown,
        "categories": categories,
        "statuses": statuses,
        "category_percentages": _percentages(categories, valid_records),
        "status_percentages": _percentages(statuses, valid_records),
        "satisfaction": {
            "closed_records": closed_records,
            "scored_tickets": scored_tickets,
            "average_score": average_score,
            "score_counts": {str(score): score_counts.get(score, 0) for score in range(1, 6)},
        },
    }


def _percentages(counts: dict[str, int], total: int) -> dict[str, float]:
    if total == 0:
        return {key: 0.0 for key in counts}
    return {key: round(count / total * 100, 1) for key, count in counts.items()}


def analyze_text(csv_text: str, source_file: str = "uploaded.csv") -> dict[str, Any]:
    if not isinstance(csv_text, str):
        raise AnalysisError("CSV content must be text.")
    return analyze_stream(io.StringIO(csv_text, newline=""), source_file)


def format_report(result: dict[str, Any]) -> str:
    valid = result["valid_records"]
    lines = [
        "=" * 60,
        "  NEXOVA - SUPPORT TICKET ANALYSIS",
        f"  Source file: {result['source_file']}",
        "=" * 60,
        "",
        f"TOTAL RECORDS IN FILE .......... {result['total_records']}",
        f"  |- Valid records ................ {valid}",
        f"  `- Invalid / incomplete .......... {result['invalid_records']}",
        "",
        "INVALID RECORDS BREAKDOWN",
    ]

    displayed_rules = (
        "missing_client_company",
        "invalid_category",
        "invalid_email",
        "closed_without_score",
    )
    for rule in displayed_rules:
        lines.append(f"  |- {INVALID_RULE_LABELS[rule]} ........ {result['invalid_breakdown'][rule]}")
    for rule in ("invalid_description", "invalid_agent_id", "score_out_of_range"):
        count = result["invalid_breakdown"][rule]
        if count:
            lines.append(f"  |- {INVALID_RULE_LABELS[rule]} ........ {count}")

    lines.extend(("", "BREAKDOWN BY CATEGORY (valid records)"))
    for category in VALID_CATEGORIES:
        lines.append(
            f"  |- {category} .................... "
            f"{result['categories'][category]}  ({result['category_percentages'][category]:.1f}%)"
        )

    lines.extend(("", "BREAKDOWN BY STATUS (valid records)"))
    for status in VALID_STATUSES:
        lines.append(
            f"  |- {status} ......................... "
            f"{result['statuses'][status]}  ({result['status_percentages'][status]:.1f}%)"
        )

    satisfaction = result["satisfaction"]
    lines.extend(
        (
            "",
            "SATISFACTION INDEX (closed tickets)",
            f"  Scored tickets: {satisfaction['scored_tickets']} of {satisfaction['closed_records']}",
            f"  Average score: {satisfaction['average_score']:.2f} / 5.00",
        )
    )
    for score in range(1, 6):
        lines.append(
            f"  |- Score {score} ({SCORE_LABELS[score]}) ... "
            f"{satisfaction['score_counts'][str(score)]}"
        )
    lines.extend(("", "=" * 60))
    return "\n".join(lines)


def format_metrics_csv(result: dict[str, Any]) -> str:
    """Serialize only aggregate metrics to a two-column CSV."""
    rows: list[tuple[str, int | float]] = [
        ("total_records", result["total_records"]),
        ("valid_records", result["valid_records"]),
        ("invalid_records", result["invalid_records"]),
    ]
    rows.extend(
        (f"invalid_{rule}", count)
        for rule, count in result["invalid_breakdown"].items()
    )
    rows.extend((f"category_{key}", value) for key, value in result["categories"].items())
    rows.extend((f"status_{key}", value) for key, value in result["statuses"].items())
    rows.extend(
        (
            ("satisfaction_closed_records", result["satisfaction"]["closed_records"]),
            ("satisfaction_scored_tickets", result["satisfaction"]["scored_tickets"]),
            ("satisfaction_average", result["satisfaction"]["average_score"]),
        )
    )
    rows.extend(
        (f"satisfaction_score_{score}", count)
        for score, count in result["satisfaction"]["score_counts"].items()
    )

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(("metric", "value"))
    writer.writerows(rows)
    return output.getvalue()


def export_metrics(result: dict[str, Any], destination: Path) -> None:
    """Write only aggregate metrics to a two-column CSV."""
    destination.write_text(format_metrics_csv(result), encoding="utf-8", newline="")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="Path to the Nexova incidents CSV")
    export_group = parser.add_mutually_exclusive_group()
    export_group.add_argument("--export", type=Path, help="Write aggregate metrics to this CSV path")
    export_group.add_argument(
        "--no-export", action="store_true", help="Do not ask whether to export results"
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        with args.csv_file.open("r", encoding="utf-8-sig", newline="") as source:
            result = analyze_stream(source, args.csv_file.name)
    except (OSError, UnicodeError):
        print("Unable to read the CSV. Check that it exists and is readable.", file=sys.stderr)
        return 1
    except AnalysisError as error:
        message = str(error).replace(str(args.csv_file), "the selected CSV")
        print(f"Unable to analyze CSV: {message}", file=sys.stderr)
        return 2

    print(format_report(result))
    export_path = args.export
    if export_path is None and not args.no_export:
        try:
            should_export = input("Export results to CSV? [y / n]: ").strip().lower()
        except EOFError:
            should_export = "n"
        if should_export in {"y", "yes"}:
            export_path = args.csv_file.with_name(f"{args.csv_file.stem}-analysis.csv")

    if export_path is not None:
        try:
            export_metrics(result, export_path)
        except OSError:
            print("Unable to export the aggregate metrics CSV.", file=sys.stderr)
            return 3
        print("Aggregate metrics exported successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
