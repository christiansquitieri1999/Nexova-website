"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  STATUS_LABELS,
  STAGE_LABELS,
  type CandidateNote,
  type CandidateRecord,
  type CandidateStatus,
  type CandidateStage,
} from "@/types/records";
import {
  createCandidateNote,
  deleteCandidateNote,
  getCandidateNotesFromApi,
  patchCandidate,
} from "@/lib/record-actions";

type Props = {
  candidate: CandidateRecord;
  initialNotes: CandidateNote[];
  notesError: boolean;
};

const STATUS_OPTIONS: CandidateStatus[] = [
  "received",
  "in_progress",
  "selected",
  "discarded",
];
const STAGE_OPTIONS: CandidateStage[] = [
  "pending",
  "review",
  "personal_interview",
  "technical_interview",
  "offer_presented",
];

function formatDate(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function ExternalValue({ value }: { value: unknown }) {
  if (typeof value !== "string" || value.trim() === "") {
    return <span className="text-zinc-400">Not provided</span>;
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="break-all font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
    >
      Open link
    </a>
  );
}

export default function CandidateDetails({
  candidate: initialCandidate,
  initialNotes,
  notesError,
}: Props) {
  const router = useRouter();
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [savingField, setSavingField] = useState<"status" | "stage" | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noteLoadFailed, setNoteLoadFailed] = useState(notesError);

  async function updateField(field: "status" | "stage", value: string) {
    setError("");
    setNotice("");
    setSavingField(field);
    try {
      const payload = field === "status"
        ? { status: value as CandidateStatus }
        : { stage: value as CandidateStage };
      await patchCandidate(candidate.id, payload);
      if (field === "status") {
        const statusValue = value as CandidateStatus;
        setCandidate((current) => ({ ...current, status: statusValue }));
        setNotice(`Status updated to ${STATUS_LABELS[statusValue]}.`);
      } else {
        const stageValue = value as CandidateStage;
        setCandidate((current) => ({ ...current, stage: stageValue }));
        setNotice(`Process stage updated to ${STAGE_LABELS[stageValue]}.`);
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update this professional profile.");
    } finally {
      setSavingField(null);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = noteText.trim();
    if (!content || noteBusy) return;

    setError("");
    setNotice("");
    setNoteBusy(true);
    try {
      const note = await createCandidateNote(String(candidate.id), content);
      if (note) {
        setNotes((current) => [note, ...current]);
      } else {
        setNotes(await getCandidateNotesFromApi(String(candidate.id)));
      }
      setNoteText("");
      setNoteLoadFailed(false);
      setNotice("Note added.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add note.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function removeNote(note: CandidateNote) {
    if (!window.confirm("Delete this note? This action cannot be undone.")) return;

    setError("");
    setNotice("");
    setNoteBusy(true);
    setDeletingNoteId(String(note.id));
    try {
      await deleteCandidateNote(String(candidate.id), String(note.id));
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setNotice("Note deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete note.");
    } finally {
      setNoteBusy(false);
      setDeletingNoteId(null);
    }
  }

  const status = candidate.status;
  const stage = candidate.stage;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Nexova People &amp; Talent</p>
            <h1 className="text-3xl font-semibold text-zinc-950">
              {candidate.full_name}
            </h1>
          </div>
          <Link
            href={`/candidates/${encodeURIComponent(String(candidate.id))}/edit`}
            className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
          >
            Edit
          </Link>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        )}
        {savingField && (
          <p role="status" className="mt-3 text-sm text-zinc-600">
            Updating {savingField === "status" ? "status" : "process stage"}…
          </p>
        )}

        <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
          <DetailField label="Full name" value={candidate.full_name} />
          <DetailField label="Email" value={candidate.email} email />
          <DetailField label="Phone" value={candidate.phone} phone />
          <DetailField label="Position applied for" value={candidate.position} />
          <div className="min-w-0 bg-white px-5 py-4">
            <dt className="text-xs font-semibold uppercase text-zinc-500">LinkedIn</dt>
            <dd className="mt-2 text-sm"><ExternalValue value={candidate.linkedin_url} /></dd>
          </div>
          <div className="min-w-0 bg-white px-5 py-4">
            <dt className="text-xs font-semibold uppercase text-zinc-500">CV</dt>
            <dd className="mt-2 text-sm"><ExternalValue value={candidate.cv_url} /></dd>
          </div>
          <DetailField label="Years of experience" value={candidate.experience_years} />
          <div className="min-w-0 bg-white px-5 py-4">
            <dt className="text-xs font-semibold uppercase text-zinc-500">Status</dt>
            <dd className="mt-2">
              <select
                aria-label="Update professional status"
                value={status}
                disabled={savingField !== null}
                onChange={(event) => void updateField("status", event.target.value)}
                className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}
              </select>
            </dd>
          </div>
          <div className="min-w-0 bg-white px-5 py-4">
            <dt className="text-xs font-semibold uppercase text-zinc-500">Current stage</dt>
            <dd className="mt-2">
              <select
                aria-label="Update professional process stage"
                value={stage}
                disabled={savingField !== null}
                onChange={(event) => void updateField("stage", event.target.value)}
                className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60"
              >
                {STAGE_OPTIONS.map((option) => <option key={option} value={option}>{STAGE_LABELS[option]}</option>)}
              </select>
            </dd>
          </div>
          <DetailField label="Application date" value={formatDate(candidate.applied_at)} />
        </dl>
      </section>

      <section aria-labelledby="notes-heading" className="border-t border-zinc-200 pt-7">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="notes-heading" className="text-xl font-semibold text-zinc-950">Notes</h2>
          <span className="text-sm text-zinc-500">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
        </div>

        {noteLoadFailed ? (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Notes could not be loaded. Refresh the page to try again.
          </div>
        ) : notes.length === 0 ? (
          <p className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">No notes yet.</p>
        ) : (
          <ul className="mb-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {notes.map((note) => (
              <li key={String(note.id)} className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">{note.content}</p>
                  <time className="mt-2 block text-xs text-zinc-500" dateTime={note.created_at}>{formatDate(note.created_at)}</time>
                </div>
                <button
                  type="button"
                  aria-label={deletingNoteId === String(note.id) ? "Deleting note" : "Delete note"}
                  disabled={noteBusy}
                  onClick={() => void removeNote(note)}
                  className="shrink-0 rounded-md p-2 text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30 disabled:opacity-50"
                >
                  {deletingNoteId === String(note.id) ? "Deleting…" : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addNote} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <label htmlFor="new-note" className="block text-sm font-medium text-zinc-800">Add a note</label>
          <textarea
            id="new-note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            rows={3}
            maxLength={4000}
            required
            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={noteBusy || noteText.trim().length === 0}
              className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {noteBusy && deletingNoteId === null ? "Saving…" : "Add note"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DetailField({
  label,
  value,
  email = false,
  phone = false,
}: {
  label: string;
  value: unknown;
  email?: boolean;
  phone?: boolean;
}) {
  const text = value === null || value === undefined || value === "" ? "Not provided" : String(value);
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-2 break-words text-sm text-zinc-900">
        {email && text !== "Not provided" ? <a href={`mailto:${text}`} className="text-emerald-800 hover:underline">{text}</a>
          : phone && text !== "Not provided" ? <a href={`tel:${text}`} className="text-emerald-800 hover:underline">{text}</a>
            : text}
      </dd>
    </div>
  );
}