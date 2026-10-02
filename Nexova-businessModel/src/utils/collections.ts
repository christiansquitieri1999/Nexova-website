import type {
	AvailabilityStatus,
	Candidate,
	SeniorityLevel,
} from "../types/models";

/** Returns candidates with every required skill, comparing skill names case-insensitively. */
export function filterCandidatesBySkills(
	candidates: Candidate[],
	requiredSkills: string[],
): Candidate[] {
	if (!Array.isArray(candidates) || !Array.isArray(requiredSkills)) {
		return [];
	}

	const normalizedRequiredSkills = requiredSkills
		.filter((skill) => typeof skill === "string" && skill.trim().length > 0)
		.map((skill) => skill.trim().toLowerCase());

	return candidates.filter((candidate) => {
		if (candidate == null) {
			return false;
		}

		const candidateSkills = new Set(
			(Array.isArray(candidate.skills) ? candidate.skills : [])
				.filter((skill) => typeof skill === "string")
				.map((skill) => skill.trim().toLowerCase()),
		);

		return normalizedRequiredSkills.every((skill) => candidateSkills.has(skill));
	});
}

/** Returns candidates whose professional seniority exactly matches the requested level. */
export function filterCandidatesBySeniority(
	candidates: Candidate[],
	seniority: SeniorityLevel,
): Candidate[] {
	if (!Array.isArray(candidates)) {
		return [];
	}

	return candidates.filter(
		(candidate) => candidate != null && candidate.seniority === seniority,
	);
}

/** Returns candidates matching any allowed availability; an empty availability list matches none. */
export function filterCandidatesByAvailability(
	candidates: Candidate[],
	availability: AvailabilityStatus[],
): Candidate[] {
	if (!Array.isArray(candidates) || !Array.isArray(availability) || availability.length === 0) {
		return [];
	}

	const acceptedStatuses = new Set(availability);
	return candidates.filter(
		(candidate) => candidate != null && acceptedStatuses.has(candidate.availability),
	);
}

function sortCandidatesByNumericField(
	candidates: Candidate[],
	getValue: (candidate: Candidate) => number,
	order: "asc" | "desc",
): Candidate[] {
	if (!Array.isArray(candidates) || candidates.length === 0) {
		return [];
	}

	const direction = order === "asc" ? 1 : -1;

	// Cache valid sort keys and sort a new list, leaving the caller's array unchanged.
	return candidates
		.flatMap((candidate) => {
			if (candidate == null) {
				return [];
			}

			const value = getValue(candidate);
			return typeof value === "number" && Number.isFinite(value)
				? [{ candidate, value }]
				: [];
		})
		.sort((left, right) => direction * (left.value - right.value))
		.map(({ candidate }) => candidate);
}

/** Sorts candidates by expected salary in USD without mutating the input array. */
export function sortCandidatesBySalary(
	candidates: Candidate[],
	order: "asc" | "desc",
): Candidate[] {
	return sortCandidatesByNumericField(candidates, (candidate) => candidate.expectedSalary, order);
}

/** Sorts candidates by years of professional experience without mutating the input array. */
export function sortCandidatesByExperience(
	candidates: Candidate[],
	order: "asc" | "desc",
): Candidate[] {
	return sortCandidatesByNumericField(candidates, (candidate) => candidate.yearsOfExperience, order);
}
