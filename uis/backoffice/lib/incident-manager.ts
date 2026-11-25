/**
 * Incident Manager API client.
 *
 * Connects to the local incident API (default http://127.0.0.1:8003).
 * Set NEXT_PUBLIC_INCIDENTS_API_URL in .env.local to override.
 *
 * Protected endpoints automatically inject the Authorization header
 * via @/lib/auth.
 */

import { authHeaders, authFetch } from "@/lib/auth";
import type {
  IncidentFormData,
  IncidentRecord,
  IncidentStatus,
  IncidentSummary,
} from "@/types/incidents";

const DEFAULT_API_URL = "http://127.0.0.1:8003";

function apiUrl(path: string): string {
  const baseUrl = (
    process.env.NEXT_PUBLIC_INCIDENTS_API_URL || DEFAULT_API_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIncidentRecord(value: unknown): value is IncidentRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    typeof value.status === "string" &&
    typeof value.origin === "string" &&
    typeof value.branch === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

// ---------------------------------------------------------------------------
// Helper: parse a field-level error detail from the API
// ---------------------------------------------------------------------------

export interface FieldError {
  field: string;
  message: string;
}

export function parseFieldErrors(body: unknown): FieldError[] {
  if (!isObject(body)) return [];
  const details = body.details;
  if (!Array.isArray(details)) return [];
  const result: FieldError[] = [];
  for (const d of details) {
    if (
      isObject(d) &&
      typeof d.field === "string" &&
      typeof d.message === "string"
    ) {
      result.push({ field: d.field as string, message: d.message as string });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Create a new incident. Throws on validation errors with field-level details. */
export async function createIncident(
  data: IncidentFormData,
): Promise<IncidentRecord> {
  const response = await authFetch(apiUrl("/api/incidents"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const fieldErrors = parseFieldErrors(body);
    if (fieldErrors.length > 0) {
      // Throw a structured error that the form can use
      const err = new Error("Validation error") as Error & { fieldErrors: FieldError[] };
      err.fieldErrors = fieldErrors;
      throw err;
    }
    throw new Error("The incident could not be registered. Please try again.");
  }

  if (!isObject(body)) {
    throw new Error("The incident API returned an invalid response.");
  }

  if (!isIncidentRecord(body)) {
    throw new Error("The incident API returned an unexpected shape.");
  }
  return body as IncidentRecord;
}

/** Fetch all incidents with optional filters. */
export async function getIncidents(options?: {
  status?: IncidentStatus;
  origin?: string;
  branch?: string;
  category?: string;
}): Promise<IncidentRecord[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.origin) params.set("origin", options.origin);
  if (options?.branch) params.set("branch", options.branch);
  if (options?.category) params.set("category", options.category);

  const query = params.toString();
  const url = apiUrl(`/api/incidents${query ? `?${query}` : ""}`);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load incidents (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error("The incident API returned an invalid response.");
  }

  return (body as IncidentRecord[]).filter(isIncidentRecord);
}

/** Fetch a single incident by ID. */
export async function getIncident(id: string): Promise<IncidentRecord | null> {
  const response = await fetch(
    apiUrl(`/api/incidents/${encodeURIComponent(id)}`),
    { cache: "no-store", headers: { ...authHeaders() } },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not load incident (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json();
  return isIncidentRecord(body) ? (body as IncidentRecord) : null;
}

/** Update the status of an incident (lifecycle-validated). */
export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
): Promise<IncidentRecord> {
  const response = await authFetch(
    apiUrl(`/api/incidents/${encodeURIComponent(id)}/status`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    },
  );

  const body: unknown = await response.json();

  if (!response.ok) {
    const fieldErrors = parseFieldErrors(body);
    if (fieldErrors.length > 0) {
      const err = new Error(
        fieldErrors.map((fe) => `${fe.field}: ${fe.message}`).join("; "),
      ) as Error & { fieldErrors: FieldError[] };
      err.fieldErrors = fieldErrors;
      throw err;
    }
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : `Could not update status (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!isObject(body) || !isIncidentRecord(body)) {
    throw new Error("The incident API returned an invalid response.");
  }

  return body as IncidentRecord;
}

/** Fetch aggregated summary metrics. */
export async function getIncidentSummary(): Promise<IncidentSummary> {
  const response = await fetch(apiUrl("/api/incidents/summary"), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not load summary (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json();
  if (!isObject(body)) {
    throw new Error("The incident API returned an invalid response.");
  }

  return {
    total: (typeof body.total === "number" ? body.total : 0) as number,
    by_status: isObject(body.by_status)
      ? (body.by_status as Record<string, number>)
      : {},
    by_category: isObject(body.by_category)
      ? (body.by_category as Record<string, number>)
      : {},
    by_origin: isObject(body.by_origin)
      ? (body.by_origin as Record<string, number>)
      : {},
    by_branch: isObject(body.by_branch)
      ? (body.by_branch as Record<string, number>)
      : {},
  };
}