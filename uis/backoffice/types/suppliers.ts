/** Supplier directory types for the Nexova backoffice. */

export const VALID_CATEGORIES = [
  "job_boards",
  "ats_software",
  "assessment_tools",
  "training_platforms",
  "payroll_and_hr_software",
  "video_interview",
  "background_check",
  "office_and_facilities",
  "it_and_software_licenses",
] as const;

export type SupplierCategory = (typeof VALID_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  job_boards: "Job boards",
  ats_software: "ATS software",
  assessment_tools: "Assessment tools",
  training_platforms: "Training platforms",
  payroll_and_hr_software: "Payroll & HR software",
  video_interview: "Video interview",
  background_check: "Background check",
  office_and_facilities: "Office & facilities",
  it_and_software_licenses: "IT & software licenses",
};

export const VALID_STATUSES = ["active", "suspended"] as const;
export type SupplierStatus = (typeof VALID_STATUSES)[number];

export const VALID_COUNTRIES = ["Spain", "USA"] as const;
export type SupplierCountry = (typeof VALID_COUNTRIES)[number];

export interface SupplierRecord {
  id: string;
  name: string;
  country: SupplierCountry;
  categories: SupplierCategory[];
  monthly_rate: number;
  currency: "EUR" | "USD";
  status: SupplierStatus;
  updated_at: string;
  contract_renewal_date: string | null;
  contact_email: string | null;
  notes: string | null;
}

export interface SupplierFormData {
  name: string;
  country: SupplierCountry;
  categories: SupplierCategory[];
  monthly_rate: number;
  currency: "EUR" | "USD";
  status: SupplierStatus;
  contract_renewal_date?: string;
  contact_email?: string;
  notes?: string;
}

export interface SupplierErrorResponse {
  error: string;
  details?: Record<string, string> | Array<{ loc: string[]; msg: string; type: string }>;
}