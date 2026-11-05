"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef } from "react";
import CandidateForm from "@/components/candidates/candidate-form";
import { createRecord } from "@/lib/record-actions";
import SearchContext from "@/components/search-context";
import useAsyncAction from "@/hooks/use-async-action";
import type { CandidateFormData, CandidateRecord } from "@/types/records";

export default function NewCandidatePage() {
  const router = useRouter();
  const action = useAsyncAction<CandidateRecord>();
  const redirecting = useRef(false);

  async function handleSubmit(data: CandidateFormData) {
    const created = await action.run(
      () => createRecord(data),
      "Professional added successfully.",
    );
    if (!created) return;

    redirecting.current = true;
    setTimeout(() => {
      router.push(`/candidates/${encodeURIComponent(created.id)}`);
    }, 1200);
  }

  function handleSuccessClear() {
    if (!redirecting.current) action.clearSuccess();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8">
      <header className="mb-8 border-b border-zinc-200 pb-5">
        <Link
          href="/"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Executive Assistant search
        </Link>
        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Nexova People &amp; Talent
        </p>
        <h1 className="text-3xl font-semibold text-zinc-950">
          Add professional
        </h1>
      </header>

      <SearchContext />
      <CandidateForm
        onSubmit={handleSubmit}
        busy={action.loading}
        serverError={action.error}
        successMessage={action.success}
        onSuccessClear={handleSuccessClear}
      />
    </main>
  );
}