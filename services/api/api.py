#!/usr/bin/env python3
"""Local HTTP API for privacy-safe Nexova incident analysis."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import threading
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIRECTORY = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIRECTORY))

from analyze import AnalysisError, analyze_text, format_metrics_csv  # noqa: E402


MAX_BODY_BYTES = 5 * 1024 * 1024
ALLOWED_ORIGIN = os.environ.get("NEXOVA_CORS_ORIGIN", "http://localhost:3000").rstrip(
    "/"
)


def analyze_multipart(content_type: str, body: bytes) -> dict[str, Any]:
    """Extract one CSV file from multipart/form-data and analyze it."""
    if not content_type.lower().startswith("multipart/form-data;"):
        raise AnalysisError("Content-Type must be multipart/form-data.")

    message = BytesParser(policy=policy.default).parsebytes(
        b"Content-Type: "
        + content_type.encode("ascii", errors="strict")
        + b"\r\nMIME-Version: 1.0\r\n\r\n"
        + body
    )
    if not message.is_multipart():
        raise AnalysisError("The multipart request body is invalid.")

    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != "file":
            continue

        filename = part.get_filename()
        if not filename:
            raise AnalysisError("The file field must include a CSV filename.")
        if not filename.lower().endswith(".csv"):
            raise AnalysisError("The uploaded file must have a .csv extension.")

        file_bytes = part.get_payload(decode=True)
        if not file_bytes:
            raise AnalysisError("The uploaded CSV file is empty.")
        try:
            csv_text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise AnalysisError("The uploaded CSV must use UTF-8 encoding.") from error
        return analyze_text(csv_text, Path(filename).name)

    raise AnalysisError("The multipart form must contain a file field.")


class IncidentApiHandler(BaseHTTPRequestHandler):
    server_version = "NexovaIncidentApi/1.0"

    def _is_origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or origin.rstrip("/") == ALLOWED_ORIGIN

    def _allow_origin_header(self) -> None:
        origin = self.headers.get("Origin")
        if origin is not None and origin.rstrip("/") == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
            self.send_header("Vary", "Origin")

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self._allow_origin_header()
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(encoded)

    def _send_html(self, status: int, title: str, message: str) -> None:
        encoded = (
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f"<title>{html.escape(title)}</title></head><body><main>"
            f"<h1>{html.escape(title)}</h1><p>{html.escape(message)}</p>"
            "</main></body></html>"
        ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("X-Error-Message", message)
        self._allow_origin_header()
        self.send_header("Access-Control-Expose-Headers", "X-Error-Message")
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:
        if not self._is_origin_allowed():
            self._send_html(
                403, "Origin not allowed", "This origin is not allowed to use the API."
            )
            return
        self._send_json(204, {})

    def do_GET(self) -> None:
        if not self._is_origin_allowed():
            self._send_html(
                403, "Origin not allowed", "This origin is not allowed to use the API."
            )
            return
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "service": "nexova-incidents-api"})
            return
        if self.path == "/api/incidents/results/exports":
            server = self.server
            if not isinstance(server, IncidentApiServer):
                self._send_html(
                    500, "Service unavailable", "Analysis storage is unavailable."
                )
                return
            result = server.get_last_result()
            if result is None:
                self._send_html(
                    404,
                    "No analysis available",
                    "Analyze a CSV file before downloading the results.",
                )
                return
            csv_text = format_metrics_csv(result)
            safe_stem = re.sub(
                r"[^A-Za-z0-9_-]+", "-", Path(result["source_file"]).stem
            ).strip("-")
            filename = f"{safe_stem or 'incidents'}-analysis.csv"
            encoded = csv_text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header(
                "Content-Disposition", f'attachment; filename="{filename}"'
            )
            self.send_header("Content-Length", str(len(encoded)))
            self._allow_origin_header()
            self.end_headers()
            self.wfile.write(encoded)
            return
        self._send_html(
            404, "Endpoint not found", "The requested endpoint does not exist."
        )

    def do_POST(self) -> None:
        if not self._is_origin_allowed():
            self._send_html(
                403, "Origin not allowed", "This origin is not allowed to use the API."
            )
            return
        if self.path != "/api/incidents/analyze":
            self._send_html(
                404, "Endpoint not found", "The requested endpoint does not exist."
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_html(
                400, "Invalid request", "The Content-Length header is invalid."
            )
            return
        if content_length <= 0:
            self._send_html(400, "Empty upload", "The request body is required.")
            return
        if content_length > MAX_BODY_BYTES:
            self._send_html(413, "Upload too large", "CSV uploads cannot exceed 5 MB.")
            return

        try:
            raw_body = self.rfile.read(content_length)
            result = analyze_multipart(self.headers.get("Content-Type", ""), raw_body)
        except AnalysisError as error:
            status = (
                415
                if "Content-Type" in str(error) or ".csv extension" in str(error)
                else 422
            )
            self._send_html(status, "Invalid CSV upload", str(error))
            return
        except (UnicodeError, ValueError):
            self._send_html(400, "Invalid request", "Multipart form data is invalid.")
            return

        server = self.server
        if not isinstance(server, IncidentApiServer):
            self._send_html(
                500, "Service unavailable", "Analysis storage is unavailable."
            )
            return
        server.set_last_result(result)
        self._send_json(200, result)

    def log_message(self, format: str, *args: object) -> None:
        return


class IncidentApiServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int]) -> None:
        super().__init__(server_address, IncidentApiHandler)
        self._last_result: dict[str, Any] | None = None
        self._result_lock = threading.Lock()

    def set_last_result(self, result: dict[str, Any]) -> None:
        with self._result_lock:
            self._last_result = json.loads(json.dumps(result))

    def get_last_result(self) -> dict[str, Any] | None:
        with self._result_lock:
            if self._last_result is None:
                return None
            return json.loads(json.dumps(self._last_result))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = IncidentApiServer((args.host, args.port))
    print(f"Nexova incidents API listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Nexova incidents API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
