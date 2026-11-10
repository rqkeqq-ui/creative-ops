export function PageSkeleton() {
  return (
    <div className="page-skeleton" data-testid="route-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка страницы…</span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="skeleton h-2.5 w-28" />
          <div className="skeleton mt-3 h-7 w-56 max-w-full" />
          <div className="skeleton mt-2.5 h-3 w-80 max-w-full" />
        </div>
        <div className="skeleton h-9 w-32" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-[116px] rounded-xl" />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="skeleton h-[360px] rounded-xl" />
        <div className="skeleton h-[360px] rounded-xl" />
      </div>
    </div>
  )
}
