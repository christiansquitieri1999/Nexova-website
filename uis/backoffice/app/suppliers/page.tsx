"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer } from "react";
import {
  CATEGORY_LABELS,
  VALID_CATEGORIES,
  VALID_COUNTRIES,
  type SupplierCategory,
  type SupplierRecord,
} from "@/types/suppliers";
import {
  deleteSupplier,
  formatRate,
  getSuppliers,
  isRenewalSoon,
  updateSupplierRate,
  updateSupplierStatus,
} from "@/lib/suppliers";

// ---------------------------------------------------------------------------
// Human-readable error map
// ---------------------------------------------------------------------------

const HUMAN_ERRORS: Record<string, string> = {
  "Could not load suppliers": "The supplier directory is temporarily unavailable.",
  "Could not update rate": "We could not update the monthly rate. Please try again.",
  "Could not update status": "We could not update the supplier status. Please try again.",
  "Could not delete supplier": "We could not delete the supplier. Please try again.",
  "Unexpected error": "Something unexpected happened. Please try again or contact support.",
  "Monthly rate must be a positive": "The monthly rate must be a positive number.",
};

function toHumanError(raw: string): string {
  for (const [key, human] of Object.entries(HUMAN_ERRORS)) {
    if (raw.includes(key)) return human;
  }
  return "Something unexpected happened. Please try again or contact support.";
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface PageState {
  suppliers: SupplierRecord[];
  filterCountry: string;
  filterCategory: string;
  filterStatus: string;
  editRateId: string | null;
  editRateValue: string;
  loading: boolean;
  error: string;
}

type Action =
  | { kind: "set-suppliers"; suppliers: SupplierRecord[] }
  | { kind: "set-loading"; loading: boolean }
  | { kind: "set-error"; error: string }
  | { kind: "set-filter-country"; country: string }
  | { kind: "set-filter-category"; category: string }
  | { kind: "set-filter-status"; status: string }
  | { kind: "start-edit-rate"; id: string; value: string }
  | { kind: "edit-rate-change"; value: string }
  | { kind: "cancel-edit-rate" }
  | { kind: "update-supplier"; supplier: SupplierRecord }
  | { kind: "remove-supplier"; id: string };

function reducer(state: PageState, action: Action): PageState {
  switch (action.kind) {
    case "set-suppliers":
      return { ...state, suppliers: action.suppliers };
    case "set-loading":
      return { ...state, loading: action.loading };
    case "set-error":
      return { ...state, error: action.error };
    case "set-filter-country":
      return { ...state, filterCountry: action.country };
    case "set-filter-category":
      return { ...state, filterCategory: action.category };
    case "set-filter-status":
      return { ...state, filterStatus: action.status };
    case "start-edit-rate":
      return { ...state, editRateId: action.id, editRateValue: action.value };
    case "edit-rate-change":
      return { ...state, editRateValue: action.value };
    case "cancel-edit-rate":
      return { ...state, editRateId: null, editRateValue: "" };
    case "update-supplier":
      return {
        ...state,
        suppliers: state.suppliers.map((s) =>
          s.id === action.supplier.id ? action.supplier : s,
        ),
        editRateId: null,
        editRateValue: "",
      };
    case "remove-supplier":
      return {
        ...state,
        suppliers: state.suppliers.filter((s) => s.id !== action.id),
      };
  }
}

const INITIAL: PageState = {
  suppliers: [],
  filterCountry: "",
  filterCategory: "",
  filterStatus: "",
  editRateId: null,
  editRateValue: "",
  loading: true,
  error: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadSuppliers = useCallback(async () => {
    dispatch({ kind: "set-loading", loading: true });
    dispatch({ kind: "set-error", error: "" });
    try {
      const suppliers = await getSuppliers({
        country: (state.filterCountry || undefined) as never,
        category: (state.filterCategory || undefined) as never,
      });
      dispatch({ kind: "set-suppliers", suppliers });
    } catch (caught) {
          const raw = caught instanceof Error ? caught.message : "";
      dispatch({
        kind: "set-error",
            error: raw ? toHumanError(raw) : "The supplier directory is temporarily unavailable.",
      });
    } finally {
      dispatch({ kind: "set-loading", loading: false });
    }
    }, [state.filterCountry, state.filterCategory]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  async function handleToggleStatus(supplier: SupplierRecord) {
    const newStatus = supplier.status === "active" ? "suspended" : "active";
    try {
        const updated = await updateSupplierStatus(supplier.id, newStatus);
      dispatch({ kind: "update-supplier", supplier: updated });
    } catch (caught) {
          const raw = caught instanceof Error ? caught.message : "";
      dispatch({
        kind: "set-error",
            error: raw ? toHumanError(raw) : "We could not update the supplier status. Please try again.",
      });
    }
  }

  async function handleSaveRate(supplierId: string) {
    const rate = parseFloat(state.editRateValue);
    if (isNaN(rate) || rate <= 0) {
      dispatch({
        kind: "set-error",
            error: "The monthly rate must be a positive number.",
      });
      return;
    }
    try {
        const updated = await updateSupplierRate(supplierId, rate);
      dispatch({ kind: "update-supplier", supplier: updated });
    } catch (caught) {
          const raw = caught instanceof Error ? caught.message : "";
      dispatch({
        kind: "set-error",
            error: raw ? toHumanError(raw) : "We could not update the monthly rate. Please try again.",
      });
    }
  }

  async function handleDelete(supplierId: string) {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await deleteSupplier(supplierId);
      dispatch({ kind: "remove-supplier", id: supplierId });
    } catch (caught) {
          const raw = caught instanceof Error ? caught.message : "";
      dispatch({
        kind: "set-error",
            error: raw ? toHumanError(raw) : "We could not delete the supplier. Please try again.",
      });
    }
  }

  const filtered = state.suppliers.filter((s) => {
    if (state.filterCountry && s.country !== state.filterCountry) return false;
    if (state.filterCategory && !s.categories.includes(state.filterCategory as SupplierCategory)) return false;
    if (state.filterStatus && s.status !== state.filterStatus) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
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
            href="/"
            className="text-sm font-semibold text-emerald-800 hover:underline"
          >
            Talent Pipeline
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-slate-950 px-5 py-9 text-white sm:px-9">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Operations &middot; Supplier directory
          </p>
          <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold sm:text-5xl">
                Supplier directory
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Single source of truth for all contracted suppliers across Spain and the USA.
                Manage rates, track renewals, and keep supplier relationships transparent.
              </p>
            </div>
            <Link
              href="/suppliers/new"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add supplier
            </Link>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <FilterSelect
            label="Country"
            value={state.filterCountry}
            options={[
              { value: "", label: "All countries" },
              ...VALID_COUNTRIES.map((c) => ({ value: c, label: c })),
            ]}
            onChange={(v) => dispatch({ kind: "set-filter-country", country: v })}
          />
          <FilterSelect
            label="Category"
            value={state.filterCategory}
            options={[
              { value: "", label: "All categories" },
              ...VALID_CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORY_LABELS[c],
              })),
            ]}
            onChange={(v) => dispatch({ kind: "set-filter-category", category: v })}
          />
          <FilterSelect
            label="Status"
            value={state.filterStatus}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
            onChange={(v) => dispatch({ kind: "set-filter-status", status: v })}
          />
        </div>
      </div>

      {/* Error */}
      {state.error && (
        <div
          role="alert"
                className="mx-auto mt-6 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center"
        >
                <p className="text-sm font-semibold text-red-900">{state.error}</p>
                <button
                  type="button"
                  onClick={loadSuppliers}
                  className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
                >
                  Retry
                </button>
        </div>
      )}

      {/* Loading */}
      {state.loading && (
        <div className="mx-auto mt-8 max-w-7xl px-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center font-semibold text-emerald-900">
            Loading suppliers&hellip;
          </div>
        </div>
      )}

      {/* Empty state */}
      {!state.loading && filtered.length === 0 && !state.error && (
        <div className="mx-auto mt-8 max-w-7xl px-5">
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-bold text-slate-800">
              No suppliers found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {state.suppliers.length === 0
                ? "The directory is empty. Add your first supplier to get started."
                : "Try adjusting the filters above."}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="mx-auto mt-6 max-w-7xl px-5 pb-16 lg:px-8">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Country</th>
                  <th className="px-5 py-3">Categories</th>
                  <th className="px-5 py-3">Monthly rate</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Renewal</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    editRateId={state.editRateId}
                    editRateValue={state.editRateValue}
                    onStartEditRate={(id, val) =>
                      dispatch({ kind: "start-edit-rate", id, value: val })
                    }
                    onEditRateChange={(val) =>
                      dispatch({ kind: "edit-rate-change", value: val })
                    }
                    onCancelEditRate={() => dispatch({ kind: "cancel-edit-rate" })}
                    onSaveRate={handleSaveRate}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Showing {filtered.length} of {state.suppliers.length} suppliers
          </p>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SupplierRow({
  supplier,
  editRateId,
  editRateValue,
  onStartEditRate,
  onEditRateChange,
  onCancelEditRate,
  onSaveRate,
  onToggleStatus,
  onDelete,
}: {
  supplier: SupplierRecord;
  editRateId: string | null;
  editRateValue: string;
  onStartEditRate: (id: string, initial: string) => void;
  onEditRateChange: (value: string) => void;
  onCancelEditRate: () => void;
  onSaveRate: (id: string) => void;
  onToggleStatus: (supplier: SupplierRecord) => void;
  onDelete: (id: string) => void;
}) {
  const renewalSoon = isRenewalSoon(supplier.contract_renewal_date);
  const isSuspended = supplier.status === "suspended";

  return (
    <tr className={`transition hover:bg-slate-50 ${isSuspended ? "opacity-60" : ""}`}>
      <td className="px-5 py-4">
        <div className="flex flex-col">
          <span className={`font-semibold ${isSuspended ? "text-slate-500" : "text-slate-900"}`}>
            {supplier.name}
          </span>
          {supplier.contact_email && (
            <span className="mt-0.5 text-xs text-slate-400">
              {supplier.contact_email}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-slate-600">{supplier.country}</span>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {supplier.categories.map((cat) => (
            <span
              key={cat}
              className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            >
              {CATEGORY_LABELS[cat] || cat}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-4">
        {editRateId === supplier.id ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0.01"
              autoFocus
              value={editRateValue}
              onChange={(e) => onEditRateChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveRate(supplier.id);
                if (e.key === "Escape") onCancelEditRate();
              }}
              className="w-28 rounded border border-emerald-500 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => onSaveRate(supplier.id)}
              className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              title="Save"
            >
              &#10003;
            </button>
            <button
              onClick={onCancelEditRate}
              className="rounded bg-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-400"
              title="Cancel"
            >
              &#10005;
            </button>
          </div>
        ) : (
          <button
            onClick={() =>
              onStartEditRate(
                supplier.id,
                String(supplier.monthly_rate),
              )
            }
            className="font-mono text-sm font-semibold text-slate-800 hover:text-emerald-700"
            title="Click to edit rate"
          >
            {formatRate(supplier.monthly_rate, supplier.currency)}
          </button>
        )}
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
            isSuspended
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isSuspended ? "Suspended" : "Active"}
        </span>
      </td>
      <td className="px-5 py-4">
        {supplier.contract_renewal_date ? (
          <span
            className={`text-sm font-medium ${
              renewalSoon
                ? "text-amber-700"
                : "text-slate-600"
            }`}
          >
            <span className={renewalSoon ? "font-bold" : ""}>
              {supplier.contract_renewal_date}
            </span>
            {renewalSoon && (
              <span className="ml-1.5 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                Soon
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">&mdash;</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStatus(supplier)}
            className={`rounded px-2.5 py-1 text-xs font-bold transition ${
              isSuspended
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
            }`}
            title={isSuspended ? "Activate supplier" : "Suspend supplier"}
          >
            {isSuspended ? "Activate" : "Suspend"}
          </button>
          <button
            onClick={() => onDelete(supplier.id)}
            className="rounded bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-200"
            title="Delete supplier"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}