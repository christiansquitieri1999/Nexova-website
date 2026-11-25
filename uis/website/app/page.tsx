import Image from "next/image";
import Link from "next/link";

const organizationSchema = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "Nexova",
	description: "Human resources consulting and talent acquisition",
	url: "https://nexova.com",
	foundingDate: "2011",
	address: [
		{ "@type": "PostalAddress", addressCountry: "ES", addressLocality: "Valencia", addressRegion: "Comunidad Valenciana" },
		{ "@type": "PostalAddress", addressCountry: "US", addressLocality: "Miami", addressRegion: "Florida" },
	],
	contactPoint: { "@type": "ContactPoint", telephone: "+34-960-123-456", contactType: "customer service", availableLanguage: ["Spanish", "English"] },
	sameAs: ["https://linkedin.com/company/nexova", "https://instagram.com/nexova"],
};

const services = [
	{ title: "Executive Headhunting", accent: "bg-brand-100 text-brand-700", mark: "01", copy: "Search and selection of executive and mid-management profiles through a personalized process with replacement guarantee." },
	{ title: "Customer Support Outsourcing", accent: "bg-amber-100 text-amber-800", mark: "02", copy: "Specialized support teams for technology companies, backed by continuous training and dedicated supervision." },
	{ title: "Corporate Training", accent: "bg-emerald-100 text-emerald-800", mark: "03", copy: "Soft skills and leadership programs delivered through in-person and online courses adapted to each organization." },
];

const strengths = [
	{ number: "01", title: "12 years of experience", copy: "Founded in 2011, Nexova brings more than a decade of structured HR consulting and talent acquisition practice to the Latin American market." },
	{ number: "02", title: "Regional presence", copy: "Our Valencia headquarters and Miami expansion office support clients and candidates across Spain and the United States." },
	{ number: "03", title: "+500 successful selection processes", copy: "Mid-sized companies choose Nexova for sector specialization in technology, retail, and finance, plus practical support from search through onboarding." },
	{ number: "04", title: "Sector specialization", copy: "Dedicated expertise in technology, retail, and finance helps Nexova understand each client's hiring context, team needs, and leadership expectations." },
];

