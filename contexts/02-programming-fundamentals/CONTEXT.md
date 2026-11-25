# CONTEXT — Nexova

## Milestone 2: Programming Fundamentals

**Company:** Nexova — Human Resources Consulting & Talent Acquisition  
**Your Role:** Junior AI Engineer, TrackFlow Tech Team  
**Project Owner:** Javier Almeida, Operations Manager

---

## About Nexova

Nexova is a human resources consulting and talent acquisition firm based in Valencia, Spain, with expansion operations in Miami, Florida. The company operates three business lines: executive headhunting, customer support outsourcing for tech companies, and corporate training. You are part of the newly formed AI Engineering team tasked with modernising Nexova's operations.

## Your Assignment

Javier Almeida, the Operations Manager, needs you to build the core data processing logic for Nexova's candidate management system. The 40 selection consultants currently process everything manually: reading CVs, scoring candidates, matching them to vacancies, and tracking process stages. This milestone focuses on building the TypeScript functions that will power the automated candidate scoring and vacancy matching engine.

This is pure programming: no AI, no prompting. Javier needs to see that you can write solid, well-typed code that handles real business logic correctly.

## What You're Building

Implement a set of TypeScript utilities to:

1. Model candidate and vacancy data using interfaces.
2. Filter and search candidates by skills, experience, and availability.
3. Score candidates against vacancy requirements.
4. Rank candidates for a given position.
5. Generate selection reports with aggregated metrics.
6. Validate data before processing.

---

## Business Entities

### Candidate

A candidate in Nexova's system represents a person in the talent database.

```ts
interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  skills: string[];
  englishLevel: EnglishLevel;
  seniority: SeniorityLevel;
  currentSalary: number;
  expectedSalary: number;
  availability: AvailabilityStatus;
  location: string;
  remoteOnly: boolean;
  status: CandidateStatus;
}

type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";
type SeniorityLevel =
  | "Junior"
  | "Semi-Senior"
  | "Senior"
  | "Lead"
  | "Executive";
type AvailabilityStatus = "Immediate" | "2 weeks" | "1 month" | "Not available";
type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";
```

**Validation rules:**

- `yearsOfExperience` must be between 0 and 50, inclusive.
- `currentSalary` and `expectedSalary` must be greater than 0.
- The `skills` array must contain at least one skill.
- `email` must have a basically valid email format (contain `@` and `.` in the correct positions).
- `phone` must not be empty.

### Vacancy

A vacancy represents an open position Nexova is trying to fill for a client.

```ts
interface Vacancy {
  id: string;
  title: string;
  companyName: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minYearsExperience: number;
  maxYearsExperience: number;
  requiredEnglishLevel: EnglishLevel;
  requiredSeniority: SeniorityLevel;
  salaryRangeMin: number;
  salaryRangeMax: number;
  isRemote: boolean;
  location: string;
  status: VacancyStatus;
}

type VacancyStatus = "Open" | "In progress" | "Closed" | "On hold";
```

**Validation rules:**

- `requiredSkills` must contain at least one skill.
- `minYearsExperience` must be greater than or equal to 0.
- `maxYearsExperience` must be greater than or equal to `minYearsExperience`.
- `salaryRangeMin` and `salaryRangeMax` must both be greater than 0.
- `salaryRangeMax` must be greater than or equal to `salaryRangeMin`.

### SelectionProcess

Tracks a candidate's progress through a vacancy selection process.

```ts
interface SelectionProcess {
  id: string;
  candidateId: string;
  vacancyId: string;
  stage: ProcessStage;
  score: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

type ProcessStage =
  | "Screening"
  | "Interview"
  | "Technical test"
  | "Final interview"
  | "Offer"
  | "Rejected"
  | "Hired";
```

---

## Required Functions

Implement these functions in the appropriate files according to the project structure. Keep them pure: they should work with their parameters and not depend on global variables.

### 1. Collection Operations — `src/utils/collections.ts`

- `filterCandidatesBySkills(candidates: Candidate[], requiredSkills: string[]): Candidate[]`: returns candidates who have **all** required skills. Skill matching is case-insensitive.
- `filterCandidatesBySeniority(candidates: Candidate[], seniority: SeniorityLevel): Candidate[]`: returns candidates with the specified seniority level.
- `filterCandidatesByAvailability(candidates: Candidate[], availability: AvailabilityStatus[]): Candidate[]`: returns candidates whose availability matches any of the provided statuses.
- `sortCandidatesBySalary(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`: sorts by expected salary in ascending or descending order without mutating the original array.
- `sortCandidatesByExperience(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`: sorts by years of experience in ascending or descending order without mutating the original array.

### 2. Search Operations — `src/utils/search.ts`

- `findCandidateById(candidates: Candidate[], id: string): Candidate | null`: performs a linear search by ID and returns the candidate or `null`.
- `findCandidateByEmail(candidates: Candidate[], email: string): Candidate | null`: performs a linear search by email using a case-insensitive comparison and returns the candidate or `null`.
- `binarySearchCandidateBySalary(sortedCandidates: Candidate[], targetSalary: number): number`: performs binary search on an array already sorted by expected salary in ascending order; returns the matching index or `-1`. If multiple candidates have the same salary, any valid index is acceptable.

### 3. Scoring and Matching — `src/utils/transformations.ts`

#### `calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number`

