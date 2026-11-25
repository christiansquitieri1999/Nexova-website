# Talent Pipeline API integration

This folder documents an external API dependency; it is not a locally deployed backend or proxy. The backoffice calls the configured API directly from its server/client modules.

## Configuration

Set `NEXT_PUBLIC_API_URL` in the backoffice environment to the API base URL. If unset, the current client defaults to `https://playground.4geeks.com/tracker/api/v1`. Do not put credentials in this public environment variable.

## Operations used by the backoffice

| Method | Path | Client function | Behavior |
| --- | --- | --- | --- |
| `GET` | `/records?page={page}&limit={limit}` | `getCandidates` | Fetches pages of records until the reported total or a short/empty page is reached; validates record shapes. |
| `GET` | `/records/{id}` | `getCandidate` | Loads one record; returns `null` for `404`; validates the response. |
| `GET` | `/records/{id}/notes` | `getCandidateNotes`, `getCandidateNotesFromApi` | Loads notes and validates the list response. |
| `POST` | `/records` | `createRecord` | Creates a candidate from `CandidateFormData`; validates the returned record. |
| `PUT` | `/records/{id}` | `updateRecord` | Replaces candidate fields; validates the returned record. |
| `PATCH` | `/records/{id}` | `patchCandidate` | Applies the candidate patch payload. |
| `POST` | `/records/{id}/notes` | `createCandidateNote` | Adds a note; accepts an empty response and returns `null` when no note payload is available. |
| `DELETE` | `/records/{id}/notes/{noteId}` | `deleteCandidateNote` | Deletes a note. |

The client lives in `uis/backoffice/lib/records.ts` and `uis/backoffice/lib/record-actions.ts`; payload and response types live in `uis/backoffice/types/records.ts`. List responses use a `data` array and `total`; detail and mutation responses may wrap the record in `data`. Candidate records and notes are checked at runtime before use. Non-success responses are converted to user-facing errors, including field-level handling for validation errors (`422`).
The client lives in `uis/backoffice/lib/records.ts` and `uis/backoffice/lib/record-actions.ts`; payload and response types live in `uis/backoffice/types/records.ts`. List responses use a `data` array and `total`; detail and mutation responses may wrap the record in `data`. Candidate records and notes are checked at runtime before use. Non-success responses are converted to user-facing errors, including field-level handling for validation errors (`422`).

## Payloads and response shapes

- Candidate create/update requests use `CandidateFormData`: `full_name`, `email`, `phone`, `position`, and `experience_years`, with optional `linkedin_url` and `cv_url`.
- Candidate patch requests contain either a `status` (`received`, `in_progress`, `selected`, or `discarded`) or a `stage` (`pending`, `review`, `personal_interview`, `technical_interview`, or `offer_presented`). The UI maps these API values to readable labels.
- Note creation sends `{ "content": "..." }`. Note records contain an id, candidate/record id, content, and creation timestamp.
- Record-list responses contain `{ "data": [...], "total": number }`; notes-list responses contain `{ "data": [...] }`. Detail and mutation calls accept either a direct record or an envelope with a `data` property.
- A `422` response may contain a `detail` array with field locations and messages. The client maps known field names to user-facing labels and reports the validation failure.

## Change checklist

- Confirm the external API contract before changing paths or payloads.
- Update the relevant client types/validation and this document together.
- Keep the API base URL configurable; do not hardcode a deployment-specific endpoint in UI components.
- Do not add a local adapter or proxy unless the product explicitly requires one.