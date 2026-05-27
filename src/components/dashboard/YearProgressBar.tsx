import { getWeek, getDayOfYear } from 'date-fns'

export function YearProgressBar() {
  const now   = new Date()
  const year  = now.getFullYear()
  const start = new Date(year, 0, 1)
  const end   = new Date(year + 1, 0, 1)
  const pct   = Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
  const day   = getDayOfYear(now)
  const week  = getWeek(now)
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-text-muted mb-1.5">
        <div className="flex items-center gap-3">
          <span className="font-medium text-text">{year}</span>
          <span>Day {day}</span>
          <span>Week {week}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">{daysLeft}d left</span>
          <span className="font-medium text-text">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent/60 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
