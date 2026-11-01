import { isCandidateNote, isCandidateRecord } from "@/lib/records";
import type {
  CandidateFormData,
  CandidateNote,
  CandidateNoteInput,
  CandidatePatchData,
  CandidateRecord,
} from "@/types/records";

const DEFAULT_API_URL = "https://playground.4geeks.com/tracker/api/v1";

function apiUrl(path: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

async function ensureSuccess(response: Response) {
  if (response.ok) return;

  const responseText = await response.text();
  let detail: unknown;
  try {
    const body: unknown = JSON.parse(responseText);
    detail = isObject(body) ? body.detail : undefined;
  } catch {
    detail = undefined;
  }

  if (response.status === 422 && Array.isArray(detail)) {
    const issues = detail.filter(isObject);
    const missingFields = [...new Set(issues
      .filter((issue) => issue.type === "missing" || issue.msg === "Field required")
      .map((issue) => {
        const location = Array.isArray(issue.loc) ? issue.loc : [];
        const field = location[location.length - 1];
        return typeof field === "string" ? FIELD_LABELS[field] : undefined;
      })
      .filter((label): label is string => Boolean(label)))];

    if (missingFields.length > 0) {
      throw new Error(`Please complete the required fields: ${missingFields.join(", ")}.`);
    }

    const messages = issues.map((issue) => {
      const location = Array.isArray(issue.loc) ? issue.loc : [];
      const field = location[location.length - 1];
      const label = typeof field === "string" ? FIELD_LABELS[field] : undefined;
      const message = typeof issue.msg === "string" ? issue.msg : "Invalid value";
      return label ? `${label}: ${message}` : message;
    });
    if (messages.length > 0) {
      throw new Error(`Some candidate details are invalid: ${messages.join("; ")}.`);
    }
  }

  throw new Error(`Could not save the candidate (HTTP ${response.status}). Please check the entered information and try again.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  position: "Position",
  experience_years: "Years of experience",
  linkedin_url: "LinkedIn URL",
  cv_url: "CV URL",
};

/** POST /records — create a new candidate. */
export async function createRecord(
  data: CandidateFormData,
): Promise<CandidateRecord> {
  const response = await fetch(apiUrl("/records"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await ensureSuccess(response);

  const body: unknown = await response.json();
  const candidate = isObject(body) && "data" in body ? body.data : body;
  if (!isCandidateRecord(candidate)) {
    throw new Error("The API returned an unexpected shape after creating the candidate.");
  }
  return candidate;
}

/** PUT /records/:id — fully update an existing candidate. */
export async function updateRecord(
  id: string,
  data: CandidateFormData,
): Promise<CandidateRecord> {
  const response = await fetch(apiUrl(`/records/${encodeURIComponent(id)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await ensureSuccess(response);

  const body: unknown = await response.json();
  const candidate = isObject(body) && "data" in body ? body.data : body;
  if (!isCandidateRecord(candidate)) {
    throw new Error("The API returned an unexpected shape after updating the candidate.");
  }
  return candidate;
}

export async function patchCandidate(
  id: string,
  data: CandidatePatchData,
): Promise<void> {
  const response = await fetch(apiUrl(`/records/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await ensureSuccess(response);
}

export async function getCandidateNotesFromApi(id: string): Promise<CandidateNote[]> {
  const response = await fetch(
    apiUrl(`/records/${encodeURIComponent(id)}/notes`),
    { cache: "no-store" },
  );
  await ensureSuccess(response);

  const result: unknown = await response.json();
  if (!isObject(result) || !Array.isArray(result.data)) {
    throw new Error("The API returned an invalid notes list.");
  }

  return result.data.filter(
    (note): note is CandidateNote =>
      isObject(note) &&
      (typeof note.id === "string" || typeof note.id === "number") &&
      typeof note.content === "string" &&
      typeof note.created_at === "string" &&
      (typeof note.record_id === "string" || typeof note.record_id === "number"),
  );
}

export async function createCandidateNote(
  id: string,
  content: string,
): Promise<CandidateNote | null> {
  const payload: CandidateNoteInput = { content };
  const response = await fetch(apiUrl(`/records/${encodeURIComponent(id)}/notes`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await ensureSuccess(response);
  const body = await response.text();
  if (!body) return null;

  try {
    const result: unknown = JSON.parse(body);
    const note = isObject(result) && "data" in result ? result.data : result;
    if (isCandidateNote(note)) {
      return note as CandidateNote;
    }
  } catch {
    return null;
  }

  return null;
}

export async function deleteCandidateNote(id: string, noteId: string) {
  const response = await fetch(
    apiUrl(`/records/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`),
    { method: "DELETE" },
  );
  await ensureSuccess(response);
}