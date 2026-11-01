import {
  STATUS_LABELS,
  STAGE_LABELS,
  type ApiEnvelope,
  type CandidateNote,
  type CandidateRecord,
  type CandidateStatus,
  type CandidateStage,
  type NotesListResponse,
  type RecordsPageResponse,
} from "@/types/records";

export type { CandidateNote, CandidateRecord } from "@/types/records";

const PAGE_SIZE = 100;
const DEFAULT_API_URL = "https://playground.4geeks.com/tracker/api/v1";

function apiUrl(path: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCandidateStatus(value: unknown): value is CandidateStatus {
  return typeof value === "string" && Object.hasOwn(STATUS_LABELS, value);
}

function isCandidateStage(value: unknown): value is CandidateStage {
  return typeof value === "string" && Object.hasOwn(STAGE_LABELS, value);
}

export function isCandidateNote(value: unknown): value is CandidateNote {
  return (
    isObject(value) &&
    (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.record_id === "string" &&
    typeof value.content === "string" &&
    typeof value.created_at === "string"
  );
}

export function isCandidateRecord(value: unknown): value is CandidateRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.full_name === "string" &&
    typeof value.email === "string" &&
    typeof value.phone === "string" &&
    typeof value.position === "string" &&
    (typeof value.linkedin_url === "string" || value.linkedin_url === null) &&
    (typeof value.cv_url === "string" || value.cv_url === null) &&
    isCandidateStatus(value.status) &&
    isCandidateStage(value.stage) &&
    typeof value.experience_years === "number" &&
    typeof value.notes_count === "number" &&
    typeof value.applied_at === "string" &&
    typeof value.updated_at === "string" &&
    (!Object.hasOwn(value, "notes") ||
      (Array.isArray(value.notes) && value.notes.every(isCandidateNote)))
  );
}

export async function getCandidates(): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(apiUrl(`/records?page=${page}&limit=${PAGE_SIZE}`), {
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Records request failed (${response.status})`);

    const result: unknown = await response.json();
    if (!isObject(result) || !Array.isArray(result.data)) {
      throw new Error("Records response has an invalid shape");
    }

    if (typeof result.total !== "number") {
      throw new Error("Records response has an invalid total count");
    }

    const recordsPage = result as RecordsPageResponse;
    candidates.push(...recordsPage.data.filter(isCandidateRecord));

    if (
      recordsPage.data.length === 0 ||
      candidates.length >= recordsPage.total ||
      recordsPage.data.length < PAGE_SIZE
    ) {
      return candidates;
    }

    page += 1;
  }
}

export async function getCandidate(id: string): Promise<CandidateRecord | null> {
  const response = await fetch(apiUrl(`/records/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Candidate request failed (${response.status})`);

  const result: unknown = await response.json();
  const candidate = isObject(result) && "data" in result
    ? (result as ApiEnvelope<unknown>).data
    : result;

  return isCandidateRecord(candidate) ? candidate : null;
}

export async function getCandidateNotes(id: string): Promise<CandidateNote[]> {
  const response = await fetch(
    apiUrl(`/records/${encodeURIComponent(id)}/notes`),
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error(`Notes request failed (${response.status})`);

  const result: unknown = await response.json();
  if (!isObject(result) || !Array.isArray(result.data)) {
    throw new Error("Notes response has an invalid shape");
  }

  const notesPage = result as NotesListResponse;
  return notesPage.data.filter(isCandidateNote);
}