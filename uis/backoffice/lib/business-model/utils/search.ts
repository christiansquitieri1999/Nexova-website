import type { Candidate } from "../types/models";

/** Searches an unsorted candidate list by exact ID and returns null when no candidate matches. */
export function findCandidateById(
	candidates: Array<Candidate | null> | null,
	id: string | null,
): Candidate | null {
	if (!Array.isArray(candidates) || typeof id !== "string") {
		return null;
	}

	for (const candidate of candidates) {
		if (candidate != null && candidate.id === id) {
			return candidate;
		}
	}

	return null;
}

/** Searches an unsorted candidate list by email, ignoring letter case and surrounding whitespace. */
export function findCandidateByEmail(
	candidates: Array<Candidate | null> | null,
	email: string | null,
): Candidate | null {
	if (!Array.isArray(candidates) || typeof email !== "string") {
		return null;
	}

	const normalizedEmail = email.trim().toLowerCase();
	if (normalizedEmail.length === 0) {
		return null;
	}

	for (const candidate of candidates) {
		if (
			candidate != null &&
			typeof candidate.email === "string" &&
			candidate.email.trim().toLowerCase() === normalizedEmail
		) {
			return candidate;
		}
	}

	return null;
}

/**
 * Searches by expected salary in an array sorted in ascending order; returns the original index,
 * or -1 when the target is absent or the input cannot satisfy binary search's sorted-data assumption.
 */
export function binarySearchCandidateBySalary(
	sortedCandidates: Array<Candidate | null> | null,
	targetSalary: number,
): number {
	if (
		!Array.isArray(sortedCandidates) ||
		sortedCandidates.length === 0 ||
		!Number.isFinite(targetSalary)
	) {
		return -1;
	}

	let lowerIndex = 0;
	let upperIndex = sortedCandidates.length - 1;

	while (lowerIndex <= upperIndex) {
		const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
		const candidate = sortedCandidates[middleIndex];

		// A null or invalid salary breaks the required ascending sequence, so its index is not searchable.
		if (candidate == null || !Number.isFinite(candidate.expectedSalary)) {
			return -1;
		}

		if (candidate.expectedSalary === targetSalary) {
			return middleIndex;
		}

		if (candidate.expectedSalary < targetSalary) {
			lowerIndex = middleIndex + 1;
		} else {
			upperIndex = middleIndex - 1;
		}
	}

	return -1;
}
