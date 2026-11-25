"use client";

import { useState, type FormEvent } from "react";
import type { CandidateFormData, CandidateRecord } from "@/types/records";

type Props = {
  /** Pre-populated data for edit mode. Omit for create mode. */
  candidate?: CandidateRecord;
  /** Called when the user submits valid data. */
  onSubmit: (data: CandidateFormData) => Promise<void>;
  /** Whether a submit is in progress. */
  busy: boolean;
  /** Server-side error message displayed at the top. */
  serverError?: string;
  /** Success message shown after a successful submission. */
  successMessage?: string;
  /** Called when the user modifies any field after a success, to dismiss the banner. */
  onSuccessClear?: () => void;
};

type FieldErrors = Partial<Record<"full_name" | "email" | "phone" | "position" | "linkedin_url" | "cv_url" | "experience_years", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;

function validate(fields: {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  linkedinUrl: string;
  cvUrl: string;
  experienceYears: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.fullName.trim()) {
    errors.full_name = "Full name is required.";
  }
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  }
  if (!fields.position.trim()) {
    errors.position = "Position is required.";
  }
  if (fields.email.trim() && !EMAIL_RE.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!fields.phone.trim()) {
    errors.phone = "Phone is required.";
  }
  if (fields.linkedinUrl.trim() && !URL_RE.test(fields.linkedinUrl.trim())) {
    errors.linkedin_url = "Enter a valid URL (https://…).";
  }
  if (fields.cvUrl.trim() && !URL_RE.test(fields.cvUrl.trim())) {
    errors.cv_url = "Enter a valid URL (https://…).";
  }
  if (!fields.experienceYears.trim()) {
    errors.experience_years = "Years of experience is required.";
  } else {
    const n = Number(fields.experienceYears.trim());
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      errors.experience_years = "Enter a whole number between 0 and 50.";
    }
  }
  return errors;
}

function displayDate(value: unknown) {
  if (typeof value !== "string") return "Not provided";
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "Not provided";
}

function dismissSuccess(onSuccessClear: (() => void) | undefined) {
  if (onSuccessClear) onSuccessClear();
}

