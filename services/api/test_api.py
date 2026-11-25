import unittest
from email.message import Message

from api import (
    ALLOWED_ORIGIN,
    AnalysisError,
    IncidentApiHandler,
    IncidentApiServer,
    analyze_multipart,
)


class IncidentApiTests(unittest.TestCase):
    def test_cors_rejects_unconfigured_browser_origins(self) -> None:
        handler = object.__new__(IncidentApiHandler)
        handler.headers = Message()
        handler.headers["Origin"] = "https://untrusted.example"
        self.assertFalse(handler._is_origin_allowed())

        handler.headers.replace_header("Origin", ALLOWED_ORIGIN)
        self.assertTrue(handler._is_origin_allowed())

        del handler.headers["Origin"]
        self.assertTrue(handler._is_origin_allowed())

    def test_server_retains_and_copies_last_analysis(self) -> None:
        server = IncidentApiServer(("127.0.0.1", 0))
        self.addCleanup(server.server_close)
        result = {"source_file": "tickets.csv", "total_records": 1}

        server.set_last_result(result)
        result["total_records"] = 99
        retrieved = server.get_last_result()
        self.assertEqual(retrieved, {"source_file": "tickets.csv", "total_records": 1})
        self.assertIsNot(retrieved, server.get_last_result())

    def test_multipart_csv_uses_same_analysis_contract(self) -> None:
        boundary = "nexova-test-boundary"
        csv_bytes = (
            b"ticket_id,date,client_company,category,description,agent_id,status,"
            b"customer_email,satisfaction_score\r\n"
            b"NXV-1,2024-01-01,Client,ACCESS,Login issue,AGT-01,CLOSED,"
            b"private@example.test,5\r\n"
        )
        body = (
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="file"; filename="tickets.csv"\r\n'  # noqa: E501
                "Content-Type: text/csv\r\n\r\n"
            ).encode()
            + csv_bytes
            + f"\r\n--{boundary}--\r\n".encode()
        )

        result = analyze_multipart(f"multipart/form-data; boundary={boundary}", body)

        self.assertEqual(result["valid_records"], 1)
        self.assertEqual(result["source_file"], "tickets.csv")
        self.assertEqual(result["categories"]["ACCESS"], 1)
        self.assertEqual(result["satisfaction"]["average_score"], 5.0)
        self.assertNotIn("private@example.test", repr(result))

    def test_multipart_rejects_missing_file_field(self) -> None:
        boundary = "nexova-test-boundary"
        body = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="other"\r\n\r\n'
            f"value\r\n--{boundary}--\r\n"
        ).encode()

        with self.assertRaisesRegex(AnalysisError, "file field"):
            analyze_multipart(f"multipart/form-data; boundary={boundary}", body)

    def test_multipart_rejects_non_csv_and_empty_files(self) -> None:
        boundary = "nexova-test-boundary"
        for filename, file_bytes in (("tickets.txt", b"value"), ("tickets.csv", b"")):
            with self.subTest(filename=filename):
                body = (
                    (
                        f"--{boundary}\r\n"
                        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'  # noqa: E501
                        "Content-Type: text/csv\r\n\r\n"
                    ).encode()
                    + file_bytes
                    + f"\r\n--{boundary}--\r\n".encode()
                )
                with self.assertRaises(AnalysisError):
                    analyze_multipart(f"multipart/form-data; boundary={boundary}", body)


if __name__ == "__main__":
    unittest.main()
