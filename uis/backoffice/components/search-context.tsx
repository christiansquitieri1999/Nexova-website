const SEARCH_CONTEXT = [
  { label: "Position", value: "Executive Assistant" },
  { label: "Company", value: "Nexova" },
  { label: "Location", value: "Valencia headquarters" },
  {
    label: "Profile",
    value:
      "Executive support experience, calendar and travel management, professional English and Spanish",
  },
] as const;

export default function SearchContext() {
  return (
    <section
      aria-labelledby="search-context-heading"
      className="mb-8 border-y border-zinc-200 py-5"
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 text-emerald-800"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 12 21.07l1.71-1.71" />
        </svg>
        <h2 id="search-context-heading">Context of the active search</h2>
      </div>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {SEARCH_CONTEXT.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-zinc-500">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm text-zinc-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
