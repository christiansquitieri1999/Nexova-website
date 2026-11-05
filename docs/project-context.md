# Nexova Project Context

## Purpose

This document is the persistent, cross-milestone orientation for developers and agents working in this repository. The milestone briefs under `contexts/` remain the canonical source for milestone-specific requirements; read them as input and do not edit them unless explicitly authorized.

## Company

Nexova Solutions is a human resources consulting and talent acquisition company founded in 2011, headquartered in Valencia, Spain, with an expansion office in Miami, Florida. It has approximately 120 employees and annual revenue of about USD 8 million. Its three business lines are executive and mid-management headhunting, customer-support outsourcing for technology companies, and corporate training in soft skills and leadership.

The company serves mid-sized clients, primarily in technology, retail, and financial services. Its core selection operation is led by Javier Almeida and a team of 40 consultants. Other recurring stakeholders in the briefs include Marketing (Carmen Ruiz), Corporate Training (Elena Vargas), Customer Support Outsourcing (Roberto Diaz), Human Resources (Patricia Solis), and Technology (CTO Sergio Molina). Consult the active milestone brief for task-specific people, requirements, and terminology.

## Application Layer

Use the existing monorepo destinations; do not create a parallel frontend or API tree:

| Path | Ownership |
| --- | --- |
| `uis/` | Company user-interface projects. Read [uis/README.md](../uis/README.md) first. |
| `uis/website/` | Public corporate website. Its home route is `/`; keep brand and copy aligned with the applicable website brief. Read [the app README](../uis/website/README.md). |
| `uis/backoffice/` | Internal company app, with its own layout and `/` entry route, separate from the public site. It currently includes Talent Pipeline and Business Model. Read [the app README](../uis/backoffice/README.md). |
| `services/` | Backend APIs and services. Read [services/README.md](../services/README.md) before adding a service. |

The Talent Pipeline currently calls the external API configured by `NEXT_PUBLIC_API_URL` (default: `https://playground.4geeks.com/tracker/api/v1`). Its client is in `uis/backoffice/lib/`; `services/talent-pipeline-api/` documents that external dependency and does not host or proxy it.

Other responsibilities stay in their existing top-level folders: reusable packages in `packages/`, agent capabilities in `skills/`, agents in `agents/`, scripts in `scripts/`, and cross-cutting documentation in `docs/`. There is no root workspace runner configured.

## Milestone Scope

The monorepo-organization task is about repository orientation, ownership boundaries, and agent workflow. It does not by itself request a new website, backoffice feature, or API implementation. The application paths above are destinations for product work when an active task asks for it; their presence is not authorization to scaffold more applications. Follow each destination's README and the relevant `.agents/` guide. For external API documentation, label the dependency clearly and do not imply that a local runtime service exists.

## Source Briefs

- [Company-wide Nexova briefing, English](../contexts/04-briefing/nexova-BRIEFING.en.md)
- [Company-wide Nexova briefing, Spanish](../contexts/04-briefing/nexova-BRIEFING.es.md)
- [Public website milestone](../contexts/01-public-website/CONTEXT.md)
- [Programming fundamentals milestone](../contexts/02-programming-fundamentals/CONTEXT.md)
- [Talent Pipeline milestone](../contexts/03-talent-pipeline-tracker/CONTEXT.es.md)