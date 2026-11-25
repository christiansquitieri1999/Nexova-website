export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8" aria-live="polite" aria-label="Loading professional profile">
      {/* Back link skeleton */}
      <div className="mb-8 border-b border-zinc-200 pb-5">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
      </div>

      {/* Profile header skeleton */}
      <div className="mb-2 h-3 w-36 animate-pulse rounded bg-zinc-200" />
      <div className="mb-2 h-8 w-64 animate-pulse rounded bg-zinc-200" />
      <div className="mb-8 h-4 w-48 animate-pulse rounded bg-zinc-200" />

      {/* Detail grid skeleton */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="min-w-0 bg-white px-5 py-4">
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading professional profile…</span>
    </main>
  );
}