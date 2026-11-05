export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8" aria-live="polite" aria-label="Loading professional profiles">
      {/* Header skeleton */}
      <div className="mb-10 flex items-center justify-between border-b border-zinc-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
      </div>

      {/* Title skeleton */}
      <div className="mb-6">
        <div className="mb-2 h-3 w-36 animate-pulse rounded bg-zinc-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
      </div>

      {/* Search + filters skeleton */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-zinc-200" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-zinc-200" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="bg-zinc-50 p-4">
          <div className="flex gap-4">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>
        <div className="divide-y divide-zinc-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-48 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-100" />
              <div className="size-5 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading professional profiles…</span>
    </main>
  );
}