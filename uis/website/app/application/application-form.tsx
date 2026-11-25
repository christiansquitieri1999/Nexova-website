"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type ApplicationValues = {
	fullName: string;
	email: string;
	phone: string;
	country: string;
	yearsExperience: string;
	sector: string;
	englishLevel: string;
	availability: string;
	linkedin: string;
	comments: string;
	dataPolicy: boolean;
};

type FieldName = keyof ApplicationValues;
type Errors = Partial<Record<FieldName, string>>;
type TextFieldName = "fullName" | "email" | "phone" | "linkedin";

const initialValues: ApplicationValues = {
	fullName: "", email: "", phone: "", country: "", yearsExperience: "", sector: "",
	englishLevel: "", availability: "", linkedin: "", comments: "", dataPolicy: false,
};

const allFields: FieldName[] = ["fullName", "email", "phone", "country", "yearsExperience", "sector", "englishLevel", "availability", "linkedin", "comments", "dataPolicy"];
const controlClass = "w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20";

function validate(values: ApplicationValues): Errors {
	const errors: Errors = {};
	if (values.fullName.trim().split(/\s+/).filter(Boolean).length < 2) errors.fullName = "Name must contain at least first and last name";
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email (example: <name@company.com>)";
	if (!/^\+\d{1,3}\s[\d\s()-]{6,}$/.test(values.phone.trim())) errors.phone = "Phone must include country code (example: +34 612 345 678)";
	if (!values.country) errors.country = "Select your country of residence";
	const years = Number(values.yearsExperience);
	if (values.yearsExperience === "" || !Number.isInteger(years) || years < 0 || years > 50) errors.yearsExperience = "Years of experience must be between 0 and 50";
	if (!values.sector) errors.sector = "Select your sector of interest";
	if (!values.englishLevel) errors.englishLevel = "Indicate your English level";
	if (!values.availability) errors.availability = "Select your availability";
	if (values.linkedin.trim() && !isValidHttpUrl(values.linkedin.trim())) errors.linkedin = "If you include LinkedIn, it must be a valid URL";
	if (values.comments.length > 500) errors.comments = `Comments cannot exceed 500 characters (${500 - values.comments.length} remaining)`;
	if (!values.dataPolicy) errors.dataPolicy = "You must accept the data processing policy to continue";
	return errors;
}

function isValidHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
	} catch {
		return false;
	}
}