Calculates a match score from 0 to 100 using these components:

- **Skills match (maximum 40 points):** +40 if the candidate has all required skills; otherwise +20 if they have at least 50% of the required skills; add +10 for each preferred skill the candidate has, up to +20.
- **Experience match (maximum 20 points):** +20 if the candidate's experience is within the vacancy's range; +10 if they are 1-2 years outside the range; 0 if they are more than 2 years outside it.
- **Seniority match (maximum 15 points):** +15 for an exact match; +7 if the candidate is one level above or below; 0 otherwise.
- **English level match (maximum 15 points):** +15 if the candidate meets or exceeds the required level; 0 otherwise.
- **Salary match (maximum 10 points):** +10 if the candidate's expected salary is within the vacancy's range; +5 if it is up to 20% above the maximum; 0 if it is more than 20% above.

#### Other scoring and grouping functions

- `rankCandidatesForVacancy(candidates: Candidate[], vacancy: Vacancy): Array<{ candidate: Candidate; score: number }>`: scores all candidates and returns them sorted by score, highest first.
- `groupCandidatesBySeniority(candidates: Candidate[]): Record<SeniorityLevel, Candidate[]>`: groups candidates by seniority level.

### 4. Aggregations and Reports — `src/utils/transformations.ts`

- `countCandidatesByStatus(candidates: Candidate[]): Record<CandidateStatus, number>`: returns the count of candidates for each status.
- `calculateAverageSalary(candidates: Candidate[]): number`: calculates the average expected salary, rounded to 2 decimal places.
- `findTopSkills(candidates: Candidate[], topN: number): Array<{ skill: string; count: number }>`: finds the `topN` most common skills, sorted by frequency from highest to lowest, with the number of candidates who have each skill.
- `calculateVacancyFillRate(processes: SelectionProcess[]): number`: calculates the percentage of processes whose stage is `Hired`; returns a number from 0 to 100, rounded to 2 decimal places.

### 5. Validations — `src/utils/validations.ts`

- `validateCandidate(candidate: Candidate): { valid: boolean; errors: string[] }`: validates all candidate business rules. `valid` is `true` only if all validations pass.
- `validateVacancy(vacancy: Vacancy): { valid: boolean; errors: string[] }`: validates all vacancy business rules. `valid` is `true` only if all validations pass.
- `isValidEmail(email: string): boolean`: checks that an email contains `@` and `.` in the correct positions. This is a basic, non-production-grade validation.

---

## Sample Data

Use this data to test your functions.

### Sample Candidates

```ts
const sampleCandidates: Candidate[] = [
  {
    id: "C-2024-0451",
    fullName: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+56912345678",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    englishLevel: "B2",
    seniority: "Semi-Senior",
    currentSalary: 3500,
    expectedSalary: 4200,
    availability: "1 month",
    location: "Valencia, Spain",
    remoteOnly: false,
    status: "Active",
  },
  {
    id: "C-2024-0452",
    fullName: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "+56987654321",
    yearsOfExperience: 3,
    skills: ["JavaScript", "React", "CSS", "HTML"],
    englishLevel: "B1",
    seniority: "Junior",
    currentSalary: 2200,
    expectedSalary: 2800,
    availability: "Immediate",
    location: "Miami, Florida, United States",
    remoteOnly: true,
    status: "Active",
  },
  {
    id: "C-2024-0453",
    fullName: "Carolina Silva",
    email: "carolina.silva@email.com",
    phone: "+56911223344",
    yearsOfExperience: 8,
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
    englishLevel: "C1",
    seniority: "Senior",
    currentSalary: 5500,
    expectedSalary: 6500,
    availability: "2 weeks",
    location: "Valencia, Spain",
    remoteOnly: false,
    status: "Active",
  },
];
```

### Sample Vacancy

```ts
const sampleVacancy: Vacancy = {
  id: "V-2024-0892",
  title: "Senior Full-Stack Developer",
  companyName: "TechCorp Solutions",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  preferredSkills: ["PostgreSQL", "Docker"],
  minYearsExperience: 4,
  maxYearsExperience: 8,
  requiredEnglishLevel: "B2",
  requiredSeniority: "Senior",
  salaryRangeMin: 5000,
  salaryRangeMax: 7000,
  isRemote: true,
  location: "Remote",
  status: "Open",
};
```

---

## Acceptance Criteria

The implementation will be evaluated on:

1. **Type safety:** all interfaces are correctly defined with appropriate types.
2. **Function correctness:** each function produces the expected output for its inputs.
3. **Edge cases:** functions handle empty arrays, null values, and invalid data gracefully.
4. **Validation logic:** business rules are applied accurately.
5. **Code organization:** functions are in the correct files according to responsibility.
6. **Naming conventions:** variables, functions, and types follow TypeScript conventions.
7. **No mutations:** sorting and filtering functions do not modify the original arrays.
8. **Pure functions:** functions work only with their parameters and do not use global variables.

> “Look, I don't need this to be perfect. I need it to work and be maintainable. The consultants will use these functions through a UI we'll build later, but first I need to know the logic is solid. Give me clean code I can trust, and we'll build the rest on top of it.”
>
> — Javier Almeida, Operations Manager

If you are unsure about a requirement, ask your mentor. In a real work environment, you would message Javier on Slack.

*This is a real Nexova project. What you build here will become part of the production candidate scoring engine.*
