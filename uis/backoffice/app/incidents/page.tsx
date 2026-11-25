"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  STATUS_LABELS,
  VALID_BRANCHES,
  VALID_CATEGORIES,
  VALID_ORIGINS,
  VALID_STATUSES,
  type IncidentBranch,
  type IncidentCategory,
  type IncidentFormData,
  type IncidentOrigin,
  type IncidentRecord,
  type IncidentStatus,
  type IncidentSummary,
} from "@/types/incidents";
import {
  createIncident,
  getIncidentSummary,
  getIncidents,
  updateIncidentStatus,
  type FieldError,
} from "@/lib/incident-manager";

// =========================================================================
// Reusable helpers
// =========================================================================

function statusColor(status: IncidentStatus): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800";
    case "resolved":
      return "bg-emerald-100 text-emerald-800";
    case "discarded":
      return "bg-slate-100 text-slate-600";
  }
}

function badge(text: string, colorClass: string) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${colorClass}`}
    >
      {text}
    </span>
  );
}

function LoadingBox({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center font-semibold text-emerald-900"
    >
      {label}...
    </div>
  );
}

function ApiError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <p className="text-sm font-semibold text-red-900">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-lg font-bold text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

// =========================================================================
// Main page
// =========================================================================

type Tab = "register" | "list" | "summary";

export default function IncidentsPage() {
  const [tab, setTab] = useState<Tab>("list");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Nexova backoffice home"
          >
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
            &larr; Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-slate-950 px-5 py-9 text-white sm:px-9">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Operations &middot; Incident manager
          </p>
          <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold sm:text-5xl">
                Centralised incident manager
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Register, track, and analyse incidents from any Nexova office.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
        <nav className="flex gap-1 border-b border-slate-200" role="tablist">
          {[
            { id: "list" as Tab, label: "Incidents" },
            { id: "register" as Tab, label: "New incident" },
            { id: "summary" as Tab, label: "Summary" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-5 py-2.5 text-sm font-bold transition ${
                tab === t.id
                  ? "bg-white text-emerald-900 shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 lg:px-8">
        {tab === "register" && <RegisterPanel />}
        {tab === "list" && <ListPanel />}
        {tab === "summary" && <SummaryPanel />}
      </div>
    </main>
  );
}

// =========================================================================
// Register panel
// =========================================================================

function RegisterPanel() {
  const [form, setForm] = useState<IncidentFormData>({
    title: "",
    description: "",
    category: "technical_failure",
    origin: "branch",
    branch: "central",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  function handleField<K extends keyof IncidentFormData>(
    field: K,
    value: IncidentFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error when the user edits
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError("");
    if (success) setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGeneralError("");
    setFieldErrors({});
    setSuccess(false);

    try {
      await createIncident(form);
      // success
      setForm({
        title: "",
        description: "",
        category: "technical_failure",
        origin: "branch",
        branch: "central",
      });
      setSuccess(true);
      titleRef.current?.focus();
    } catch (caught) {
      if (caught instanceof Error && "fieldErrors" in caught) {
        const fe: Record<string, string> = {};
        for (const f of (caught as Error & { fieldErrors: FieldError[] })
          .fieldErrors) {
          fe[f.field] = f.message;
        }
        setFieldErrors(fe);
      } else {
        setGeneralError(
          caught instanceof Error
            ? caught.message
            : "An unexpected error occurred. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-lg font-bold text-emerald-900">
          Incident registered successfully
        </p>
        <p className="mt-2 text-sm text-emerald-700">
          The incident has been saved and is now visible in the list.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => setSuccess(false)}
            className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Register another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* General error */}
      {generalError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
        >
          {generalError}
        </div>
      )}

      {/* Title */}
      <TextField
        label="Title *"
        value={form.title}
        maxLength={120}
        placeholder="Brief summary of the incident"
        error={fieldErrors.title}
        onChange={(v) => handleField("title", v)}
        ref={titleRef}
      />

      {/* Description */}
      <TextAreaField
        label="Description *"
        value={form.description}
        maxLength={10000}
        placeholder="Detailed description of what happened and any relevant context"
        error={fieldErrors.description}
        onChange={(v) => handleField("description", v)}
      />

      {/* Category */}
      <SelectField
        label="Category *"
        value={form.category}
        error={fieldErrors.category}
        onChange={(v) => handleField("category", v as IncidentCategory)}
        options={VALID_CATEGORIES.map((c) => ({
          value: c,
          label: CATEGORY_LABELS[c],
        }))}
      />

      {/* Origin */}
      <SelectField
        label="Origin *"
        value={form.origin}
        error={fieldErrors.origin}
        onChange={(v) => handleField("origin", v as IncidentOrigin)}
        options={VALID_ORIGINS.map((o) => ({
          value: o,
          label: ORIGIN_LABELS[o],
        }))}
      />

      {/* Branch — always visible, highlighted when origin is "branch" */}
      <SelectField
        label="Branch *"
        value={form.branch}
        error={fieldErrors.branch}
        onChange={(v) => handleField("branch", v as IncidentBranch)}
        options={VALID_BRANCHES.map((b) => ({
          value: b,
          label: BRANCH_LABELS[b],
        }))}
        highlight={form.origin === "branch"}
        hint={
          form.origin === "branch"
            ? "You are reporting from a specific Nexova location"
            : undefined
        }
      />

      {/* Submit */}
      <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Registering\u2026" : "Register incident"}
        </button>
      </div>
    </form>
  );
}

// =========================================================================
// List panel
// =========================================================================

interface ListPanelState {
  incidents: IncidentRecord[];
  loading: boolean;
  error: string;
  filterStatus: string;
  filterOrigin: string;
  filterBranch: string;
  filterCategory: string;
  updatingId: string | null;
  notification: string;
}

type ListPanelAction =
  | { kind: "set-incidents"; incidents: IncidentRecord[] }
  | { kind: "set-loading"; loading: boolean }
  | { kind: "set-error"; error: string }
  | { kind: "set-filter"; field: string; value: string }
  | { kind: "update-incident"; incident: IncidentRecord }
  | { kind: "set-updating"; id: string | null }
  | { kind: "set-notification"; message: string };

function listReducer(
  state: ListPanelState,
  action: ListPanelAction,
): ListPanelState {
  switch (action.kind) {
    case "set-incidents":
      return { ...state, incidents: action.incidents };
    case "set-loading":
      return { ...state, loading: action.loading };
    case "set-error":
      return { ...state, error: action.error };
    case "set-filter":
      return { ...state, [action.field]: action.value };
    case "update-incident":
      return {
        ...state,
        incidents: state.incidents.map((i) =>
          i.id === action.incident.id ? action.incident : i,
        ),
      };
    case "set-updating":
      return { ...state, updatingId: action.id };
    case "set-notification":
      return { ...state, notification: action.message };
  }
}

const LIST_INITIAL: ListPanelState = {
  incidents: [],
  loading: true,
  error: "",
  filterStatus: "",
  filterOrigin: "",
  filterBranch: "",
  filterCategory: "",
  updatingId: null,
  notification: "",
};

function ListPanel() {
  const [state, dispatch] = useReducer(listReducer, LIST_INITIAL);

  const loadIncidents = useCallback(async () => {
    dispatch({ kind: "set-loading", loading: true });
    dispatch({ kind: "set-error", error: "" });
    try {
      const incidents = await getIncidents({
        status: (state.filterStatus || undefined) as
          | IncidentStatus
          | undefined,
        origin: state.filterOrigin || undefined,
        branch: state.filterBranch || undefined,
        category: state.filterCategory || undefined,
      });
      dispatch({ kind: "set-incidents", incidents });
    } catch (caught) {
      dispatch({
        kind: "set-error",
        error:
          caught instanceof Error
            ? caught.message
            : "Could not load incidents.",
      });
    } finally {
      dispatch({ kind: "set-loading", loading: false });
    }
  }, [
    state.filterStatus,
    state.filterOrigin,
    state.filterBranch,
    state.filterCategory,
  ]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const filtered = state.incidents;

  async function handleStatusChange(
    incident: IncidentRecord,
    newStatus: IncidentStatus,
  ) {
    dispatch({
      kind: "update-incident",
      incident: { ...incident, status: newStatus },
    });
    dispatch({ kind: "set-updating", id: incident.id });
    dispatch({ kind: "set-notification", message: "" });
    try {
      const updated = await updateIncidentStatus(incident.id, newStatus);
      dispatch({ kind: "update-incident", incident: updated });
    } catch {
      dispatch({ kind: "update-incident", incident });
      dispatch({
        kind: "set-notification",
        message:
          "Status update failed. The previous status has been restored.",
      });
    } finally {
      dispatch({ kind: "set-updating", id: null });
    }
  }

  // Auto-clear notification after 5 seconds
  useEffect(() => {
    if (!state.notification) return;
    const timer = setTimeout(
      () => dispatch({ kind: "set-notification", message: "" }),
      5000,
    );
    return () => clearTimeout(timer);
  }, [state.notification]);

  return (
    <div className="space-y-6">
      {/* Notification */}
      {state.notification && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          {state.notification}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <FilterSelect
          label="Status"
          value={state.filterStatus}
          options={[
            { value: "", label: "All statuses" },
            ...VALID_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
          ]}
          onChange={(v) =>
            dispatch({ kind: "set-filter", field: "filterStatus", value: v })
          }
        />
        <FilterSelect
          label="Origin"
          value={state.filterOrigin}
          options={[
            { value: "", label: "All origins" },
            ...VALID_ORIGINS.map((o) => ({
              value: o,
              label: ORIGIN_LABELS[o],
            })),
          ]}
          onChange={(v) =>
            dispatch({ kind: "set-filter", field: "filterOrigin", value: v })
          }
        />
        <FilterSelect
          label="Branch"
          value={state.filterBranch}
          options={[
            { value: "", label: "All branches" },
            ...VALID_BRANCHES.map((b) => ({
              value: b,
              label: BRANCH_LABELS[b],
            })),
          ]}
          onChange={(v) =>
            dispatch({ kind: "set-filter", field: "filterBranch", value: v })
          }
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
          onChange={(v) =>
            dispatch({
              kind: "set-filter",
              field: "filterCategory",
              value: v,
            })
          }
        />
      </div>

      {/* Loading */}
      {state.loading && <LoadingBox label="Loading incidents" />}

      {/* Error */}
      {!state.loading && state.error && (
        <ApiError message={state.error} onRetry={loadIncidents} />
      )}

      {/* Empty */}
      {!state.loading && !state.error && filtered.length === 0 && (
        <EmptyState
          title="No incidents found"
          description={
            state.incidents.length === 0
              ? 'There are no registered incidents yet. Register the first one from the "New incident" tab.'
              : "No incidents match the selected filters. Try adjusting them."
          }
        />
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Origin</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((incident) => (
                <tr
                  key={incident.id}
                  className="transition hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">
                        {incident.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                        {incident.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {badge(
                      CATEGORY_LABELS[incident.category] || incident.category,
                      "bg-indigo-100 text-indigo-800",
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {ORIGIN_LABELS[incident.origin] || incident.origin}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {BRANCH_LABELS[incident.branch] || incident.branch}
                  </td>
                  <td className="px-5 py-4">
                    {badge(
                      STATUS_LABELS[incident.status] || incident.status,
                      statusColor(incident.status),
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {new Date(incident.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <StatusActions
                      current={incident.status}
                      updating={state.updatingId === incident.id}
                      onChange={(newStatus) =>
                        handleStatusChange(incident, newStatus)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusActions({
  current,
  updating,
  onChange,
}: {
  current: IncidentStatus;
  updating: boolean;
  onChange: (status: IncidentStatus) => void;
}) {
  const transitions: Record<IncidentStatus, IncidentStatus[]> = {
    open: ["in_progress", "discarded"],
    in_progress: ["resolved", "discarded"],
    resolved: [],
    discarded: [],
  };

  const allowed = transitions[current] ?? [];

  if (allowed.length === 0) {
    return (
      <span className="text-xs text-slate-400">
        {current === "resolved" || current === "discarded"
          ? "Final state"
          : "\u2014"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {allowed.map((target) => (
        <button
          key={target}
          disabled={updating}
          onClick={() => onChange(target)}
          className={`rounded px-2 py-1 text-xs font-bold transition disabled:cursor-wait disabled:opacity-50 ${
            target === "discarded"
              ? "bg-red-100 text-red-800 hover:bg-red-200"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          }`}
        >
          {updating ? "\u2026" : STATUS_LABELS[target]}
        </button>
      ))}
    </div>
  );
}

// =========================================================================
// Summary panel
// =========================================================================

interface SummaryPanelState {
  summary: IncidentSummary | null;
  loading: boolean;
  error: string;
}

type SummaryPanelAction =
  | { kind: "set-summary"; summary: IncidentSummary }
  | { kind: "set-loading"; loading: boolean }
  | { kind: "set-error"; error: string };

function summaryReducer(
  state: SummaryPanelState,
  action: SummaryPanelAction,
): SummaryPanelState {
  switch (action.kind) {
    case "set-summary":
      return { ...state, summary: action.summary };
    case "set-loading":
      return { ...state, loading: action.loading };
    case "set-error":
      return { ...state, error: action.error };
  }
}

const SUMMARY_INITIAL: SummaryPanelState = {
  summary: null,
  loading: true,
  error: "",
};

function SummaryPanel() {
  const [state, dispatch] = useReducer(summaryReducer, SUMMARY_INITIAL);

  const loadSummary = useCallback(async () => {
    dispatch({ kind: "set-loading", loading: true });
    dispatch({ kind: "set-error", error: "" });
    try {
      const summary = await getIncidentSummary();
      dispatch({ kind: "set-summary", summary });
    } catch (caught) {
      dispatch({
        kind: "set-error",
        error:
          caught instanceof Error
            ? caught.message
            : "Could not load summary.",
      });
    } finally {
      dispatch({ kind: "set-loading", loading: false });
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (state.loading) {
    return <LoadingBox label="Loading summary" />;
  }

  if (state.error) {
    return <ApiError message={state.error} onRetry={loadSummary} />;
  }

  const s = state.summary;
  if (!s) return null;

  const total = s.total;

  function barData(
    counts: Record<string, number>,
    labelMap: Record<string, string>,
  ) {
    const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
    return entries.map(([key, count]) => ({
      label: labelMap[key] || key,
      count,
      percentage: total === 0 ? 0 : (count / total) * 100,
    }));
  }

  return (
    <div className="space-y-8">
      {/* Total card */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
          Total incidents
        </p>
        <p className="mt-2 text-5xl font-bold tabular-nums text-emerald-900">
          {total}
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          Registries across all statuses, categories, and origins
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="By status"
          items={barData(s.by_status, STATUS_LABELS)}
        />
        <BarList
          title="By category"
          items={barData(s.by_category, CATEGORY_LABELS)}
        />
        <BarList
          title="By origin"
          items={barData(s.by_origin, ORIGIN_LABELS)}
        />
        <BarList
          title="By branch"
          items={barData(s.by_branch, BRANCH_LABELS)}
        />
      </div>
    </div>
  );
}

// =========================================================================
// Reusable form field components
// =========================================================================

const TextField = ({
  label,
  value,
  maxLength,
  placeholder,
  error,
  onChange,
  ref,
}: {
  label: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-bold text-slate-700">
      {label}
    </span>
    <input
      ref={ref}
      required
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 ${
        error
          ? "border-red-400 focus:border-red-600 focus:ring-red-600"
          : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
      }`}
    />
    {error && (
      <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
    )}
  </label>
);

