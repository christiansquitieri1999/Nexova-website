/**
 * Incident Manager types.
 *
 * Mirrors the backend model defined in services/api/incident_models.py.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type IncidentStatus = "open" | "in_progress" | "resolved" | "discarded";

export type IncidentCategory =
  | "technical_failure"
  | "process_error"
  | "client_complaint"
  | "candidate_issue"
  | "staff_issue"
  | "sla_breach"
  | "data_quality"
  | "other";

export type IncidentOrigin = "customer" | "branch" | "internal";

export type IncidentBranch =
  | "central"
  | "valencia_operations"
  | "miami_office"
  | "remote";

// ---------------------------------------------------------------------------
// Labels (from BRIEFING)
// ---------------------------------------------------------------------------

export const BRANCH_LABELS: Record<IncidentBranch, string> = {
  central: "Central — Valencia HQ",
  valencia_operations: "Valencia — Operations",
  miami_office: "Miami Office",
  remote: "Remote (no fixed office)",
};

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  technical_failure: "Technical failure",
  process_error: "Process error",
  client_complaint: "Client complaint",
  candidate_issue: "Candidate issue",
  staff_issue: "Staff issue",
  sla_breach: "SLA breach",
  data_quality: "Data quality",
  other: "Other",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  discarded: "Discarded",
};

export const ORIGIN_LABELS: Record<IncidentOrigin, string> = {
  customer: "Customer",
  branch: "Branch",
  internal: "Internal",
};

export const VALID_BRANCHES: IncidentBranch[] = [
  "central",
  "valencia_operations",
  "miami_office",
  "remote",
];

export const VALID_CATEGORIES: IncidentCategory[] = [
  "technical_failure",
  "process_error",
  "client_complaint",
  "candidate_issue",
  "staff_issue",
  "sla_breach",
  "data_quality",
  "other",
];

export const VALID_STATUSES: IncidentStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "discarded",
];

export const VALID_ORIGINS: IncidentOrigin[] = ["customer", "branch", "internal"];

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface IncidentRecord {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  created_at: string;
  updated_at: string;
}

export interface IncidentFormData {
  title: string;
  description: string;
  category: IncidentCategory;
  origin: IncidentOrigin;
  branch: IncidentBranch;
}

export interface IncidentSummary {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_origin: Record<string, number>;
  by_branch: Record<string, number>;
}