export default function Home() {
	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
			<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-5 focus:py-3 focus:font-bold focus:text-brand-700">Skip to main content</a>
			<header className="sticky top-0 z-50 bg-white/90 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
					<a href="#main-content" className="flex items-center gap-3" aria-label="Nexova home"><span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-lg font-extrabold text-white">N</span><span><span className="block text-3xl font-extrabold leading-none tracking-[-0.06em] text-ink">Nexova</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">People &amp; Talent</span></span></a>
					<nav className="order-last flex w-full items-center justify-center gap-4 overflow-x-auto text-sm font-medium text-slate-600 md:order-none md:w-auto md:gap-8" aria-label="Main navigation"><a href="#top" className="hover:text-brand-600">Home</a><a href="#services" className="hover:text-brand-600">Services</a><Link href="/application" className="hover:text-brand-600">Talent</Link><a href="#contact" className="hover:text-brand-600">Contact</a></nav>
					<Link href="/application" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">Join our talent pool</Link>
				</div>
			</header>

			<main id="main-content" tabIndex={-1}>
				<section id="top" className="relative overflow-hidden bg-[#edf4ff]">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(17,24,39,0.03),transparent_30%)]" aria-hidden="true" />
					<div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:py-20">
						<div className="flex flex-col justify-center"><h1 className="max-w-[12ch] text-5xl font-extrabold leading-[0.95] text-[#101b32] sm:text-6xl lg:text-7xl">We build exceptional teams for growing companies</h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Human resources consulting and talent acquisition firm with over 10 years helping technology, retail, and financial services companies find and develop the best talent.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/application" className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">Join our talent pool</Link><a href="#services" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600">Explore services</a></div><dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">{[{ label: "Experience", value: "12 yrs" }, { label: "Processes", value: "500+" }, { label: "Presence", value: "ES + US" }].map((item) => <div key={item.label} className="border-t-2 border-brand-600 bg-white/80 p-3 sm:p-4"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{item.label}</dt><dd className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{item.value}</dd></div>)}</dl></div>
						<div className="relative flex items-center justify-center"><div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl"><Image src="/images/hero-team.jpg" alt="Recruitment team discussing candidates in a modern office environment" width={1200} height={900} className="h-[420px] w-full rounded-[1.5rem] object-cover sm:h-[540px]" /><div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/30 bg-slate-900/75 p-4 text-white backdrop-blur-sm"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-100">Valencia to Miami</p><p className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">Structured talent services for companies ready to scale.</p></div></div></div>
					</div>
				</section>

				<section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="services-title"><div className="mb-10 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Services</p><h2 id="services-title" className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Three talent services for companies ready to grow with confidence.</h2></div><div className="grid gap-6 md:grid-cols-3">{services.map((service) => <article key={service.title} className="border-t-2 border-slate-200 py-5 transition hover:border-brand-600" aria-label={service.title}><span className={`inline-grid size-11 place-items-center rounded-xl font-mono text-sm font-bold ${service.accent}`}>{service.mark}</span><h3 className="mt-4 text-xl font-bold text-slate-900">{service.title}</h3><p className="mt-3 leading-7 text-slate-600">{service.copy}</p></article>)}</div></section>

				<section id="why-nexova" className="bg-slate-900 text-white" aria-labelledby="why-title"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"><div className="mb-10 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">Why Nexova</p><h2 id="why-title" className="mt-3 text-3xl font-black sm:text-4xl">Proven regional experience for technology, retail, and financial services teams.</h2></div><div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><Image src="/images/team-strategy.jpg" alt="Business team reviewing hiring strategy in a collaborative meeting" width={1400} height={1000} className="h-[360px] w-full rounded-2xl object-cover lg:h-[480px]" /><div className="grid gap-5 sm:grid-cols-2">{strengths.map((item) => <article key={item.number} className="flex items-start gap-4 border-t border-slate-700 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-500/20 font-bold text-brand-100">{item.number}</span><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p></div></article>)}</div></div></div></section>

				<section id="experience" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="experience-title"><div className="mb-8 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Real experiences</p><h2 id="experience-title" className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Stories that show why people and companies trust Nexova.</h2></div><div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"><div className="space-y-6"><article className="border-b border-slate-200 pb-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">Candidate story</p><blockquote className="mt-3 text-xl font-medium leading-8 text-slate-800 sm:text-2xl">“I had gone through a lot of interviews before Nexova. They made me feel seen, explained the process clearly, and helped me understand the role in a way that felt honest and human.”</blockquote><p className="mt-4 font-semibold text-slate-900">Maria L. — Product Designer</p></article><article><p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">Client story</p><blockquote className="mt-3 text-xl font-medium leading-8 text-slate-800 sm:text-2xl">“We needed a hiring partner who could understand both our culture and the people behind the profiles. Nexova brought clarity, speed, and a process that respected everyone involved.”</blockquote><p className="mt-4 font-semibold text-slate-900">Daniel R. — People Lead, ScaleLab</p></article></div><Image src="/images/candidate-interview.jpg" alt="Candidate speaking with a recruiter during a professional interview" width={1200} height={900} className="h-[420px] w-full rounded-2xl object-cover sm:h-[520px]" /></div></section>
				</main>

			<footer id="contact" className="bg-slate-950 text-slate-200" aria-label="Contact information"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"><div><p className="text-xl font-black text-white">Nexova <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">People &amp; Talent</span></p><p className="mt-5 max-w-lg leading-7 text-slate-300">Human resources consulting and talent acquisition firm helping companies in Spain and the United States build stronger teams.</p></div><div><h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Contact</h3><ul className="mt-4 space-y-3"><li><a href="mailto:contacto@nexova.com" className="hover:text-white">contacto@nexova.com</a></li><li>Valencia: <a href="tel:+34960123456" className="hover:text-white">+34 960 123 456</a></li><li>Miami: <a href="tel:+13055550191" className="hover:text-white">+1 305 555 0191</a></li><li className="flex gap-4"><a href="https://linkedin.com/company/nexova">LinkedIn</a><a href="https://instagram.com/nexova">Instagram</a></li><li><Link href="/application" className="inline-flex rounded-full bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-200">Apply now</Link></li></ul></div></div><div className="mt-10 border-t border-slate-800 pt-6 text-sm text-slate-400">© 2025 Nexova. All rights reserved.</div></div></footer>
		</>
	);
}