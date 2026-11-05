"use client";

import Link from "next/link";
import { useState } from "react";
import {
	filterCandidatesByCriteria,
	findCandidateByEmail,
	findCandidateById,
	binarySearchCandidateBySalary,
	sortCandidatesByExperience,
	sortCandidatesBySalary,
	calculateAverageSalary,
	calculateVacancyFillRate,
	countCandidatesByStatus,
	findTopSkills,
	rankCandidatesForVacancy,
} from "@/lib/business-model";
import type {
	AvailabilityStatus,
	Candidate,
	CandidateStatus,
	SelectionProcess,
	SeniorityLevel,
	Vacancy,
} from "@/lib/business-model/types/models";

const candidates: Candidate[] = [
	{
		id: "C-2024-0451", fullName: "María González", email: "maria.gonzalez@email.com", phone: "+56912345678",
		yearsOfExperience: 5, skills: ["TypeScript", "React", "Node.js", "PostgreSQL"], englishLevel: "B2",
		seniority: "Semi-Senior", currentSalary: 3500, expectedSalary: 4200, availability: "1 month",
		location: "Valencia, Spain", remoteOnly: false, status: "Active",
	},
	{
		id: "C-2024-0452", fullName: "Juan Pérez", email: "juan.perez@email.com", phone: "+56987654321",
		yearsOfExperience: 3, skills: ["JavaScript", "React", "CSS", "HTML"], englishLevel: "B1",
		seniority: "Junior", currentSalary: 2200, expectedSalary: 2800, availability: "Immediate",
		location: "Miami, Florida, United States", remoteOnly: true, status: "Active",
	},
	{
		id: "C-2024-0453", fullName: "Carolina Silva", email: "carolina.silva@email.com", phone: "+56911223344",
		yearsOfExperience: 8, skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"], englishLevel: "C1",
		seniority: "Senior", currentSalary: 5500, expectedSalary: 6500, availability: "2 weeks",
		location: "Valencia, Spain", remoteOnly: false, status: "Active",
	},
];

const selectionProcesses: SelectionProcess[] = [
	{ id: "SP-2024-1001", candidateId: "C-2024-0451", vacancyId: "V-2024-0892", stage: "Interview", score: 72, notes: "", createdAt: new Date("2024-01-10"), updatedAt: new Date("2024-01-12") },
	{ id: "SP-2024-1002", candidateId: "C-2024-0452", vacancyId: "V-2024-0892", stage: "Rejected", score: 45, notes: "", createdAt: new Date("2024-01-11"), updatedAt: new Date("2024-01-13") },
	{ id: "SP-2024-1003", candidateId: "C-2024-0453", vacancyId: "V-2024-0892", stage: "Hired", score: 95, notes: "", createdAt: new Date("2024-01-09"), updatedAt: new Date("2024-01-15") },
];

const sampleVacancy: Vacancy = {
	id: "V-2024-0892", title: "Senior Full-Stack Developer", companyName: "TechCorp Solutions",
	requiredSkills: ["TypeScript", "React", "Node.js"], preferredSkills: ["PostgreSQL", "Docker"],
	minYearsExperience: 4, maxYearsExperience: 8, requiredEnglishLevel: "B2", requiredSeniority: "Senior",
	salaryRangeMin: 5000, salaryRangeMax: 7000, isRemote: true, location: "Remote", status: "Open",
};

type Operation = "filter" | "search" | "sort" | "report";
type SearchType = "id" | "email" | "salary";
type SortField = "salary" | "experience";
type SortOrder = "asc" | "desc";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const seniorities: SeniorityLevel[] = ["Junior", "Semi-Senior", "Senior", "Lead", "Executive"];
const availabilities: AvailabilityStatus[] = ["Immediate", "2 weeks", "1 month", "Not available"];
const statuses: CandidateStatus[] = ["Active", "In process", "Hired", "Inactive"];

