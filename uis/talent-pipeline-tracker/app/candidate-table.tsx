"use client";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useCallback, type ChangeEvent } from "react";
import SearchContext from "@/components/search-context";
import {
  STATUS_LABELS,
  STAGE_LABELS,
  type CandidateRecord,
  type CandidateStatus,
  type CandidateStage,
} from "@/types/records";

type Props = {
  candidates: CandidateRecord[];
};

function displayName(candidate: CandidateRecord): string {
  return candidate.full_name;
}

function statusColor(status: CandidateStatus): string {
  if (status === "selected") return "bg-emerald-50 text-emerald-800";
  if (status === "in_progress") return "bg-amber-50 text-amber-800";
  if (status === "discarded") return "bg-red-50 text-red-800";
  return "bg-zinc-50 text-zinc-700";
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];
const STAGE_OPTIONS = [
  { value: "", label: "All stages" },
  ...Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label })),
];

export default function CandidateTable({ candidates }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentStatus = searchParams.get("status") ?? "";
  const currentStage = searchParams.get("stage") ?? "";
  const [query, setQuery] = useState("");

  const handleFilter = useCallback(
    (key: "status" | "stage", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return candidates.filter((c) => {
      // status filter
      const statusVal = String(c.status ?? "").toLowerCase();
      if (currentStatus && statusVal !== currentStatus.toLowerCase()) {
        return false;
      }
      const stageVal = String(c.stage ?? "").toLowerCase();
      if (currentStage && stageVal !== currentStage.toLowerCase()) {
        return false;
      }
      // text search
      if (q) {
        const name = displayName(c).toLowerCase();
        const email = String(c.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, currentStatus, currentStage, query]);

  return (
    <section>
      <SearchContext />
      {/* Filters bar */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Nexova People &amp; Talent
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950">
            Executive Assistant search
          </h1>
        </div>
        {!query && !currentStatus && !currentStage && (
          <p className="text-sm text-zinc-500">
            {candidates.length} professionals
          </p>
        )}
      </div>

      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Search professionals by name or email…"
            value={query}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            aria-label="Search professionals by name or email"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleFilter("status", opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                currentStatus === opt.value
                  ? "bg-emerald-700 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <span>Stage</span>
          <select
            aria-label="Filter by process stage"
            value={currentStage}
            onChange={(event) => handleFilter("stage", event.target.value as CandidateStage | "")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
          No professionals match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Professional
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Process stage
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((candidate) => (
                  <tr
                    key={String(candidate.id)}
                    className="hover:bg-zinc-50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/candidates/${encodeURIComponent(String(candidate.id))}`}
                        className="font-medium text-zinc-900 hover:text-emerald-800"
                      >
                        {displayName(candidate)}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">
                        {candidate.email}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {candidate.position}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {STAGE_LABELS[candidate.stage]}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(candidate.status)}`}
                      >
                        {STATUS_LABELS[candidate.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/candidates/${encodeURIComponent(String(candidate.id))}`}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                        aria-label={`View details for ${String(displayName(candidate))}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-5"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
            Showing {filtered.length} of {candidates.length} professionals
          </p>
        </div>
      )}
    </section>
  );
}