import { useNavigate } from 'react-router-dom'
import { getWeek, getDayOfYear } from 'date-fns'
import { CalendarDays } from 'lucide-react'

export function YearProgressWidget() {
  const navigate = useNavigate()
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  const pct = Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
  const day = getDayOfYear(now)
  const week = getWeek(now)
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div
      onClick={() => navigate('/agenda')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col justify-between h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between text-xs text-text-muted mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">{year} Year Progress</span>
        </div>
        <span className="text-[10px] bg-surface-2 px-2 py-0.5 rounded-full">{daysLeft}d left</span>
      </div>

      <div className="space-y-2 flex-1 flex flex-col justify-end">
        <div className="flex justify-between items-baseline text-xs text-text-muted">
          <div className="flex gap-3 text-[11px]">
            <span>Day <strong className="text-text">{day}</strong></span>
            <span>Week <strong className="text-text">{week}</strong></span>
          </div>
          <span className="font-display font-semibold text-xl text-accent">{pct}%</span>
        </div>
        
        <div className="h-2 bg-surface-2 border border-border/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent/40 to-accent rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