const fieldClass = "mt-1.5 block w-full rounded-md border border-[#dce3dc] bg-white px-3 py-2.5 text-sm text-[#1d2925] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b52]";
const actionClass = "rounded-md bg-[#176b52] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d2925] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b52]";

export default function BusinessModelPage() {
	const [operation, setOperation] = useState<Operation>("filter");
	const [results, setResults] = useState<Candidate[]>(candidates);
	const [resultTitle, setResultTitle] = useState("Candidati");
	const [searchType, setSearchType] = useState<SearchType>("id");
	const [searchQuery, setSearchQuery] = useState("");
	const [searchNote, setSearchNote] = useState("");
	const [sortField, setSortField] = useState<SortField>("salary");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
	const [reportVisible, setReportVisible] = useState(false);

	function applyFilters(formData: FormData) {
		const minimum = String(formData.get("minimumSalary") ?? "");
		const maximum = String(formData.get("maximumSalary") ?? "");
		const filtered = filterCandidatesByCriteria(candidates, {
			skills: String(formData.get("skills") ?? "").split(",").map((skill) => skill.trim()).filter(Boolean),
			seniority: String(formData.get("seniority") ?? "") as SeniorityLevel | "",
			availability: String(formData.get("availability") ?? "") as AvailabilityStatus | "",
			status: String(formData.get("status") ?? "") as CandidateStatus | "",
			minimumSalary: minimum === "" ? null : Number(minimum),
			maximumSalary: maximum === "" ? null : Number(maximum),
		});
		setResults(filtered);
		setResultTitle("Risultati filtro");
		setReportVisible(false);
	}

	function searchCandidates(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const query = searchQuery.trim();
		let found: Candidate | null = null;
		let note = "";

		if (searchType === "id") {
			found = findCandidateById(candidates, query);
		} else if (searchType === "email") {
			found = findCandidateByEmail(candidates, query);
		} else {
			const sorted = sortCandidatesBySalary(candidates, "asc");
			const index = binarySearchCandidateBySalary(sorted, Number(query));
			found = index >= 0 ? sorted[index] ?? null : null;
			note = index >= 0
				? `Ricerca binaria: indice ${index} nell'array ordinato per salario crescente.`
				: "Ricerca binaria: salario non trovato (indice -1).";
		}

		setResults(found ? [found] : []);
		setResultTitle(found ? "Candidato trovato" : "Ricerca senza risultati");
		setSearchNote(note);
		setReportVisible(false);
	}

	function sortCandidates(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const sorted = sortField === "salary"
			? sortCandidatesBySalary(candidates, sortOrder)
			: sortCandidatesByExperience(candidates, sortOrder);
		const label = sortField === "salary" ? "salario atteso" : "esperienza";
		setResults(sorted);
		setResultTitle(`Ordine ${sortOrder === "asc" ? "crescente" : "decrescente"}`);
		setSearchNote(`Ordinamento per ${label}; dataset originale invariato.`);
		setReportVisible(false);
	}

	function showReport() {
		setOperation("report");
		setReportVisible(true);
		setSearchNote("");
	}

	const statusCounts = countCandidatesByStatus(candidates);
	const topSkills = findTopSkills(candidates, 8);
	const fillRate = calculateVacancyFillRate(selectionProcesses);
	const rankedCandidates = rankCandidatesForVacancy(candidates, sampleVacancy);
	const operations: Array<{ id: Operation; label: string }> = [
		{ id: "filter", label: "Filtra candidati" },
		{ id: "search", label: "Cerca candidato" },
		{ id: "sort", label: "Ordina risultati" },
		{ id: "report", label: "Genera report" },
	];

	return (
		<main className="min-h-screen bg-[#f5f7f2] text-[#1d2925]">
			<header className="border-b border-[#dce3dc] bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
					<Link href="/" className="flex items-center gap-3" aria-label="Nexova backoffice home">
						<span className="grid size-9 place-items-center rounded-md bg-[#176b52] font-bold text-white">N</span>
						<span className="font-semibold">Nexova <span className="text-xs font-medium uppercase text-[#176b52]">Backoffice</span></span>
					</Link>
					<Link href="/" className="text-sm font-semibold text-[#176b52] hover:underline">Talent Pipeline</Link>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
				<section className="mb-8 flex flex-col justify-between gap-5 rounded-md border border-[#dce3dc] bg-[linear-gradient(90deg,rgba(23,107,82,.08)_1px,transparent_1px),linear-gradient(rgba(23,107,82,.08)_1px,transparent_1px)] bg-[size:28px_28px] px-6 py-6 sm:flex-row sm:items-end">
					<div className="bg-[#f5f7f2]/90 p-2">
						<p className="mb-2 font-mono text-xs font-medium uppercase text-[#176b52]">Milestone 02 / Programming Fundamentals</p>
						<h1 className="text-3xl font-bold sm:text-4xl">Candidate operations</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prova filtri, ricerche, ordinamenti e report sul dataset dimostrativo Nexova.</p>
					</div>
					<p className="rounded-md border border-[#dce3dc] bg-white px-3 py-2 font-mono text-xs text-slate-600"><strong className="mr-2 text-sm text-[#1d2925]">{candidates.length}</strong> candidati campione</p>
				</section>

				<div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
					<aside className="space-y-6" aria-label="Selezione operazione">
						<div>
							<h2 className="mb-3 text-sm font-bold uppercase text-slate-500">Operazioni</h2>
							<div className="grid grid-cols-2 gap-2 lg:grid-cols-1" role="tablist" aria-label="Operazioni candidati">
								{operations.map(({ id, label }) => (
									<button key={id} type="button" role="tab" aria-selected={operation === id} onClick={() => id === "report" ? showReport() : setOperation(id)} className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b52] ${operation === id ? "border-[#176b52] bg-[#e9f3ed] text-[#176b52]" : "border-[#dce3dc] bg-white hover:border-[#176b52]"}`}>
										{label}
									</button>
								))}
							</div>
						</div>

						{operation === "filter" && (
							<section className="border-t border-[#dce3dc] pt-5" role="tabpanel" aria-label="Criteri filtro">
								<h2 className="text-lg font-bold">Criteri filtro</h2>
								<p className="mb-4 mt-1 text-xs leading-5 text-slate-500">I criteri compilati vengono combinati insieme.</p>
								<form className="space-y-4" action={(formData) => applyFilters(formData)}>
									<label className="block text-sm font-semibold">Skill richieste
										<input name="skills" className={fieldClass} placeholder="TypeScript, React" autoComplete="off" />
										<span className="mt-1 block text-xs font-normal text-slate-500">Separale con una virgola; devono esserci tutte.</span>
									</label>
									<label className="block text-sm font-semibold">Seniorità<select name="seniority" className={fieldClass}><option value="">Qualsiasi</option>{seniorities.map((value) => <option key={value}>{value}</option>)}</select></label>
									<label className="block text-sm font-semibold">Disponibilità<select name="availability" className={fieldClass}><option value="">Qualsiasi</option>{availabilities.map((value) => <option key={value}>{value}</option>)}</select></label>
									<fieldset><legend className="mb-2 text-sm font-semibold">Salario atteso (USD)</legend><div className="grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="minimumSalary">Salario minimo</label><input id="minimumSalary" name="minimumSalary" type="number" min="0" className={fieldClass} placeholder="Min" /><label className="sr-only" htmlFor="maximumSalary">Salario massimo</label><input id="maximumSalary" name="maximumSalary" type="number" min="0" className={fieldClass} placeholder="Max" /></div></fieldset>
									<label className="block text-sm font-semibold">Stato<select name="status" className={fieldClass}><option value="">Qualsiasi</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
									<div className="flex gap-2 pt-1"><button className={`${actionClass} flex-1`} type="submit">Applica filtri</button><button className="rounded-md border border-[#dce3dc] bg-white px-3 py-2.5 text-sm font-semibold hover:border-[#176b52]" type="reset" onClick={() => { setResults(candidates); setResultTitle("Candidati"); }}>Azzera</button></div>
								</form>
							</section>
						)}

						{operation === "search" && (
							<section className="border-t border-[#dce3dc] pt-5" role="tabpanel" aria-label="Ricerca">
								<h2 className="text-lg font-bold">Ricerca</h2>
								<p className="mb-4 mt-1 text-xs leading-5 text-slate-500">ID ed email usano ricerca lineare; il salario usa ricerca binaria su dati ordinati.</p>
								<form className="space-y-4" onSubmit={searchCandidates}>
									<label className="block text-sm font-semibold">Campo di ricerca<select className={fieldClass} value={searchType} onChange={(event) => setSearchType(event.target.value as SearchType)}><option value="id">ID candidato</option><option value="email">Email</option><option value="salary">Salario atteso (USD)</option></select></label>
									<label className="block text-sm font-semibold">Valore<input className={fieldClass} type={searchType === "salary" ? "number" : "search"} step={searchType === "salary" ? "any" : undefined} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={searchType === "id" ? "Es. C-2024-0451" : searchType === "email" ? "Es. maria.gonzalez@email.com" : "Es. 4200"} required /></label>
									<button className={`${actionClass} w-full`} type="submit">Cerca</button>
								</form>
								<p className="mt-4 min-h-10 text-sm text-slate-600" aria-live="polite">{searchNote}</p>
							</section>
						)}

						{operation === "sort" && (
							<section className="border-t border-[#dce3dc] pt-5" role="tabpanel" aria-label="Ordinamento">
								<h2 className="text-lg font-bold">Ordinamento</h2>
								<p className="mb-4 mt-1 text-xs leading-5 text-slate-500">Il risultato è una copia ordinata; il dataset originale resta invariato.</p>
								<form className="space-y-4" onSubmit={sortCandidates}>
									<label className="block text-sm font-semibold">Ordina per<select className={fieldClass} value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="salary">Salario atteso</option><option value="experience">Esperienza</option></select></label>
									<label className="block text-sm font-semibold">Direzione<select className={fieldClass} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label>
									<button className={`${actionClass} w-full`} type="submit">Ordina candidati</button>
								</form>
								<p className="mt-4 min-h-10 text-sm text-slate-600" aria-live="polite">{searchNote}</p>
							</section>
						)}
					</aside>

					<section className="min-w-0" aria-label="Risultati operazioni">
						<div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#dce3dc] pb-4">
							<div><p className="font-mono text-[11px] uppercase text-slate-500">{reportVisible ? "REPORT / AGGREGATES" : "DATASET / CANDIDATES"}</p><h2 className="mt-1 text-2xl font-bold">{reportVisible ? "Report selezione" : resultTitle}</h2></div>
							<span className="font-mono text-xs text-slate-500" aria-live="polite">{reportVisible ? `${candidates.length} candidati · ${selectionProcesses.length} processi` : `${results.length} ${results.length === 1 ? "risultato" : "risultati"}`}</span>
						</div>

						{reportVisible ? (
							<div aria-live="polite">
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									<Metric label="Candidati" value={candidates.length} detail="nel dataset" />
									<Metric label="Salario atteso medio" value={money.format(calculateAverageSalary(candidates))} detail="media arrotondata a 2 decimali" />
									<Metric label="Tasso assunzione" value={`${fillRate.toFixed(2)}%`} detail="processi terminati con Hired" />
									<Metric label="Vacancy" value={sampleVacancy.id} detail={`${sampleVacancy.title} · ${sampleVacancy.companyName}`} />
								</div>
								<div className="mt-8 grid gap-8 xl:grid-cols-2">
									<section><h3 className="mb-3 text-base font-bold">Candidati per stato</h3><div className="divide-y divide-[#dce3dc] border-y border-[#dce3dc] bg-white">{Object.entries(statusCounts).map(([status, count]) => <div key={status} className="flex items-center justify-between gap-3 px-3 py-3 text-sm"><span>{status}</span><span className="font-mono font-medium">{count}</span></div>)}</div></section>
									<section><h3 className="mb-3 text-base font-bold">Skill più frequenti</h3><div className="divide-y divide-[#dce3dc] border-y border-[#dce3dc] bg-white">{topSkills.length ? topSkills.map(({ skill, count }, index) => <div key={skill} className="flex items-center gap-3 px-3 py-3 text-sm"><span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span><span className="flex-1">{skill}</span><span className="font-mono text-xs text-slate-500">{count} candidati</span></div>) : <p className="px-3 py-4 text-sm text-slate-500">Nessuna skill disponibile.</p>}</div></section>
								</div>
								<section className="mt-8"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-bold">Ranking per la vacancy campione</h3><span className="text-xs text-slate-500">{sampleVacancy.title} / {sampleVacancy.companyName}</span></div><div className="divide-y divide-[#dce3dc] border-y border-[#dce3dc] bg-white">{rankedCandidates.map(({ candidate, score }, index) => <div key={candidate.id} className="flex flex-wrap items-center gap-3 px-3 py-3"><span className="grid size-7 place-items-center rounded bg-[#f5f7f2] font-mono text-xs">{index + 1}</span><span className="min-w-32 flex-1 text-sm font-semibold">{candidate.fullName}</span><span className="font-mono text-xs text-slate-500">{candidate.id}</span><span className="rounded bg-[#176b52] px-2 py-1 font-mono text-xs font-medium text-white">{score}/100</span></div>)}</div></section>
							</div>
						) : (
							<div className="overflow-hidden rounded-md border border-[#dce3dc] bg-white">
								<div className="hidden grid-cols-[minmax(150px,1.3fr)_minmax(120px,1fr)_minmax(100px,.8fr)_minmax(110px,.8fr)_minmax(90px,.6fr)] gap-3 border-b border-[#dce3dc] bg-[#eef2eb] px-4 py-3 text-[11px] font-bold uppercase text-slate-500 sm:grid"><span>Candidato</span><span>Seniorità</span><span>Esperienza</span><span>Salario atteso</span><span>Stato</span></div>
								{results.length === 0 ? <div className="px-5 py-12 text-center"><p className="text-base font-bold">Nessun candidato trovato</p><p className="mt-1 text-sm text-slate-500">Modifica i criteri e riprova.</p></div> : results.map((candidate) => <article key={candidate.id} className="grid gap-2 border-b border-[#dce3dc] px-4 py-4 last:border-0 sm:grid-cols-[minmax(150px,1.3fr)_minmax(120px,1fr)_minmax(100px,.8fr)_minmax(110px,.8fr)_minmax(90px,.6fr)] sm:items-center sm:gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{candidate.fullName}</p><p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{candidate.id} · {candidate.email}</p></div><div className="text-xs text-slate-600"><span className="sm:hidden">Seniorità: </span>{candidate.seniority}</div><div className="text-xs text-slate-600"><span className="sm:hidden">Esperienza: </span>{candidate.yearsOfExperience} anni</div><div className="font-mono text-xs font-medium">{money.format(candidate.expectedSalary)}</div><div><span className="inline-flex rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">{candidate.status}</span></div></article>)}
								{searchNote && <p className="border-t border-[#dce3dc] px-4 py-3 text-sm text-slate-600" aria-live="polite">{searchNote}</p>}
							</div>
						)}
					</section>
				</div>
				<footer className="mt-12 border-t border-[#dce3dc] py-5 text-xs text-slate-500">Dati dimostrativi Nexova · USD · funzioni di esempio secondo il context del Milestone 2</footer>
			</div>
		</main>
	);
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
	return <article className="rounded-md border border-[#dce3dc] bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}