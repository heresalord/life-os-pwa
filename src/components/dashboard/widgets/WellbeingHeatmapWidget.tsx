import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useDailyRecordsRange } from '../../../hooks/useRangeQueries'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import clsx from 'clsx'

export function WellbeingHeatmapWidget() {
  const navigate = useNavigate()

  const endDate   = new Date()
  const startDate = subDays(endDate, 29)
  const fromStr   = format(startDate, 'yyyy-MM-dd')
  const toStr     = format(endDate, 'yyyy-MM-dd')

  const { data: records = [], isLoading } = useDailyRecordsRange(fromStr, toStr)

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const getMoodColor = (mood: number | null | undefined) => {
    if (mood === undefined || mood === null) return 'bg-surface-2 border-border/40 hover:border-text-muted/40'
    if (mood === 1) return 'bg-danger border-danger/20 hover:scale-110'
    if (mood === 2) return 'bg-danger/50 border-danger/10 hover:scale-110'
    if (mood === 3) return 'bg-warning border-warning/20 hover:scale-110'
    if (mood === 4) return 'bg-success/50 border-success/10 hover:scale-110'
    return 'bg-success border-success/20 hover:scale-110'
  }

  const getMoodLabel = (mood: number | null | undefined) => {
    if (mood === 1) return 'Awful 😢'
    if (mood === 2) return 'Bad 😕'
    if (mood === 3) return 'Okay 😐'
    if (mood === 4) return 'Good 🙂'
    if (mood === 5) return 'Great 😄'
    return 'Not logged'
  }

  return (
    <div
      onClick={() => navigate('/day/history')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col justify-between h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Heart size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Wellbeing Heatmap</span>
        </div>
        <span className="text-[10px] text-text-muted font-medium">30-Day mood</span>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-10 gap-1.5 justify-center max-w-sm mx-auto">
              {days.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd')
                const rec     = records.find(r => r.date === dateStr)
                const mood    = rec?.mood

                return (
                  <div
                    key={dateStr}
                    className={clsx(
                      'aspect-square rounded-md border transition-all duration-200 cursor-pointer',
                      getMoodColor(mood)
                    )}
                    title={`${format(d, 'do MMM')}: ${getMoodLabel(mood)}`}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[9px] text-text-muted font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-danger" /> Awful
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-warning" /> Okay
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-success" /> Great
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
