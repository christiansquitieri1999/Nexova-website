import Link from "next/link";
import { Suspense } from "react";
import { getCandidates } from "@/lib/records";
import type { CandidateRecord } from "@/types/records";
import CandidateTable from "./candidate-table";

export default async function Home() {
  let candidates: CandidateRecord[] = [];
  let loadError = false;

  try {
    candidates = await getCandidates();
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-10 flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Nexova People and Talent home">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
            NX
          </span>
          <span className="text-sm font-semibold text-zinc-900">
            Nexova People &amp; Talent
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
          <Link href="/business-model" className="text-sm font-semibold text-emerald-800 hover:underline">
            Business Model
          </Link>
          <Link
            href="/candidates/new"
            className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
          >
            + Add professional
          </Link>
          <span className="hidden text-sm text-zinc-500 sm:inline">Executive Assistant</span>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 size-10 text-red-500"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-lg font-semibold text-red-900">
            Connection error
          </p>
          <p className="mt-1 text-sm text-red-700">
            Professional profiles could not be loaded. Please check the API connection and
            try again.
          </p>
        </div>
      ) : (
        <Suspense>
          <CandidateTable candidates={candidates} />
        </Suspense>
      )}
    </main>
  );
}
