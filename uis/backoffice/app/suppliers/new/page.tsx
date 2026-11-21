"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer, useState } from "react";
import {
  CATEGORY_LABELS,
  VALID_CATEGORIES,
  VALID_COUNTRIES,
  type SupplierCategory,
  type SupplierCountry,
  type SupplierFormData,
} from "@/types/suppliers";
import { createSupplier } from "@/lib/suppliers";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  country: string;
  categories: SupplierCategory[];
  monthly_rate: string;
  currency: string;
  status: string;
  contract_renewal_date: string;
  contact_email: string;
  notes: string;
}

type FormAction =
  | { kind: "set-field"; field: keyof FormState; value: string }
  | { kind: "toggle-category"; category: SupplierCategory }
  | { kind: "set-country"; country: string }
  | { kind: "reset" };

const EMPTY_FORM: FormState = {
  name: "",
  country: "",
  categories: [],
  monthly_rate: "",
  currency: "",
  status: "active",
  contract_renewal_date: "",
  contact_email: "",
  notes: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.kind) {
    case "set-field":
      return { ...state, [action.field]: action.value };
    case "toggle-category": {
      const exists = state.categories.includes(action.category);
      return {
        ...state,
        categories: exists
          ? state.categories.filter((c) => c !== action.category)
          : [...state.categories, action.category],
      };
    }
    case "set-country": {
      const currency = action.country === "Spain" ? "EUR" : action.country === "USA" ? "USD" : "";
      return { ...state, country: action.country, currency };
    }
    case "reset":
      return { ...EMPTY_FORM };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewSupplierPage() {
  const router = useRouter();
  const [form, dispatch] = useReducer(formReducer, EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const rate = parseFloat(form.monthly_rate);
    if (isNaN(rate) || rate <= 0) {
      setError("Monthly rate must be a positive number.");
      return;
    }
    if (!form.country) {
      setError("Please select a country.");
      return;
    }
    if (form.categories.length === 0) {
      setError("Please select at least one category.");
      return;
    }

    const data: SupplierFormData = {
      name: form.name.trim(),
      country: form.country as SupplierCountry,
      categories: form.categories,
      monthly_rate: rate,
      currency: form.currency as "EUR" | "USD",
      status: form.status as "active" | "suspended",
    };
    if (form.contract_renewal_date) data.contract_renewal_date = form.contract_renewal_date;
    if (form.contact_email?.trim()) data.contact_email = form.contact_email.trim();
    if (form.notes?.trim()) data.notes = form.notes.trim();

    setSaving(true);
    try {
      await createSupplier(data);
      router.push("/suppliers");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save supplier.");
    } finally {
      setSaving(false);
    }
  }

  const isEur = form.country === "Spain" || form.country === "";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Nexova backoffice home">
            <span className="grid size-9 place-items-center rounded-md bg-emerald-700 font-bold text-white">
              N
            </span>
            <span className="font-semibold">
              Nexova{" "}
              <span className="text-xs font-medium uppercase text-emerald-700">
                Backoffice
              </span>
            </span>
          </Link>
          <Link
            href="/suppliers"
            className="text-sm font-semibold text-emerald-800 hover:underline"
          >
            &larr; Supplier directory
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        <div className="mb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Operations
          </p>
          <h1 className="mt-1 text-3xl font-bold">Register new supplier</h1>
          <p className="mt-2 text-sm text-slate-500">
            Add a new supplier to the Nexova directory. All fields marked with * are required.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
            >
              {error}
            </div>
          )}

          {/* Name */}
          <FieldGroup label="Supplier name *">
            <input
              required
              value={form.name}
              onChange={(e) =>
                dispatch({ kind: "set-field", field: "name", value: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder="e.g. LinkedIn Talent Solutions"
            />
          </FieldGroup>

          {/* Country */}
          <FieldGroup label="Country *">
            <select
              required
              value={form.country}
              onChange={(e) =>
                dispatch({ kind: "set-country", country: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">Select a country</option>
              {VALID_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldGroup>

          {/* Categories */}
          <fieldset>
            <legend className="mb-2 block text-sm font-bold text-slate-700">
              Categories *
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {VALID_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={form.categories.includes(cat)}
                    onChange={() => dispatch({ kind: "toggle-category", category: cat })}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  {CATEGORY_LABELS[cat]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Monthly rate */}
          <FieldGroup label="Monthly rate *">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                {isEur ? "\u20AC" : "\u0024"}
              </span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.monthly_rate}
                onChange={(e) =>
                  dispatch({
                    kind: "set-field",
                    field: "monthly_rate",
                    value: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-8 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                placeholder="0.00"
              />
            </div>
          </FieldGroup>

          {/* Currency (auto-selected, show read-only) */}
          <FieldGroup label="Currency">
            <p className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">
              {form.country
                ? `${form.currency} (auto-selected for ${form.country})`
                : "Select a country first"}
            </p>
          </FieldGroup>

          {/* Status */}
          <FieldGroup label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                dispatch({ kind: "set-field", field: "status", value: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </FieldGroup>

          {/* Contract renewal date */}
          <FieldGroup label="Contract renewal date">
            <input
              type="date"
              value={form.contract_renewal_date}
              onChange={(e) =>
                dispatch({
                  kind: "set-field",
                  field: "contract_renewal_date",
                  value: e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </FieldGroup>

          {/* Contact email */}
          <FieldGroup label="Contact email">
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                dispatch({
                  kind: "set-field",
                  field: "contact_email",
                  value: e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder="account@supplier.com"
            />
          </FieldGroup>

          {/* Notes */}
          <FieldGroup label="Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) =>
                dispatch({ kind: "set-field", field: "notes", value: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder="Internal notes about this supplier"
            />
          </FieldGroup>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-6">
            <Link
              href="/suppliers"
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving\u2026" : "Save supplier"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}