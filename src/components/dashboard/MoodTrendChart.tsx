import { useMemo } from 'react'
import { subDays, format } from 'date-fns'
import { useDailyRecordsRange } from '../../hooks/useRangeQueries'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'

const MOOD_EMOJI  = ['', '😶', '😕', '😐', '🙂', '😊']
const MOOD_COLORS = ['', '#5a5550', '#b86a6a', '#c8a96a', '#6a9e72', '#6a8ab8']
const MOOD_LABELS = ['', 'Low', 'Difficult', 'Okay', 'Good', 'Great']

export function MoodTrendChart() {
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const from  = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 29))

  const { data: records = [], isLoading } = useDailyRecordsRange(from, today)

  const chartData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(today + 'T12:00:00'), 29 - i)
      return format(d, 'yyyy-MM-dd')
    })
    return days.map(date => {
      const rec = records.find(r => r.date === date)
      return { date, mood: rec?.mood ?? null }
    })
  }, [records, today])

  const moodValues = chartData.map(d => d.mood).filter((m): m is number => m !== null)
  const avg = moodValues.length ? (moodValues.reduce((s, m) => s + m, 0) / moodValues.length).toFixed(1) : null
  const streak = (() => {
    let s = 0
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].mood !== null) s++
      else break
    }
    return s
  })()

  if (isLoading) return null

  // SVG line chart
  const W = 300, H = 80
  const points = chartData
    .map((d, i) => d.mood !== null ? { x: (i / 29) * W, y: H - ((d.mood - 1) / 4) * H, mood: d.mood } : null)
    .filter((p): p is { x: number; y: number; mood: number } => p !== null)

  const pathD = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : null

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Mood — 30 days</h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {avg && <span>Avg {avg} {MOOD_EMOJI[Math.round(parseFloat(avg))]}</span>}
          {streak > 0 && <span>{streak} day streak</span>}
        </div>
      </div>

      {points.length < 2 ? (
        <p className="text-xs text-text-muted py-4 text-center">Log your mood during morning or evening ritual to see trends here.</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20 overflow-visible">
            {/* Grid lines */}
            {[1, 2, 3, 4, 5].map(v => (
              <line key={v} x1="0" x2={W}
                y1={H - ((v - 1) / 4) * H} y2={H - ((v - 1) / 4) * H}
                stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 4" />
            ))}

            {/* Area fill */}
            {pathD && (
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`}
                fill="var(--color-accent)" fillOpacity="0.08" />
            )}

            {/* Line */}
            {pathD && (
              <path d={pathD} fill="none"
                stroke="var(--color-accent)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Dots */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3"
                fill={MOOD_COLORS[p.mood]} stroke="var(--color-surface)" strokeWidth="1.5" />
            ))}
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none -ml-6">
            {[5, 4, 3, 2, 1].map(v => (
              <span key={v} className="text-[9px] text-text-muted">{MOOD_EMOJI[v]}</span>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 overflow-x-auto pb-0.5">
        {[1, 2, 3, 4, 5].map(v => (
          <div key={v} className="flex items-center gap-1 flex-shrink-0">
            <div className="w-2 h-2 rounded-full" style={{ background: MOOD_COLORS[v] }} />
            <span className="text-[10px] text-text-muted">{MOOD_LABELS[v]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
