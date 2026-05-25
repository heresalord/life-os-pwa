
export function YearProgressBar() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear() + 1, 0, 1)
  const pct = Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
  return (
    <div className="mb-5">
      <div className="flex justify-between text-xs text-text-muted mb-1.5">
        <span>{now.getFullYear()}</span>
        <span>{pct}% of the year</span>
      </div>
      <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full bg-accent/60 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
