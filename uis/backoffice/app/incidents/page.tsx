"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
	analysisToCsv,
	analyzeIncidentFile,
	INCIDENT_CATEGORIES,
	INCIDENT_STATUSES,
	type IncidentAnalysis,
} from "@/lib/incidents";

const scoreLabels = ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"];
const invalidLabels: Record<string, string> = {
	missing_client_company: "Missing client company",
	invalid_category: "Invalid or missing category",
	invalid_description: "Invalid or missing description",
	invalid_agent_id: "Invalid or missing agent",
	invalid_email: "Invalid or missing email",
	closed_without_score: "Closed ticket without score",
	score_out_of_range: "Score outside 1–5",
};

function StatCard({
	label,
	value,
	detail,
	tone = "green",
}: {
	label: string;
	value: string | number;
	detail: string;
	tone?: "green" | "amber" | "red";
}) {
	const tones = {
		green: "border-emerald-200 bg-emerald-50 text-emerald-950",
		amber: "border-amber-200 bg-amber-50 text-amber-950",
		red: "border-red-200 bg-red-50 text-red-950",
	};
	return (
		<article className={`rounded-xl border p-5 ${tones[tone]}`}>
			<p className="text-xs font-bold uppercase tracking-[0.14em]">{label}</p>
			<p className="mt-3 text-4xl font-bold tabular-nums">{value}</p>
			<p className="mt-2 text-sm opacity-75">{detail}</p>
		</article>
	);
}

function BarList({
	title,
	items,
}: {
	title: string;
	items: Array<{ label: string; count: number; percentage?: number }>;
}) {
	return (
		<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="text-lg font-bold text-slate-950">{title}</h2>
			<div className="mt-5 space-y-4">
				{items.length === 0 ? (
					<p className="text-sm text-slate-500">No data available.</p>
				) : (
					items.map((item) => (
						<div key={item.label}>
							<div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
								<span className="font-semibold text-slate-700">{item.label}</span>
								<span className="font-mono text-slate-500">
									{item.count}
									{item.percentage === undefined ? "" : ` · ${item.percentage.toFixed(1)}%`}
								</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-slate-100">
								<div
									className="h-full rounded-full bg-emerald-600"
									style={{ width: `${Math.max(0, Math.min(100, item.percentage ?? 0))}%` }}
								/>
							</div>
						</div>
					))
				)}
			</div>
		</section>
	);
}

export default function IncidentsPage() {
	const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const file = fileInput.current?.files?.[0];
		if (!file) {
			setError("Select an incidents CSV file before starting the analysis.");
			return;
		}

		setIsLoading(true);
		setError("");
		setAnalysis(null);
		try {
			setAnalysis(await analyzeIncidentFile(file));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Unexpected analysis error.");
		} finally {
			setIsLoading(false);
		}
	}

	function downloadReport() {
		if (!analysis) return;
		const url = URL.createObjectURL(new Blob([analysisToCsv(analysis)], { type: "text/csv;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `${analysis.sourceFile.replace(/\.csv$/i, "")}-analysis.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	const invalidItems = analysis
		? Object.entries(analysis.invalidBreakdown)
				.filter(([, count]) => count > 0)
				.map(([key, count]) => ({ label: invalidLabels[key] ?? key, count }))
		: [];

	return (
		<main className="min-h-screen bg-slate-50 text-slate-900">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
					<Link href="/" className="flex items-center gap-3" aria-label="Nexova backoffice home">
						<span className="grid size-9 place-items-center rounded-md bg-emerald-700 font-bold text-white">N</span>
						<span className="font-semibold">Nexova <span className="text-xs font-medium uppercase text-emerald-700">Backoffice</span></span>
					</Link>
					<Link href="/" className="text-sm font-semibold text-emerald-800 hover:underline">Talent Pipeline</Link>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
				<section className="rounded-2xl bg-slate-950 px-6 py-9 text-white sm:px-9">
					<p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Customer support · Incident quality</p>
					<div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
						<div>
							<h1 className="max-w-2xl text-3xl font-bold sm:text-5xl">Support ticket analysis</h1>
							<p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Validate the monthly CSV and review backlog, category, and satisfaction metrics without exposing customer emails.</p>
						</div>
						<form onSubmit={handleSubmit} className="w-full rounded-xl bg-white p-4 text-slate-900 lg:max-w-md">
							<label htmlFor="incident-file" className="block text-sm font-bold">Incident CSV</label>
							<input ref={fileInput} id="incident-file" type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-semibold file:text-emerald-900" required />
							<button disabled={isLoading} className="mt-4 w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" type="submit">
								{isLoading ? "Analyzing…" : "Analyze incidents"}
							</button>
							<p className="mt-2 text-xs text-slate-500">Maximum 5 MB. Processing returns aggregate metrics only.</p>
						</form>
					</div>
				</section>

				{error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{error}</div>}

				{!analysis && !isLoading && !error && (
					<section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
						<p className="text-lg font-bold text-slate-800">Ready for the monthly export</p>
						<p className="mt-2 text-sm text-slate-500">Select a CSV above to calculate quality, workload, and satisfaction metrics.</p>
					</section>
				)}

				{isLoading && <div role="status" className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center font-semibold text-emerald-900">Analyzing records and validating data quality…</div>}

				{analysis && (
					<div className="mt-8 space-y-8" aria-live="polite">
						<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
							<div>
								<p className="text-sm font-semibold text-emerald-700">Analysis complete</p>
								<h2 className="mt-1 text-2xl font-bold">{analysis.sourceFile}</h2>
							</div>
							<button type="button" onClick={downloadReport} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold hover:border-emerald-700 hover:text-emerald-800">Download aggregate CSV</button>
						</div>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<StatCard label="Total records" value={analysis.totalRecords} detail="Rows read from the file" />
							<StatCard label="Valid records" value={analysis.validRecords} detail={`${analysis.invalidRecords} incomplete or invalid`} />
							<StatCard label="Open backlog" value={analysis.statuses.OPEN} detail={`${analysis.statusPercentages.OPEN.toFixed(1)}% of valid records`} tone="amber" />
							<StatCard label="Satisfaction" value={analysis.satisfaction.averageScore.toFixed(2)} detail={`${analysis.satisfaction.scoredTickets} closed tickets scored`} />
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<BarList title="Tickets by category" items={INCIDENT_CATEGORIES.map((category) => ({ label: category, count: analysis.categories[category], percentage: analysis.categoryPercentages[category] }))} />
							<BarList title="Tickets by status" items={INCIDENT_STATUSES.map((status) => ({ label: status, count: analysis.statuses[status], percentage: analysis.statusPercentages[status] }))} />
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<BarList title="Invalid-record reasons" items={invalidItems.map((item) => ({ ...item, percentage: analysis.invalidRecords === 0 ? 0 : item.count / analysis.invalidRecords * 100 }))} />
							<BarList title="Satisfaction scores" items={Object.entries(analysis.satisfaction.scoreCounts).map(([score, count]) => ({ label: `${score} — ${scoreLabels[Number(score) - 1]}`, count, percentage: analysis.satisfaction.scoredTickets === 0 ? 0 : count / analysis.satisfaction.scoredTickets * 100 }))} />
						</div>

						{analysis.invalidRecords > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong className="font-bold">Data-quality note:</strong> invalid records are excluded from category, status, and satisfaction aggregates.</div>}
					</div>
				)}
			</div>
		</main>
	);
}
