import type {
	Candidate,
	CandidateStatus,
	EnglishLevel,
	SelectionProcess,
	SeniorityLevel,
	Vacancy,
} from "../types/models";

function normalizeSkillSet(skills: string[]): Set<string> {
	return new Set(
		skills
			.filter((skill) => typeof skill === "string" && skill.trim().length > 0)
			.map((skill) => skill.trim().toLowerCase()),
	);
}

/** Scores a candidate against the vacancy's skill, experience, seniority, English, and salary rules. */
export function calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number {
	if (candidate == null || vacancy == null) {
		return 0;
	}

	const candidateSkills = normalizeSkillSet(Array.isArray(candidate.skills) ? candidate.skills : []);
	const requiredSkills = normalizeSkillSet(
		Array.isArray(vacancy.requiredSkills) ? vacancy.requiredSkills : [],
	);
	const preferredSkills = normalizeSkillSet(
		Array.isArray(vacancy.preferredSkills) ? vacancy.preferredSkills : [],
	);
	const matchedRequiredCount = [...requiredSkills].filter((skill) => candidateSkills.has(skill)).length;

	let skillScore = 0;
	if (requiredSkills.size > 0) {
		if (matchedRequiredCount === requiredSkills.size) {
			skillScore = 40;
		} else if (matchedRequiredCount / requiredSkills.size >= 0.5) {
			skillScore = 20;
		}
	}
	const preferredBonus = [...preferredSkills].filter((skill) => candidateSkills.has(skill)).length * 10;
	skillScore = Math.min(skillScore + preferredBonus, 40);

	let experienceScore = 0;
	const experience = candidate.yearsOfExperience;
	if (
		Number.isFinite(experience) &&
		Number.isFinite(vacancy.minYearsExperience) &&
		Number.isFinite(vacancy.maxYearsExperience)
	) {
		if (experience >= vacancy.minYearsExperience && experience <= vacancy.maxYearsExperience) {
			experienceScore = 20;
		} else {
			const distance = experience < vacancy.minYearsExperience
				? vacancy.minYearsExperience - experience
				: experience - vacancy.maxYearsExperience;
			if (distance <= 2) {
				experienceScore = 10;
			}
		}
	}

	const seniorityLevels: SeniorityLevel[] = [
		"Junior",
		"Semi-Senior",
		"Senior",
		"Lead",
		"Executive",
	];
	const candidateSeniorityIndex = seniorityLevels.indexOf(candidate.seniority);
	const vacancySeniorityIndex = seniorityLevels.indexOf(vacancy.requiredSeniority);
	const seniorityDistance = Math.abs(candidateSeniorityIndex - vacancySeniorityIndex);
	const seniorityScore = candidateSeniorityIndex < 0 || vacancySeniorityIndex < 0
		? 0
		: seniorityDistance === 0
			? 15
			: seniorityDistance === 1
				? 7
				: 0;

	const englishLevels: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
	const candidateEnglishIndex = englishLevels.indexOf(candidate.englishLevel);
	const vacancyEnglishIndex = englishLevels.indexOf(vacancy.requiredEnglishLevel);
	const englishScore =
		candidateEnglishIndex >= 0 &&
		vacancyEnglishIndex >= 0 &&
		candidateEnglishIndex >= vacancyEnglishIndex
			? 15
			: 0;

	let salaryScore = 0;
	if (
		Number.isFinite(candidate.expectedSalary) &&
		Number.isFinite(vacancy.salaryRangeMin) &&
		Number.isFinite(vacancy.salaryRangeMax)
	) {
		if (
			candidate.expectedSalary >= vacancy.salaryRangeMin &&
			candidate.expectedSalary <= vacancy.salaryRangeMax
		) {
			salaryScore = 10;
		} else if (
			candidate.expectedSalary > vacancy.salaryRangeMax &&
			candidate.expectedSalary <= vacancy.salaryRangeMax * 1.2
		) {
			salaryScore = 5;
		}
	}

	return Math.min(skillScore + experienceScore + seniorityScore + englishScore + salaryScore, 100);
}

