import assert from "node:assert/strict";
import test from "node:test";
import {
	calculateAverageSalary,
	calculateCandidateScore,
	calculateVacancyFillRate,
	countCandidatesByStatus,
	filterCandidatesByCriteria,
	findCandidateByEmail,
	findCandidateById,
	findTopSkills,
	rankCandidatesForVacancy,
	sortCandidatesBySalary,
	binarySearchCandidateBySalary,
} from "../lib/business-model";
import type { CandidateFilterCriteria } from "../lib/business-model/utils/collections";
import type { Candidate, SelectionProcess, Vacancy } from "../lib/business-model/types/models";

const sampleCandidates: Candidate[] = [
	{
		id: "C-1", fullName: "Alex Rivera", email: "alex@example.com", phone: "+34123456789",
		yearsOfExperience: 5, skills: ["TypeScript", "React", "Node.js", "PostgreSQL"], englishLevel: "B2",
		seniority: "Semi-Senior", currentSalary: 3500, expectedSalary: 4200, availability: "Immediate",
		location: "Valencia", remoteOnly: false, status: "Active",
	},
	{
		id: "C-2", fullName: "Sam Lee", email: "sam@example.com", phone: "+14155550123",
		yearsOfExperience: 8, skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker"], englishLevel: "C1",
		seniority: "Senior", currentSalary: 5500, expectedSalary: 6500, availability: "2 weeks",
		location: "Miami", remoteOnly: true, status: "In process",
	},
];

const sampleVacancy: Vacancy = {
	id: "V-1", title: "Senior Developer", companyName: "Example Co",
	requiredSkills: ["TypeScript", "React", "Node.js"], preferredSkills: ["PostgreSQL", "Docker"],
	minYearsExperience: 4, maxYearsExperience: 8, requiredEnglishLevel: "B2", requiredSeniority: "Senior",
	salaryRangeMin: 5000, salaryRangeMax: 7000, isRemote: true, location: "Remote", status: "Open",
};

const selectionProcesses: SelectionProcess[] = [
	{ id: "P-1", candidateId: "C-1", vacancyId: "V-1", stage: "Interview", score: 72, notes: "", createdAt: new Date("2024-01-10"), updatedAt: new Date("2024-01-12") },
	{ id: "P-2", candidateId: "C-2", vacancyId: "V-1", stage: "Hired", score: 95, notes: "", createdAt: new Date("2024-01-09"), updatedAt: new Date("2024-01-15") },
];

test("combined filters match every criterion and leave the source list unchanged", () => {
	const result = filterCandidatesByCriteria(sampleCandidates, {
		skills: [" typescript ", "POSTGRESQL"],
		seniority: "Senior",
		availability: "2 weeks",
		status: "In process",
		minimumSalary: 6000,
		maximumSalary: 7000,
	});

	assert.deepEqual(result.map((candidate) => candidate.id), ["C-2"]);
	assert.deepEqual(sampleCandidates.map((candidate) => candidate.id), ["C-1", "C-2"]);
});

test("filters and searches handle empty lists, null inputs, and missing matches", () => {
	const criteria: CandidateFilterCriteria = { skills: [], seniority: "", availability: "", status: "", minimumSalary: null, maximumSalary: null };
	assert.deepEqual(filterCandidatesByCriteria([], criteria), []);
	assert.deepEqual(filterCandidatesByCriteria(null, criteria), []);
	assert.deepEqual(filterCandidatesByCriteria(sampleCandidates, null), []);
	assert.equal(findCandidateById([null, ...sampleCandidates], "missing"), null);
	assert.equal(findCandidateById(null, "C-1"), null);
	assert.equal(findCandidateByEmail(sampleCandidates, " SAM@EXAMPLE.COM ")?.id, "C-2");
	assert.equal(findCandidateByEmail(sampleCandidates, ""), null);
});

test("salary sorting is stable with respect to the input and binary search reports missing values", () => {
	const sorted = sortCandidatesBySalary(sampleCandidates, "asc");
	assert.deepEqual(sorted.map((candidate) => candidate.id), ["C-1", "C-2"]);
	assert.deepEqual(sampleCandidates.map((candidate) => candidate.id), ["C-1", "C-2"]);
	assert.equal(binarySearchCandidateBySalary(sorted, 6500), 1);
	assert.equal(binarySearchCandidateBySalary(sorted, 5000), -1);
	assert.equal(binarySearchCandidateBySalary([], 5000), -1);
});

test("scoring and report aggregations handle candidate datasets", () => {
	assert.equal(calculateCandidateScore(sampleCandidates[1], sampleVacancy), 100);
	assert.equal(calculateCandidateScore(null as unknown as Candidate, sampleVacancy), 0);
	assert.deepEqual(rankCandidatesForVacancy(sampleCandidates, sampleVacancy).map(({ candidate }) => candidate.id), ["C-2", "C-1"]);
	assert.equal(calculateAverageSalary(sampleCandidates), 5350);
	assert.equal(calculateAverageSalary([]), 0);
	assert.equal(calculateVacancyFillRate(selectionProcesses), 50);
	assert.equal(calculateVacancyFillRate([]), 0);
	assert.deepEqual(countCandidatesByStatus(sampleCandidates), { Active: 1, "In process": 1, Hired: 0, Inactive: 0 });
	assert.deepEqual(findTopSkills([], 5), []);
	assert.equal(findTopSkills(sampleCandidates, 1)[0]?.skill, "Node.js");
});