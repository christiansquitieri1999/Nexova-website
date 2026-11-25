# `scripts` folder

This folder contains **helper scripts** for the monorepo: development automation, maintenance utilities, repetitive tasks (setup, lint, migrations, data generation, etc.), and internal tooling.

- **Main purpose**: group support tools that do not belong to a specific app, agent, or pipeline but make the team’s work easier.
- **Recommendation**: document each script (what it does, parameters, requirements, usage examples) and keep them reproducible (and safe) across environments.

## Incident analysis

- `analyze.py` validates and summarizes support-ticket CSV files without returning customer email addresses.
- `incidents-nexova.csv` is the provided 100-record acceptance-test dataset.
- Run `python scripts/analyze.py scripts/incidents-nexova.csv`.
- Use `--no-export` to skip the export prompt or `--export output.csv` to write aggregate metrics.
- Run `python -m unittest discover -s scripts -p "test_*.py"` to verify validation and expected counts.

> _Spanish version: [README.es.md](./README.es.md)._
