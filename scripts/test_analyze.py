import io
import tempfile
import unittest
from pathlib import Path

from analyze import (
    AnalysisError,
    analyze_stream,
    analyze_text,
    export_metrics,
    format_metrics_csv,
)


FIXTURE = Path(__file__).resolve().parents[1] / "info-nexova" / "incidents-nexova.csv"


class IncidentAnalysisTests(unittest.TestCase):
    def test_provided_file_matches_expected_distribution(self) -> None:
        with FIXTURE.open("r", encoding="utf-8", newline="") as source:
            result = analyze_stream(source, FIXTURE.name)

        self.assertEqual(result["total_records"], 100)
        self.assertEqual(result["valid_records"], 96)
        self.assertEqual(result["invalid_records"], 4)
        self.assertEqual(
            result["invalid_breakdown"],
            {
                "missing_client_company": 1,
                "invalid_category": 1,
                "invalid_description": 0,
                "invalid_agent_id": 0,
                "invalid_email": 1,
                "closed_without_score": 1,
                "score_out_of_range": 0,
            },
        )
        self.assertEqual(
            result["categories"],
            {"TECHNICAL": 28, "BILLING": 18, "ACCESS": 21, "HR_QUERY": 17, "COMPLAINT": 12},
        )
        self.assertEqual(result["statuses"], {"OPEN": 27, "CLOSED": 56, "DISCARDED": 13})
        self.assertEqual(result["satisfaction"]["average_score"], 3.84)
        self.assertEqual(
            result["satisfaction"]["score_counts"],
            {"1": 2, "2": 5, "3": 10, "4": 22, "5": 17},
        )

    def test_empty_csv_data_returns_zero_safe_aggregates(self) -> None:
        result = analyze_text(
            "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
        )

        self.assertEqual(result["total_records"], 0)
        self.assertEqual(result["valid_records"], 0)
        self.assertEqual(result["category_percentages"]["ACCESS"], 0.0)
        self.assertEqual(result["satisfaction"]["average_score"], 0.0)

    def test_invalid_values_are_counted_without_returning_source_data(self) -> None:
        csv_text = (
            "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
            "NXV-1,2024-01-01,,UNKNOWN,no,broken,CLOSED,private@example.test,9\n"
        )
        result = analyze_text(csv_text)

        self.assertEqual(result["valid_records"], 0)
        self.assertEqual(result["invalid_records"], 1)
        self.assertEqual(result["invalid_breakdown"]["invalid_category"], 1)
        self.assertEqual(result["invalid_breakdown"]["score_out_of_range"], 1)
        self.assertNotIn("private@example.test", repr(result))

    def test_missing_header_columns_are_rejected(self) -> None:
        with self.assertRaises(AnalysisError):
            analyze_text("ticket_id,status\nNXV-1,OPEN\n")

    def test_export_contains_only_aggregate_metrics(self) -> None:
        result = analyze_text(
            "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
            "NXV-1,2024-01-01,Client,ACCESS,Login issue,AGT-01,CLOSED,private@example.test,5\n"
        )

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "metrics.csv"
            export_metrics(result, destination)
            exported = destination.read_text(encoding="utf-8")

        self.assertIn("metric,value", exported)
        self.assertIn("valid_records,1", exported)
        self.assertNotIn("private@example.test", exported)
        self.assertEqual(exported, format_metrics_csv(result))


if __name__ == "__main__":
    unittest.main()