/** Scores all candidates and returns a new list ordered from highest match score to lowest. */
export function rankCandidatesForVacancy(
	candidates: Candidate[],
	vacancy: Vacancy,
): Array<{ candidate: Candidate; score: number }> {
	if (!Array.isArray(candidates)) {
		return [];
	}

	return candidates
		.filter((candidate): candidate is Candidate => candidate != null)
		.map((candidate) => ({ candidate, score: calculateCandidateScore(candidate, vacancy) }))
		.sort((left, right) => right.score - left.score);
}

/** Groups candidates into every defined seniority bucket, leaving empty levels present in the result. */
export function groupCandidatesBySeniority(
	candidates: Candidate[],
): Record<SeniorityLevel, Candidate[]> {
	const grouped: Record<SeniorityLevel, Candidate[]> = {
		Junior: [],
		"Semi-Senior": [],
		Senior: [],
		Lead: [],
		Executive: [],
	};

	if (!Array.isArray(candidates)) {
		return grouped;
	}

	for (const candidate of candidates) {
		if (candidate != null && Object.prototype.hasOwnProperty.call(grouped, candidate.seniority)) {
			grouped[candidate.seniority].push(candidate);
		}
	}

	return grouped;
}

/** Counts valid candidates per lifecycle status and includes zero-count statuses in the report. */
export function countCandidatesByStatus(
	candidates: Candidate[],
): Record<CandidateStatus, number> {
	const counts: Record<CandidateStatus, number> = {
		Active: 0,
		"In process": 0,
		Hired: 0,
		Inactive: 0,
	};

	if (!Array.isArray(candidates)) {
		return counts;
	}

	for (const candidate of candidates) {
		if (candidate != null && Object.prototype.hasOwnProperty.call(counts, candidate.status)) {
			counts[candidate.status] += 1;
		}
	}

	return counts;
}

/** Averages valid expected salaries and rounds to cents; returns zero when none are available. */
export function calculateAverageSalary(candidates: Candidate[]): number {
	if (!Array.isArray(candidates) || candidates.length === 0) {
		return 0;
	}

	let totalExpectedSalary = 0;
	let validSalaryCount = 0;

	for (const candidate of candidates) {
		if (candidate == null) {
			continue;
		}

		const salary = candidate.expectedSalary;
		if (!Number.isFinite(salary) || salary <= 0) {
			continue;
		}

		totalExpectedSalary += salary;
		validSalaryCount += 1;
	}

	return validSalaryCount === 0
		? 0
		: Math.round((totalExpectedSalary / validSalaryCount) * 100) / 100;
}

/** Counts a skill at most once per candidate and sorts ties alphabetically for stable reports. */
export function findTopSkills(
	candidates: Candidate[],
	topN: number,
): Array<{ skill: string; count: number }> {
	if (!Array.isArray(candidates) || !Number.isFinite(topN) || topN <= 0) {
		return [];
	}

	const skillCounts = new Map<string, { skill: string; count: number }>();

	for (const candidate of candidates) {
		if (candidate == null || !Array.isArray(candidate.skills)) {
			continue;
		}

		const uniqueCandidateSkills = new Map<string, string>();
		for (const rawSkill of candidate.skills) {
			if (typeof rawSkill !== "string" || rawSkill.trim().length === 0) {
				continue;
			}

			const normalizedSkill = rawSkill.trim().toLowerCase();
			if (!uniqueCandidateSkills.has(normalizedSkill)) {
				uniqueCandidateSkills.set(normalizedSkill, rawSkill.trim());
			}
		}

		for (const [normalizedSkill, skill] of uniqueCandidateSkills) {
			const existing = skillCounts.get(normalizedSkill);
			if (existing) {
				existing.count += 1;
			} else {
				skillCounts.set(normalizedSkill, { skill, count: 1 });
			}
		}
	}

	return [...skillCounts.values()]
		.sort((left, right) => right.count - left.count || left.skill.localeCompare(right.skill))
		.slice(0, Math.floor(topN));
}

/** Calculates the hired-process percentage using non-null process records as the denominator. */
export function calculateVacancyFillRate(
	processes: SelectionProcess[],
): number {
	if (!Array.isArray(processes)) {
		return 0;
	}

	const validProcesses = processes.filter(
		(process): process is SelectionProcess => process != null,
	);
	if (validProcesses.length === 0) {
		return 0;
	}

	const hiredCount = validProcesses.filter((process) => process.stage === "Hired").length;
	return Math.round((hiredCount / validProcesses.length) * 10000) / 100;
}
