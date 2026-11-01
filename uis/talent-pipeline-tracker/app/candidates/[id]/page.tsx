import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate, getCandidateNotes } from "@/lib/records";
import SearchContext from "@/components/search-context";
import type { CandidateNote } from "@/types/records";
import CandidateDetails from "./candidate-details";

export default async function CandidatePage({
  params,
}: PageProps<"/candidates/[id]">) {
  const { id } = await params;
  let candidate;
  let initialNotes: CandidateNote[] = [];
  let notesError = false;

  try {
    candidate = await getCandidate(id);
  } catch {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8">
        <Link href="/" className="text-sm font-medium text-emerald-800 hover:underline">← Executive Assistant search</Link>
        <div role="alert" className="mt-8 rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 size-10 text-red-500" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-lg font-semibold text-red-900">Connection error</p>
          <p className="mt-1 text-sm text-red-700">
            This professional profile could not be loaded. Please check the API connection and try again.
          </p>
        </div>
      </main>
    );
  }

  if (!candidate) notFound();

  try {
    initialNotes = await getCandidateNotes(id);
  } catch {
    notesError = true;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8">
      <header className="mb-8 border-b border-zinc-200 pb-5">
        <Link href="/" className="text-sm font-medium text-emerald-800 hover:underline">← Executive Assistant search</Link>
      </header>

      <SearchContext />
      <section>
        <CandidateDetails candidate={candidate} initialNotes={initialNotes} notesError={notesError} />
      </section>
    </main>
  );
}