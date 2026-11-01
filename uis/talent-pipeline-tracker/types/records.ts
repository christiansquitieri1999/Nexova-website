export type CandidateId = string;

export type CandidateStatus =
  | "received"
  | "in_progress"
  | "selected"
  | "discarded";

export type CandidateStage =
  | "pending"
  | "review"
  | "personal_interview"
  | "technical_interview"
  | "offer_presented";

export type CandidateRecord = {
  id: CandidateId;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url: string | null;
  cv_url: string | null;
  status: CandidateStatus;
  stage: CandidateStage;
  experience_years: number;
  notes?: CandidateNote[];
  notes_count: number;
  applied_at: string;
  updated_at: string;
};

export type CandidateNote = {
  id: string | number;
  record_id: CandidateId;
  content: string;
  created_at: string;
};

export type CandidateNoteInput = {
  content: string;
};

export type CandidateFormData = {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  experience_years: number;
  linkedin_url?: string | null;
  cv_url?: string | null;
};

export type CandidatePatchData =
  | { status: CandidateStatus }
  | { stage: CandidateStage };

export type RecordsPageResponse = {
  data: unknown[];
  total: number;
};

export type NotesListResponse = {
  data: unknown[];
};

export type ApiEnvelope<T> = {
  data: T;
};

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  selected: "Selected",
  discarded: "Discarded",
};

export const STAGE_LABELS: Record<CandidateStage, string> = {
  pending: "Pending review",
  review: "Under review",
  personal_interview: "Personal interview",
  technical_interview: "Technical interview",
  offer_presented: "Offer presented",
};
