import type { Candidate, Vacancy } from "../types/models";

/** Applies the context's basic email rule: one @, a non-empty local/domain part, and a final dot suffix. */
export function isValidEmail(email: string): boolean {
	if (typeof email !== "string" || /\s/.test(email)) {
		return false;
	}

	const atIndex = email.indexOf("@");
	const dotIndex = email.lastIndexOf(".");

	return (
		atIndex > 0 &&
		atIndex === email.lastIndexOf("@") &&
		dotIndex > atIndex + 1 &&
		dotIndex < email.length - 1
	);
}

/** Collects every candidate rule violation so callers can show all corrections at once. */
export function validateCandidate(
	candidate: Candidate,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (candidate === null || typeof candidate !== "object") {
		return { valid: false, errors: ["Candidate is required."] };
	}

	if (
		!Number.isFinite(candidate.yearsOfExperience) ||
		candidate.yearsOfExperience < 0 ||
		candidate.yearsOfExperience > 50
	) {
		errors.push("Years of experience must be between 0 and 50.");
	}

	if (!Number.isFinite(candidate.currentSalary) || candidate.currentSalary <= 0) {
		errors.push("Current salary must be greater than 0.");
	}

	if (!Number.isFinite(candidate.expectedSalary) || candidate.expectedSalary <= 0) {
		errors.push("Expected salary must be greater than 0.");
	}

	if (
		!Array.isArray(candidate.skills) ||
		!candidate.skills.some(
			(skill) => typeof skill === "string" && skill.trim().length > 0,
		)
	) {
		errors.push("At least one skill is required.");
	}

	if (!isValidEmail(candidate.email)) {
		errors.push("Email must be a valid email address.");
	}

	if (typeof candidate.phone !== "string" || candidate.phone.trim().length === 0) {
		errors.push("Phone must not be empty.");
	}

	return { valid: errors.length === 0, errors };
}

/** Checks vacancy-specific bounds, including that each maximum is not below its minimum. */
export function validateVacancy(
	vacancy: Vacancy,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (vacancy === null || typeof vacancy !== "object") {
		return { valid: false, errors: ["Vacancy is required."] };
	}

	if (
		!Array.isArray(vacancy.requiredSkills) ||
		!vacancy.requiredSkills.some(
			(skill) => typeof skill === "string" && skill.trim().length > 0,
		)
	) {
		errors.push("At least one required skill is required.");
	}

	if (
		!Number.isFinite(vacancy.minYearsExperience) ||
		vacancy.minYearsExperience < 0
	) {
		errors.push("Minimum years of experience must be greater than or equal to 0.");
	}

	if (
		!Number.isFinite(vacancy.maxYearsExperience) ||
		!Number.isFinite(vacancy.minYearsExperience) ||
		vacancy.maxYearsExperience < vacancy.minYearsExperience
	) {
		errors.push("Maximum years of experience must be at least the minimum.");
	}

	if (!Number.isFinite(vacancy.salaryRangeMin) || vacancy.salaryRangeMin <= 0) {
		errors.push("Minimum salary must be greater than 0.");
	}

	if (!Number.isFinite(vacancy.salaryRangeMax) || vacancy.salaryRangeMax <= 0) {
		errors.push("Maximum salary must be greater than 0.");
	}

	if (
		Number.isFinite(vacancy.salaryRangeMin) &&
		Number.isFinite(vacancy.salaryRangeMax) &&
		vacancy.salaryRangeMax < vacancy.salaryRangeMin
	) {
		errors.push("Maximum salary must be at least the minimum salary.");
	}

	return { valid: errors.length === 0, errors };
}
