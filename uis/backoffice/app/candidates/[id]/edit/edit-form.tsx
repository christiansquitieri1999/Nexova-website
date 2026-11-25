"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import CandidateForm from "@/components/candidates/candidate-form";
import { updateRecord } from "@/lib/record-actions";
import SearchContext from "@/components/search-context";
import useAsyncAction from "@/hooks/use-async-action";
import type { CandidateFormData, CandidateRecord } from "@/types/records";

type Props = {
  candidate: CandidateRecord;
};

export default function EditForm({ candidate }: Props) {
  const router = useRouter();
  const action = useAsyncAction<CandidateRecord>();

  async function handleSubmit(data: CandidateFormData) {
    const updated = await action.run(
      () => updateRecord(candidate.id, data),
      "Professional profile updated successfully.",
    );
    if (updated) router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8">
      <header className="mb-8 border-b border-zinc-200 pb-5">
        <Link
          href={`/candidates/${encodeURIComponent(String(candidate.id))}`}
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to professional profile
        </Link>
        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Nexova People &amp; Talent
        </p>
        <h1 className="text-3xl font-semibold text-zinc-950">
          Edit professional profile
        </h1>
      </header>

      <SearchContext />
      <CandidateForm
        candidate={candidate}
        onSubmit={handleSubmit}
        busy={action.loading}
        serverError={action.error}
        successMessage={action.success}
        onSuccessClear={action.clearSuccess}
      />
    </main>
  );
}