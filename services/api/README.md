# Nexova incidents API

Local Python standard-library service that analyzes Nexova support-ticket CSV files using the
privacy-safe rules in [`scripts/analyze.py`](../../scripts/analyze.py). It returns aggregate metrics
only: customer email addresses and source rows are never included in responses or logs.

## Run

Python 3.11 or newer is recommended. From the repository root:

```bash
python services/api/api.py
```

The service listens on `http://127.0.0.1:8000`.

CORS is restricted to `http://localhost:3000`. Set `NEXOVA_CORS_ORIGIN` before starting the service
when the backoffice uses another origin:

```bash
NEXOVA_CORS_ORIGIN=https://backoffice.example.com python services/api/api.py
```

## Endpoints

### `GET /health`

Returns service availability.

### `POST /api/incidents/analyze`

Accepts a UTF-8 CSV file in `multipart/form-data`. The file part must be named `file`:

```bash
curl -F "file=@incidents-nexova.csv" http://127.0.0.1:8000/api/incidents/analyze
```

The body limit is 5 MB. A successful response contains totals, invalid-rule counts, category and
status counts, percentages, and satisfaction-score aggregates. Invalid requests return `4xx` HTML
responses with a descriptive message and without echoing CSV content. Missing files and invalid
CSV content return `422`; unsupported file types or request content types return `415`.

### `GET /api/incidents/results/exports`

Downloads the most recent successful analysis as a two-column CSV using
`Content-Disposition: attachment`. The in-memory result is replaced by each successful analysis and
is cleared when the service restarts. Before any successful analysis, the endpoint returns a
descriptive `404` HTML response.

```bash
curl -OJ http://127.0.0.1:8000/api/incidents/results/exports
```

## Verify

```bash
python -m unittest discover -s services/api -p "test_*.py"
```
