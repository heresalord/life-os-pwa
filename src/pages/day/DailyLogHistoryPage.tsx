import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subDays } from 'date-fns'
import { Flame, Calendar, ChevronRight, TrendingUp, Trophy, Target, CalendarDays } from 'lucide-react'
import { db } from '../../db'
import { useAppStore } from '../../store/useAppStore'
import { displayDate, getUserLocalDate } from '../../lib/dateUtils'
import clsx from 'clsx'

const EMOJIS = ['😶', '😕', '😐', '🙂', '😊']

export function DailyLogHistoryPage() {
  const navigate = useNavigate()
  const { timezone } = useAppStore()

  // Load records reactively from Dexie
  const records = useLiveQuery(() => db.daily_records.toArray()) || []

  // Create mapping of date -> record
  const recordsMap = useMemo(() => {
    const map = new Map<string, typeof records[0]>()
    records.forEach(r => map.set(r.date, r))
    return map
  }, [records])

  // Heatmap: last 20 weeks
  const heatmapData = useMemo(() => {
    const numWeeks = 20
    const today = new Date()
    const start = startOfWeek(subDays(today, numWeeks * 7), { weekStartsOn: 1 })
    const end = endOfWeek(today, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })

    // Group days by week (columns)
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }
    return weeks
  }, [])

  // Calculate Streak metrics
  const stats = useMemo(() => {
    const todayStr = getUserLocalDate(timezone)
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
    
    // Total logged days
    const totalDays = records.length
    
    // Average Day Score
    const scoredRecords = records.filter(r => r.day_score !== null && r.day_score !== undefined)
    const averageScore = scoredRecords.length 
      ? Math.round(scoredRecords.reduce((sum, r) => sum + (r.day_score || 0), 0) / scoredRecords.length)
      : 0

    // Current Streak (consecutive days with morning_complete and evening_complete)
    let currentStreak = 0
    const baseDate = new Date(todayStr + 'T12:00:00')
    const todayRec = sorted.find(r => r.date === todayStr)
    const todayComplete = todayRec?.morning_complete && todayRec?.evening_complete
    
    let checkDate = todayComplete ? baseDate : subDays(baseDate, 1)

    while (true) {
      const checkStr = format(checkDate, 'yyyy-MM-dd')
      const rec = sorted.find(r => r.date === checkStr)
      if (rec?.morning_complete && rec?.evening_complete) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
      } else {
        break
      }
    }

    // Maximum Streak historically
    let maxStreak = 0
    let tempStreak = 0
    // Sort chronological for historical max streak
    const chronoRecords = [...records].sort((a, b) => a.date.localeCompare(b.date))
    
    // We count consecutive days in records list
    let prevDateObj: Date | null = null

    for (const rec of chronoRecords) {
      if (rec.morning_complete && rec.evening_complete) {
        const currentDateObj = new Date(rec.date + 'T12:00:00')
        if (prevDateObj) {
          const diffDays = Math.round((currentDateObj.getTime() - prevDateObj.getTime()) / (24 * 60 * 60 * 1000))
          if (diffDays === 1) {
            tempStreak++
          } else if (diffDays > 1) {
            tempStreak = 1
          }
        } else {
          tempStreak = 1
        }
        prevDateObj = currentDateObj
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak
        }
      } else {
        tempStreak = 0
        prevDateObj = null
      }
    }

    return { totalDays, averageScore, currentStreak, maxStreak }
  }, [records, timezone])

  // Get color for daily score cell
  const getCellClass = (score: number | null | undefined, isFuture: boolean) => {
    if (isFuture) return 'bg-transparent border-transparent'
    if (score === undefined || score === null) return 'bg-surface-2 border-border/80'
    if (score >= 80) return 'bg-success/70 border-success text-success-foreground'
    if (score >= 50) return 'bg-warning/70 border-warning text-warning-foreground'
    if (score > 0) return 'bg-danger/60 border-danger text-danger-foreground'
    return 'bg-surface-2 border-border/80'
  }

  // Sorted list of past logs (descending)
  const sortedArchive = useMemo(() => {
    return [...records].sort((a, b) => b.date.localeCompare(a.date))
  }, [records])

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/day')}
            className="text-xs text-accent font-semibold hover:underline mb-1.5 inline-block"
          >
            ← Back to Daily Log
          </button>
          <h1 className="text-2xl font-display font-semibold text-text flex items-center gap-2">
            <Calendar className="text-accent" />
            Wellbeing History & Heatmap
          </h1>
        </div>
      </header>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-surface border border-border rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-1">
          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning flex-shrink-0">
            <Flame size={16} className="fill-warning" />
          </div>
          <p className="text-2xl font-display font-bold text-text tabular-nums mt-1">{stats.currentStreak}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Current Streak</p>
          <p className="text-[10px] text-text-muted">consecutive days</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-1">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
            <Trophy size={16} />
          </div>
          <p className="text-2xl font-display font-bold text-text tabular-nums mt-1">{stats.maxStreak}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Max Streak</p>
          <p className="text-[10px] text-text-muted">all time best</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-1">
          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success flex-shrink-0">
            <Target size={16} />
          </div>
          <p className="text-2xl font-display font-bold text-text tabular-nums mt-1">{stats.averageScore}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Avg Day Score</p>
          <p className="text-[10px] text-text-muted">out of 100</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 text-center flex flex-col items-center justify-center space-y-1">
          <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center text-info flex-shrink-0">
            <CalendarDays size={16} />
          </div>
          <p className="text-2xl font-display font-bold text-text tabular-nums mt-1">{stats.totalDays}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Logged Days</p>
          <p className="text-[10px] text-text-muted">total entries logged</p>
        </div>
      </div>

      {/* 20-Week Score Heatmap Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Flame size={12} className="text-warning fill-warning" />
            20-Week Wellbeing Score Heatmap
          </h3>
          <span className="text-[10px] text-text-muted font-medium">Color reflects calculated day score</span>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-none flex justify-start">
          <div className="flex gap-2 flex-row">
            {/* Day Labels on left side */}
            <div className="flex flex-col gap-1.5 text-[9px] text-text-secondary pr-2 justify-between py-1 font-semibold">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>

            {/* Grid Columns (Weeks) */}
            <div className="flex gap-1.5">
              {heatmapData.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1.5">
                  {week.map((day, dIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const rec = recordsMap.get(dateStr)
                    const score = rec?.day_score
                    const isFuture = day > new Date()

                    return (
                      <button
                        key={dIdx}
                        disabled={isFuture}
                        onClick={() => navigate(`/day/${dateStr}`)}
                        title={`${displayDate(dateStr)}: ${score !== undefined ? `Score ${score}` : 'No Log'}`}
                        className={clsx(
                          'w-3.5 h-3.5 rounded-[4px] border transition-all hover:scale-110',
                          getCellClass(score, isFuture)
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center gap-4 text-[10px] text-text-muted justify-end pt-1 border-t border-border/30">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-success/70 border border-success" />
            <span>Good (≥80)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-warning/70 border border-warning" />
            <span>Okay (50-79)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-danger/60 border border-danger" />
            <span>Low (&lt;50)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-surface-2 border border-border" />
            <span>No Log</span>
          </div>
        </div>
      </div>

      {/* Archive Chronological Feed Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="pb-2 border-b border-border/50">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <TrendingUp size={16} className="text-accent" />
            All Logged Days Archive
          </h3>
        </div>

        {sortedArchive.length === 0 ? (
          <div className="text-center py-8 text-text-muted italic text-xs border border-dashed border-border rounded-xl">
            No daily records found. Complete your first morning or evening ritual to see logs here!
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto pr-1">
            {sortedArchive.map(rec => (
              <div
                key={rec.id}
                onClick={() => navigate(`/day/${rec.date}`)}
                className="flex items-center justify-between py-3 px-1.5 hover:bg-surface-2/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="space-y-1.5 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text group-hover:text-accent transition-colors">
                      {displayDate(rec.date, 'EEEE, MMM d, yyyy')}
                    </span>
                    {rec.mood && (
                      <span className="text-sm" title={`Mood: ${EMOJIS[rec.mood - 1]}`}>
                        {EMOJIS[rec.mood - 1]}
                      </span>
                    )}
                  </div>
                  
                  {/* Intention and Win snippets */}
                  <div className="space-y-0.5">
                    {rec.intent && (
                      <p className="text-[11px] text-text-secondary truncate">
                        <span className="font-semibold text-text-muted">Intention:</span> {rec.intent}
                      </p>
                    )}
                    {rec.win_of_day && (
                      <p className="text-[11px] text-text-secondary truncate">
                        <span className="font-semibold text-text-muted">Win:</span> {rec.win_of_day}
                      </p>
                    )}
                  </div>
                </div>

                {/* Score badge & Chevron */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={clsx(
                    'text-xs font-bold px-2.5 py-1 rounded-full border tabular-nums',
                    (rec.day_score ?? 0) >= 80 ? 'bg-success/10 border-success/20 text-success'
                    : (rec.day_score ?? 0) >= 50 ? 'bg-warning/10 border-warning/20 text-warning'
                    : 'bg-danger/10 border-danger/20 text-danger'
                  )}>
                    Score {rec.day_score ?? 0}
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-text transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
