# Nexova Solutions — Project Brief

## Business Description

Nexova Solutions is a human resources consulting and talent acquisition firm founded in 2011, headquartered in **Valencia, Spain**, with an expansion office in **Miami, Florida**. The company employs approximately **120 people** and generates about **USD 8 million in annual revenue** across three business lines:

1. **Executive & Mid-Management Headhunting** — The core business. A team of 40 selection consultants (led by Javier Almeida) runs end-to-end recruitment processes for client companies: briefings, CV screening, interviews, and placement.

2. **Customer Support Outsourcing** — Led by Roberto Díaz, 30 agents handle customer incidents on behalf of technology, retail, and finance clients via phone, email, and chat.

3. **Corporate Training** — Led by Elena Vargas, a 12-person team designs and delivers soft-skills and leadership programmes for client organisations.

The company serves **mid-sized clients**, primarily in technology, retail, and financial services. Leadership includes **Laura Mendoza** (CEO), **Carmen Ruiz** (Marketing), **Sergio Molina** (CTO), **Patricia Solís** (HR), and **Megan Clarke** (Sales & Business Development).

## Problem Statement

Nexova has a strong reputation, a deep candidate-and-client network built over twelve years, and a team that genuinely knows how to find, develop, and support talent. **What it does not have is the infrastructure to operate at scale.**

- **Talent Selection:** Every step is manual. Consultants read 30–80 CVs per search by hand. Candidate communication is done via individual email with no templates or automation. No real-time candidate status tracking exists — clients call to ask for updates.
- **Corporate Training:** The catalogue lives in a quarterly PDF. Enrolments go through a Google Form managed in a spreadsheet. There is no learner portal, no progress tracking, and no personalisation.
- **Customer Support:** Agents operate without a knowledge base, without real-time visibility, and with resolution times that regularly miss committed SLAs.
- **Sales & BD:** The CRM (HubSpot) is used inconsistently (only ~40% adoption). Prospecting is manual via LinkedIn exports to Excel. Deals are lost because follow-up falls through the cracks.
- **Marketing:** The corporate website was built in 2019 and is slow, inaccessible, and outdated. Content production is manual with no measurement of conversion.
- **HR:** Holiday requests, absences, onboarding, and performance reviews run on email and spreadsheets with no visibility metrics.
- **Leadership:** Laura receives a weekly PDF report prepared manually by each department head — hours of effort for data that is already days old.

The consequences are tangible: consultants spend most of their time on manual work, clients have no visibility, the training catalogue is invisible to buyers, SLAs are missed, and **leadership makes decisions on data that is always a week behind**.

New platforms — automated, data-driven, and built for scale — are starting to compete directly with Nexova. The window to respond is not unlimited.

## Project Objective

Build the **systems, automations, and intelligent tools** that allow Nexova to do what it already does well — but **faster, at greater scale, and with far less manual effort**.

This repository is a **monorepo** for transversal projects in the 4Geeks Academy AI Engineering programme. It spans multiple milestones (public website, programming fundamentals, Talent Pipeline tracker, backend, telemetry, RAG, agents, workflows, real-time) that progressively deliver Nexova's digital transformation.

The current delivery covers:

| Milestone | Deliverable |
|---|---|
| **01 — Public Website** | Modern, responsive, accessible, SEO-optimised corporate website with talent application form |
| **02 — Programming Fundamentals** | Business Model UI test bench (candidate scoring, filtering, ranking, reporting) |
| **03 — Talent Pipeline Tracker** | Internal candidate management app with status/stage tracking, search, filters, notes |
| **04 — Company Briefing** | Cross-departmental overview of Nexova needs (foundational, not an implementation request) |

## Key Principles

- The **monorepo-organization task** is about documentation, ownership boundaries, and agent workflow — it does not by itself request new apps or features.
- `contexts/` files are **read-only** canonical briefs; they are never modified by implementation work.
- Every application has a **canonical destination** (`uis/website/`, `uis/backoffice/`, `services/`), an app-level README, and a matching scoped guide under `.agents/`.
- External API dependencies (e.g., the Talent Pipeline mock API at `playground.4geeks.com`) are documented and consumed directly; no local proxy is introduced unless explicitly requested.