/**
 * Supplier Directory API client.
 *
 * Connects to the local supplier API (default http://127.0.0.1:8001).
 * Set NEXT_PUBLIC_SUPPLIER_API_URL in .env.local to override.
 *
 * Protected endpoints (POST, PATCH, DELETE) automatically inject the
 * Authorization header from localStorage via @/lib/auth.
 */

import type {
  SupplierCategory,
  SupplierCountry,
  SupplierFormData,
  SupplierRecord,
} from "@/types/suppliers";
import { authHeaders, authFetch } from "@/lib/auth";
import { fetchSafely, readJsonSafely } from "@/lib/api-error";

const DEFAULT_API_URL = "http://127.0.0.1:8001";

function apiUrl(path: string): string {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SUPPLIER_API_URL || DEFAULT_API_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupplierRecord(value: unknown): value is SupplierRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.country === "string" &&
    Array.isArray(value.categories) &&
    typeof value.monthly_rate === "number" &&
    typeof value.currency === "string" &&
    typeof value.status === "string" &&
    typeof value.updated_at === "string"
  );
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Fetch all suppliers with optional filters. */
export async function getSuppliers(options?: {
  country?: SupplierCountry;
  category?: SupplierCategory;
}): Promise<SupplierRecord[]> {
  const params = new URLSearchParams();
  if (options?.country) params.set("country", options.country);
  if (options?.category) params.set("category", options.category);

  const query = params.toString();
  const url = apiUrl(`/suppliers${query ? `?${query}` : ""}`);

  const response = await fetchSafely(url, { cache: "no-store" }, "The supplier directory is temporarily unavailable.");
  if (!response.ok) {
    throw new Error("Could not load suppliers.");
  }

  const body: unknown = await readJsonSafely(response, "The supplier directory returned an invalid response.");
  if (!Array.isArray(body)) {
    throw new Error("The supplier API returned an invalid response.");
  }

  return (body as SupplierRecord[]).filter(isSupplierRecord);
}

/** Fetch a single supplier by ID. */
export async function getSupplier(id: string): Promise<SupplierRecord | null> {
  const response = await fetchSafely(apiUrl(`/suppliers/${encodeURIComponent(id)}`), {
    cache: "no-store",
  }, "The supplier directory is temporarily unavailable.");
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not load supplier.");
  }

  const body: unknown = await readJsonSafely(response, "The supplier service returned an invalid response.");
  if (!isObject(body)) {
    throw new Error("The supplier API returned an invalid response.");
  }

  return isSupplierRecord(body) ? (body as SupplierRecord) : null;
}

/** Create a new supplier. Returns the created record or throws. */
export async function createSupplier(
  data: SupplierFormData,
): Promise<SupplierRecord> {
  const response = await authFetch(apiUrl("/suppliers"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });

  const body: unknown = await readJsonSafely(response, "The supplier service returned an invalid response.");

  if (response.status === 422) {
    const errBody = isObject(body) ? body : {};
    const details = errBody.details;
    const messages: string[] = [];
    if (Array.isArray(details)) {
      for (const item of details) {
        if (isObject(item) && typeof item.msg === "string") {
          messages.push(item.msg);
        }
      }
    }
    throw new Error(
      messages.length > 0 ? messages.join("; ") : "Validation error. Check your input.",
    );
  }

  if (!response.ok) {
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Could not create supplier.";
    throw new Error(message);
  }

  if (!isObject(body)) {
    throw new Error("The supplier API returned an invalid response.");
  }

  if (!isSupplierRecord(body)) {
    throw new Error("The supplier API returned an unexpected shape.");
  }
  return body as SupplierRecord;
}

/** Update a supplier's monthly_rate. Returns the updated record or throws. */
export async function updateSupplierRate(
  id: string,
  monthly_rate: number,
): Promise<SupplierRecord> {
  const response = await authFetch(
    apiUrl(`/suppliers/${encodeURIComponent(id)}/rate`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ monthly_rate }),
    },
  );

  const body: unknown = await readJsonSafely(response, "The supplier service returned an invalid response.");

  if (response.status === 422) {
    const msg =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Monthly rate must be a positive number.";
    throw new Error(msg);
  }

  if (!response.ok) {
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Could not update rate.";
    throw new Error(message);
  }

  if (!isObject(body) || !isSupplierRecord(body)) {
    throw new Error("The supplier API returned an invalid response.");
  }

  return body as SupplierRecord;
}

/** Update a supplier's status (activate/suspend). Returns the updated record or throws. */
export async function updateSupplierStatus(
  id: string,
  status: string,
): Promise<SupplierRecord> {
  const response = await authFetch(
    apiUrl(`/suppliers/${encodeURIComponent(id)}/status`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    },
  );

  const body: unknown = await readJsonSafely(response, "The supplier service returned an invalid response.");

  if (response.status === 422) {
    const msg =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Status must be 'active' or 'suspended'.";
    throw new Error(msg);
  }

  if (!response.ok) {
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Could not update status.";
    throw new Error(message);
  }

  if (!isObject(body) || !isSupplierRecord(body)) {
    throw new Error("The supplier API returned an invalid response.");
  }

  return body as SupplierRecord;
}

/** Delete a supplier. */
export async function deleteSupplier(id: string): Promise<void> {
  const response = await authFetch(
    apiUrl(`/suppliers/${encodeURIComponent(id)}`),
    { method: "DELETE", headers: { ...authHeaders() } },
  );

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "Could not delete supplier.";
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a numeric rate with its currency symbol. */
export function formatRate(
  rate: number,
  currency: "EUR" | "USD",
): string {
  const locale = currency === "EUR" ? "es-ES" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate);
}

/** Return true if a contract renewal date is within the next 60 days. */
export function isRenewalSoon(renewalDate: string | null): boolean {
  if (!renewalDate) return false;
  const renewal = new Date(renewalDate + "T00:00:00");
  const now = new Date();
  const diffDays = (renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 60;
}