/** Shared form used by both the "new candidate" and "edit candidate" pages. */
export default function CandidateForm({
  candidate,
  onSubmit,
  busy,
  serverError,
  successMessage,
  onSuccessClear,
}: Props) {
  const isEdit = Boolean(candidate);

  const [fullName, setFullName] = useState(String(candidate?.full_name ?? ""));
  const [email, setEmail] = useState(String(candidate?.email ?? ""));
  const [phone, setPhone] = useState(String(candidate?.phone ?? ""));
  const [position, setPosition] = useState(
    String(candidate?.position ?? "Executive Assistant"),
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    String(candidate?.linkedin_url ?? ""),
  );
  const [cvUrl, setCvUrl] = useState(String(candidate?.cv_url ?? ""));
  const [experienceYears, setExperienceYears] = useState(
    String(candidate?.experience_years ?? ""),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    dismissSuccess(onSuccessClear);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Field-level validation
    const errors = validate({ fullName, email, phone, position, linkedinUrl, cvUrl, experienceYears });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    dismissSuccess(onSuccessClear);

    const data: CandidateFormData = {
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      position: position.trim(),
      experience_years: Number(experienceYears.trim()),
    };
    if (linkedinUrl.trim()) data.linkedin_url = linkedinUrl.trim();
    if (cvUrl.trim()) data.cv_url = cvUrl.trim();

    await onSubmit(data);
  }

  const inputInvalid = (field: keyof FieldErrors, hasError: boolean) =>
    `${inputClass} ${hasError ? "border-red-400 focus:border-red-600 focus:ring-red-600/20" : ""}`;

  const inputClass =
    "w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:ring-2 disabled:opacity-60";
  const labelClass = "text-xs font-semibold uppercase text-zinc-500";
  const errorClass = "mt-1 text-xs text-red-600";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Success banner */}
      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span className="font-semibold">✓</span> {successMessage}
        </div>
      )}

      {/* Server / global error banner */}
      {serverError && !successMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
        {/* Full name */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-full-name" className={labelClass}>
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-full-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearFieldError("full_name");
            }}
            className={`mt-2 ${inputInvalid("full_name", !!fieldErrors.full_name)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="e.g. Jane Doe"
            aria-invalid={!!fieldErrors.full_name}
            aria-describedby={fieldErrors.full_name ? "err-full-name" : undefined}
          />
          {fieldErrors.full_name && (
            <p id="err-full-name" className={errorClass} role="alert">
              {fieldErrors.full_name}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-email" className={labelClass}>
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            className={`mt-2 ${inputInvalid("email", !!fieldErrors.email)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="jane@example.com"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "err-email" : undefined}
          />
          {fieldErrors.email && (
            <p id="err-email" className={errorClass} role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-phone" className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearFieldError("phone");
            }}
            className={`mt-2 ${inputInvalid("phone", !!fieldErrors.phone)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="+1 234 567 890"
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? "err-phone" : undefined}
          />
          {fieldErrors.phone && (
            <p id="err-phone" className={errorClass} role="alert">
              {fieldErrors.phone}
            </p>
          )}
        </div>

        {/* Position */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-position" className={labelClass}>
            Position applied for <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-position"
            type="text"
            required
            value={position}
            onChange={(e) => {
              setPosition(e.target.value);
              clearFieldError("position");
            }}
            className={`mt-2 ${inputInvalid("position", !!fieldErrors.position)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="e.g. Frontend Developer"
            aria-invalid={!!fieldErrors.position}
            aria-describedby={fieldErrors.position ? "err-position" : undefined}
          />
          {fieldErrors.position && (
            <p id="err-position" className={errorClass} role="alert">
              {fieldErrors.position}
            </p>
          )}
        </div>

        {/* LinkedIn URL */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-linkedin" className={labelClass}>
            LinkedIn URL
          </label>
          <input
            id="cf-linkedin"
            type="url"
            value={linkedinUrl}
            onChange={(e) => {
              setLinkedinUrl(e.target.value);
              clearFieldError("linkedin_url");
            }}
            className={`mt-2 ${inputInvalid("linkedin_url", !!fieldErrors.linkedin_url)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="https://linkedin.com/in/janedoe"
            aria-invalid={!!fieldErrors.linkedin_url}
            aria-describedby={fieldErrors.linkedin_url ? "err-linkedin" : undefined}
          />
          {fieldErrors.linkedin_url && (
            <p id="err-linkedin" className={errorClass} role="alert">
              {fieldErrors.linkedin_url}
            </p>
          )}
        </div>

        {/* CV URL */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-cv" className={labelClass}>
            CV URL
          </label>
          <input
            id="cf-cv"
            type="url"
            value={cvUrl}
            onChange={(e) => {
              setCvUrl(e.target.value);
              clearFieldError("cv_url");
            }}
            className={`mt-2 ${inputInvalid("cv_url", !!fieldErrors.cv_url)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="https://example.com/jane-cv.pdf"
            aria-invalid={!!fieldErrors.cv_url}
            aria-describedby={fieldErrors.cv_url ? "err-cv" : undefined}
          />
          {fieldErrors.cv_url && (
            <p id="err-cv" className={errorClass} role="alert">
              {fieldErrors.cv_url}
            </p>
          )}
        </div>

        {/* Years of experience */}
        <div className="min-w-0 bg-white px-5 py-4">
          <label htmlFor="cf-experience" className={labelClass}>
            Years of experience <span className="text-red-500">*</span>
          </label>
          <input
            id="cf-experience"
            type="text"
            required
            inputMode="numeric"
            value={experienceYears}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "" || /^\d+$/.test(raw)) {
                setExperienceYears(raw);
              }
              clearFieldError("experience_years");
            }}
            className={`mt-2 ${inputInvalid("experience_years", !!fieldErrors.experience_years)} border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700/20`}
            placeholder="e.g. 5"
            aria-invalid={!!fieldErrors.experience_years}
            aria-describedby={fieldErrors.experience_years ? "err-experience" : undefined}
          />
          {fieldErrors.experience_years && (
            <p id="err-experience" className={errorClass} role="alert">
              {fieldErrors.experience_years}
            </p>
          )}
        </div>

        {candidate && (
          <div className="min-w-0 bg-white px-5 py-4">
            <p className={labelClass}>Application date</p>
            <p className="mt-2 text-sm text-zinc-700">
              {displayDate(candidate.applied_at)}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : isEdit ? "Save profile" : "Add professional"}
        </button>
      </div>
    </form>
  );
}