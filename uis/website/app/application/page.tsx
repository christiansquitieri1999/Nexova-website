import Link from "next/link";
import ApplicationForm from "./application-form";

export default function ApplicationPage() {
	return (
		<main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<header className="mb-8 flex items-center gap-3"><Link href="/" className="flex items-center gap-3" aria-label="Back to Nexova home"><span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-lg font-bold text-white">N</span><span><span className="block text-xl font-black text-slate-900">Nexova</span><span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">People &amp; Talent</span></span></Link></header>
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 lg:p-10">
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Application</p>
				<h1 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Join our talent pool</h1>
				<p className="mt-4 max-w-2xl leading-7 text-slate-600">Register your professional profile so Nexova&apos;s selection team can consider you for current and future opportunities across technology, retail, financial services, consulting, and related roles.</p>
				<p className="mt-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">Are you a company looking for talent? Write to us at <a href="mailto:contacto@nexova.com" className="underline decoration-2 underline-offset-4">contacto@nexova.com</a></p>
				<ApplicationForm />
			</section>
		</main>
	);
}