const TextAreaField = ({
  label,
  value,
  maxLength,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-bold text-slate-700">
      {label}
    </span>
    <textarea
      required
      rows={4}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 ${
        error
          ? "border-red-400 focus:border-red-600 focus:ring-red-600"
          : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
      }`}
    />
    {error && (
      <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
    )}
  </label>
);

const SelectField = ({
  label,
  value,
  error,
  onChange,
  options,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  highlight?: boolean;
  hint?: string;
}) => (
  <label
    className={`block rounded-lg p-3 transition ${
      highlight ? "bg-amber-50 ring-2 ring-amber-300" : ""
    }`}
  >
    <span className="mb-1.5 block text-sm font-bold text-slate-700">
      {label}
    </span>
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 ${
        error
          ? "border-red-400 focus:border-red-600 focus:ring-red-600"
          : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {error && (
      <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
    )}
    {hint && (
      <p className="mt-1 text-xs font-medium text-amber-700">{hint}</p>
    )}
  </label>
);

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

// ---------------------------------------------------------------------------
// BarList component
// ---------------------------------------------------------------------------

function BarList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; percentage: number }>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No data available.</p>
        ) : (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-slate-700">
                  {item.label}
                </span>
                <span className="font-mono text-slate-500">
                  {item.count}
                  {item.percentage === 0
                    ? ""
                    : ` \u00b7 ${item.percentage.toFixed(1)}%`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.percentage))}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}