export default function ApplicationForm() {
	const [values, setValues] = useState(initialValues);
	const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
	const [submitted, setSubmitted] = useState(false);
	const [success, setSuccess] = useState(false);
	const successRef = useRef<HTMLDivElement>(null);
	const errors = validate(values);
	const commentsRemaining = 500 - values.comments.length;

	useEffect(() => {
		if (success) successRef.current?.focus();
	}, [success]);

	function updateField(field: FieldName, value: string | boolean) {
		setValues((current) => ({ ...current, [field]: value }));
		setSuccess(false);
	}

	function visibleError(field: FieldName) {
		return touched[field] || submitted ? errors[field] : undefined;
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		setTouched(Object.fromEntries(allFields.map((field) => [field, true])));
		const currentErrors = validate(values);
		const firstInvalid = allFields.find((field) => currentErrors[field]);
		if (firstInvalid) {
			const ids: Record<FieldName, string> = {
				fullName: "fullName", email: "email", phone: "phone", country: "country", yearsExperience: "yearsExperience",
				sector: "sector", englishLevel: "englishLevel", availability: "availability-immediate", linkedin: "linkedin",
				comments: "comments", dataPolicy: "dataPolicy",
			};
			document.getElementById(ids[firstInvalid])?.focus();
			return;
		}
		setValues(initialValues);
		setTouched({});
		setSubmitted(false);
		setSuccess(true);
	}

	function clearForm() {
		setValues(initialValues);
		setTouched({});
		setSubmitted(false);
		setSuccess(false);
		document.getElementById("fullName")?.focus();
	}

	function fieldError(field: FieldName) {
		const message = visibleError(field);
		return <p id={`${field}-error`} className="mt-2 text-sm font-semibold text-red-700" role={message ? "alert" : undefined} aria-live="polite" hidden={!message}>{message}</p>;
	}

	function textField(name: TextFieldName, label: string, type: string, placeholder: string, autoComplete?: string) {
		const required = name !== "linkedin";
		const error = visibleError(name);
		return <div><label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-brand-600"> *</span>}</label><input id={name} name={name} type={type} autoComplete={autoComplete} required={required} value={values[name]} onChange={(event) => updateField(name, event.target.value)} onBlur={() => setTouched((current) => ({ ...current, [name]: true }))} aria-invalid={Boolean(error)} aria-describedby={`${name}-error`} className={controlClass} placeholder={placeholder} />{fieldError(name)}</div>;
	}

	return (
		<form className="mt-8 space-y-6 sm:space-y-8" noValidate onSubmit={handleSubmit}>
			<fieldset className="grid gap-5 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-6"><legend className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Contact details</legend>{textField("fullName", "Full name", "text", "First and last name", "name")}{textField("email", "Email", "email", "name@company.com", "email")}{textField("phone", "Phone", "tel", "+34 612 345 678", "tel")}<div><label htmlFor="country" className="mb-2 block text-sm font-semibold text-slate-700">Country of residence <span className="text-brand-600">*</span></label><select id="country" name="country" value={values.country} onChange={(event) => updateField("country", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, country: true }))} aria-invalid={Boolean(visibleError("country"))} aria-describedby="country-error" className={controlClass}><option value="">Select a country</option><option value="spain">Spain</option><option value="united-states">United States</option><option value="other">Other</option></select>{fieldError("country")}</div></fieldset>

			<fieldset className="grid gap-5 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 sm:p-6"><legend className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Professional profile</legend><div><label htmlFor="yearsExperience" className="mb-2 block text-sm font-semibold text-slate-700">Years of experience <span className="text-brand-600">*</span></label><input id="yearsExperience" name="yearsExperience" type="number" min="0" max="50" step="1" value={values.yearsExperience} onChange={(event) => updateField("yearsExperience", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, yearsExperience: true }))} aria-invalid={Boolean(visibleError("yearsExperience"))} aria-describedby="yearsExperience-error" className={controlClass} placeholder="8" />{fieldError("yearsExperience")}</div><div><label htmlFor="sector" className="mb-2 block text-sm font-semibold text-slate-700">Sector of interest <span className="text-brand-600">*</span></label><select id="sector" name="sector" value={values.sector} onChange={(event) => updateField("sector", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, sector: true }))} aria-invalid={Boolean(visibleError("sector"))} aria-describedby="sector-error" className={controlClass}><option value="">Select a sector</option><option value="technology">Technology</option><option value="retail">Retail</option><option value="financial-services">Financial Services</option><option value="consulting">Consulting</option><option value="other">Other</option></select>{fieldError("sector")}</div><div><label htmlFor="englishLevel" className="mb-2 block text-sm font-semibold text-slate-700">English level <span className="text-brand-600">*</span></label><select id="englishLevel" name="englishLevel" value={values.englishLevel} onChange={(event) => updateField("englishLevel", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, englishLevel: true }))} aria-invalid={Boolean(visibleError("englishLevel"))} aria-describedby="englishLevel-error" className={controlClass}><option value="">Select a level</option><option value="basic">Basic</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="native">Native</option></select>{fieldError("englishLevel")}</div>{textField("linkedin", "LinkedIn profile URL", "url", "https://linkedin.com/in/your-profile")}</fieldset>

			<fieldset className="rounded-xl border border-slate-200 p-4 sm:p-6"><legend className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Availability <span className="text-brand-600">*</span></legend><div className="grid gap-3 sm:grid-cols-2">{[{ value: "immediate", label: "Immediate" }, { value: "1-month", label: "1 month" }, { value: "2-3-months", label: "2-3 months" }, { value: "just-exploring", label: "Just exploring" }].map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><input id={`availability-${option.value}`} name="availability" type="radio" value={option.value} checked={values.availability === option.value} onChange={(event) => updateField("availability", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, availability: true }))} aria-describedby="availability-error" className="size-4 accent-brand-600" /><span className="text-sm font-semibold text-slate-700">{option.label}</span></label>)}</div>{fieldError("availability")}</fieldset>

			<fieldset className="space-y-5 rounded-xl border border-slate-200 p-4 sm:p-6"><legend className="px-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Additional information</legend><div><label htmlFor="comments" className="mb-2 block text-sm font-semibold text-slate-700">Additional comments</label><textarea id="comments" name="comments" rows={5} maxLength={500} value={values.comments} onChange={(event) => updateField("comments", event.target.value)} onBlur={() => setTouched((current) => ({ ...current, comments: true }))} aria-invalid={Boolean(visibleError("comments"))} aria-describedby="comments-counter comments-error" className={controlClass} placeholder="Share anything else our selection team should know." /><div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">{fieldError("comments")}<p id="comments-counter" className="text-sm font-semibold text-slate-500">{commentsRemaining} remaining</p></div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-start gap-3"><input id="dataPolicy" name="dataPolicy" type="checkbox" checked={values.dataPolicy} onChange={(event) => updateField("dataPolicy", event.target.checked)} onBlur={() => setTouched((current) => ({ ...current, dataPolicy: true }))} aria-invalid={Boolean(visibleError("dataPolicy"))} aria-describedby="dataPolicy-error" className="mt-1 size-4 rounded accent-brand-600" /><label htmlFor="dataPolicy" className="text-sm font-semibold leading-6 text-slate-700">I accept the data policy <span className="text-brand-600">*</span></label></div>{fieldError("dataPolicy")}</div></fieldset>

			{success && <div ref={successRef} tabIndex={-1} className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-900 focus-visible:outline-2 focus-visible:outline-green-700" role="status"><h2 className="text-xl font-black">Thank you for your interest in Nexova!</h2><p className="mt-2 leading-7">We have received your information. Our selection team will review it and contact you if your profile matches any of our current or future opportunities.</p><p className="mt-2 leading-7">In the meantime, follow us on LinkedIn to stay updated on our vacancies and professional development content.</p><p className="mt-2 text-sm font-semibold">Demonstration only: your details have not been submitted to a server.</p></div>}

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="submit" className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 focus-visible:outline-4 focus-visible:outline-brand-600/30 sm:w-auto">Submit application</button><button type="button" onClick={clearForm} className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700 sm:w-auto">Clear form</button></div><Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Back to home</Link></div>
		</form>
	);
}