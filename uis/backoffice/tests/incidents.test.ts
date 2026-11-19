import assert from "node:assert/strict";
import test from "node:test";
import { analysisToCsv, parseIncidentAnalysis } from "../lib/incidents";

const validPayload = {
	source_file: "incidents.csv",
	total_records: 2,
	valid_records: 1,
	invalid_records: 1,
	invalid_breakdown: { invalid_email: 1 },
	categories: { TECHNICAL: 1, BILLING: 0, ACCESS: 0, HR_QUERY: 0, COMPLAINT: 0 },
	category_percentages: { TECHNICAL: 100, BILLING: 0, ACCESS: 0, HR_QUERY: 0, COMPLAINT: 0 },
	statuses: { OPEN: 1, CLOSED: 0, DISCARDED: 0 },
	status_percentages: { OPEN: 100, CLOSED: 0, DISCARDED: 0 },
	satisfaction: {
		closed_records: 0,
		scored_tickets: 0,
		average_score: 0,
		score_counts: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
	},
};

test("incident API payload is converted into a safe typed result", () => {
	const result = parseIncidentAnalysis(validPayload);
	assert.equal(result.sourceFile, "incidents.csv");
	assert.equal(result.categories.TECHNICAL, 1);
	assert.equal(result.satisfaction.averageScore, 0);
	assert.doesNotMatch(analysisToCsv(result), /@/);
});

test("incident API response guards reject malformed or negative metrics", () => {
	assert.throws(() => parseIncidentAnalysis({ ...validPayload, total_records: -1 }));
	assert.throws(() => parseIncidentAnalysis(null));
	assert.throws(() => parseIncidentAnalysis({ ...validPayload, categories: {} }));
});
