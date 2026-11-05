# `services` folder

This folder contains backend services (APIs and background workers) related to the company project.

Each implementation subfolder must correspond to one service and include its technical and functional documentation. External API integrations may also be documented here, but the documentation must make clear whether an implementation is hosted locally or is an external dependency.

- **Main purpose**: centralize backend logic, APIs, and queue consumers that support company use cases.
- **Recommendation**: document each service's objective, technology, and run instructions in this file or its sub-README.

## External integrations

- `talent-pipeline-api/` documents the external API used by `uis/backoffice`. The backoffice calls it directly; this repository does not implement a local service or proxy for it.

> _Spanish version: [README.es.md](./README.es.md)._
