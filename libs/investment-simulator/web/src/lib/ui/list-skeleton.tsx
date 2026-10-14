/** Placeholder rows under a loading status; the status text says what loads. */
export function ListSkeleton({ label }: { readonly label: string }) {
  return (
    <div className="grid gap-4 p-6">
      <p role="status" className="m-0 text-muted">
        {label}
      </p>
      <div aria-hidden="true" className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 motion-safe:animate-pulse"
          >
            <span className="size-10 shrink-0 rounded-surface bg-accent-soft" />
            <span className="grid flex-1 gap-2">
              <span className="h-3 w-1/3 rounded-control bg-border" />
              <span className="h-3 w-2/3 rounded-control bg-accent-soft" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
