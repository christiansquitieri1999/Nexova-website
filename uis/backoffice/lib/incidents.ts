import { authHeaders, authFetch } from "@/lib/auth";

export const INCIDENT_CATEGORIES = [
	"TECHNICAL",
	"BILLING",
	"ACCESS",
	"HR_QUERY",
	"COMPLAINT",
] as const;
export const INCIDENT_STATUSES = ["OPEN", "CLOSED", "DISCARDED"] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentAnalysis {
	sourceFile: string;
	totalRecords: number;
	validRecords: number;
	invalidRecords: number;
	invalidBreakdown: Record<string, number>;
	categories: Record<IncidentCategory, number>;
	categoryPercentages: Record<IncidentCategory, number>;
	statuses: Record<IncidentStatus, number>;
	statusPercentages: Record<IncidentStatus, number>;
	satisfaction: {
		closedRecords: number;
		scoredTickets: number;
		averageScore: number;
		scoreCounts: Record<string, number>;
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key];
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error("The incident API returned an invalid metric.");
	}
	return value;
}

function requireCounts<T extends string>(
	value: unknown,
	keys: readonly T[],
): Record<T, number> {
	if (!isObject(value)) {
		throw new Error("The incident API returned invalid aggregates.");
	}
	return Object.fromEntries(keys.map((key) => [key, requireNumber(value, key)])) as Record<
		T,
		number
	>;
}

export function parseIncidentAnalysis(value: unknown): IncidentAnalysis {
	if (!isObject(value) || !isObject(value.invalid_breakdown) || !isObject(value.satisfaction)) {
		throw new Error("The incident API returned an invalid response.");
	}

	const invalidBreakdown = Object.fromEntries(
		Object.entries(value.invalid_breakdown).map(([key, count]) => {
			if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
				throw new Error("The incident API returned an invalid record count.");
			}
			return [key, count];
		}),
	);
	const scoreCounts = requireCounts(
		value.satisfaction.score_counts,
		["1", "2", "3", "4", "5"],
	);

	return {
		sourceFile: typeof value.source_file === "string" ? value.source_file : "uploaded.csv",
		totalRecords: requireNumber(value, "total_records"),
		validRecords: requireNumber(value, "valid_records"),
		invalidRecords: requireNumber(value, "invalid_records"),
		invalidBreakdown,
		categories: requireCounts(value.categories, INCIDENT_CATEGORIES),
		categoryPercentages: requireCounts(value.category_percentages, INCIDENT_CATEGORIES),
		statuses: requireCounts(value.statuses, INCIDENT_STATUSES),
		statusPercentages: requireCounts(value.status_percentages, INCIDENT_STATUSES),
		satisfaction: {
			closedRecords: requireNumber(value.satisfaction, "closed_records"),
			scoredTickets: requireNumber(value.satisfaction, "scored_tickets"),
			averageScore: requireNumber(value.satisfaction, "average_score"),
			scoreCounts,
		},
	};
}

export async function analyzeIncidentFile(file: File): Promise<IncidentAnalysis> {
	if (!file.name.toLowerCase().endsWith(".csv")) {
		throw new Error("Select a CSV file.");
	}
	if (file.size === 0) {
		throw new Error("The selected CSV file is empty.");
	}
	if (file.size > 5 * 1024 * 1024) {
		throw new Error("The CSV file must be smaller than 5 MB.");
	}

	const formData = new FormData();
	formData.set("file", file);
	const response = await authFetch(
		`${process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? "http://127.0.0.1:8000"}/api/incidents/analyze`,
		{
			method: "POST",
				headers: authHeaders(),
			body: formData,
		},
	);
	const responseBody = await response.text();
	const payload: unknown = (() => {
		try {
			return JSON.parse(responseBody);
		} catch {
			return null;
		}
	})();
	if (!response.ok) {
		const message =
			isObject(payload) && typeof payload.error === "string"
				? payload.error
				: response.headers.get("X-Error-Message") ??
					"The incident service could not analyze this file.";
		throw new Error(message);
	}
	return parseIncidentAnalysis(payload);
}

export function analysisToCsv(analysis: IncidentAnalysis): string {
	const rows: Array<[string, number]> = [
		["total_records", analysis.totalRecords],
		["valid_records", analysis.validRecords],
		["invalid_records", analysis.invalidRecords],
		...Object.entries(analysis.invalidBreakdown).map(
			([rule, count]) => [`invalid_${rule}`, count] as [string, number],
		),
		...INCIDENT_CATEGORIES.map(
			(category) => [`category_${category}`, analysis.categories[category]] as [string, number],
		),
		...INCIDENT_STATUSES.map(
			(status) => [`status_${status}`, analysis.statuses[status]] as [string, number],
		),
		["satisfaction_closed_records", analysis.satisfaction.closedRecords],
		["satisfaction_scored_tickets", analysis.satisfaction.scoredTickets],
		["satisfaction_average", analysis.satisfaction.averageScore],
		...Object.entries(analysis.satisfaction.scoreCounts).map(
			([score, count]) => [`satisfaction_score_${score}`, count] as [string, number],
		),
	];
	return ["metric,value", ...rows.map(([metric, value]) => `${metric},${value}`)].join("\n");
}
