import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Flame, Calendar, CheckCircle2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDb } from '../../db/DbContext'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import { subDays, format } from 'date-fns'

export function DailyLogWidget() {
  const db = useDb()
  const navigate = useNavigate()
  const { selectedDate, timezone } = useAppStore()

  // Reactively fetch daily records
  const records = useLiveQuery(() => db.daily_records.toArray()) || []
  
  // Find record for the selected date
  const selectedRecord = useMemo(() => {
    return records.find(r => r.date === selectedDate)
  }, [records, selectedDate])

  const morningComplete = selectedRecord?.morning_complete ?? false
  const eveningComplete = selectedRecord?.evening_complete ?? false

  // Calculate streak: consecutive days with BOTH morning and evening complete
  const streak = useMemo(() => {
    if (records.length === 0) return 0
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
    const todayStr = getUserLocalDate(timezone)
    
    // Check today's record
    const todayRec = sorted.find(r => r.date === todayStr)
    const todayComplete = todayRec?.morning_complete && todayRec?.evening_complete

    let currentStreak = 0
    const baseDate = new Date(todayStr + 'T12:00:00')
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
    return currentStreak
  }, [records, timezone])

  return (
    <div className="bg-surface border border-border rounded-2xl p-4.5 space-y-4 shadow-[var(--shadow-card)] relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text">Daily Log</h3>
        </div>
        
        {/* Streak Badge */}
        <div className="flex items-center gap-1 bg-warning/10 border border-warning/20 text-warning px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          <Flame size={12} className="fill-warning" />
          <span>{streak} Day Streak</span>
        </div>
      </div>

      {/* Routine Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Morning Button */}
        <button
          onClick={() => navigate(`/day?guided=morning`)}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
            morningComplete
              ? 'bg-warning/5 border-warning/20 text-warning'
              : 'bg-surface-2 border-border hover:border-warning/40 text-text-secondary hover:text-text'
          }`}
        >
          {morningComplete ? (
            <CheckCircle2 size={24} className="text-warning mb-2" />
          ) : (
            <Sun size={24} className="text-warning mb-2" />
          )}
          <span className="text-xs font-semibold">Morning Ritual</span>
          <span className="text-[10px] text-text-muted mt-1 font-medium">
            {morningComplete ? 'Completed' : 'Start Ritual'}
          </span>
        </button>

        {/* Evening Button */}
        <button
          onClick={() => navigate(`/day?guided=evening`)}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
            eveningComplete
              ? 'bg-info/5 border-info/20 text-info'
              : 'bg-surface-2 border-border hover:border-info/40 text-text-secondary hover:text-text'
          }`}
        >
          {eveningComplete ? (
            <CheckCircle2 size={24} className="text-info mb-2" />
          ) : (
            <Moon size={24} className="text-info mb-2" />
          )}
          <span className="text-xs font-semibold">Evening Review</span>
          <span className="text-[10px] text-text-muted mt-1 font-medium">
            {eveningComplete ? 'Completed' : 'Start Review'}
          </span>
        </button>
      </div>

      {/* Footer link to history log */}
      <div className="flex justify-between items-center pt-3 border-t border-border/50 text-xs">
        <span className="text-text-muted">
          {morningComplete && eveningComplete 
            ? '✨ Full log complete!' 
            : 'Log both rituals to build streak'}
        </span>
        <button
          onClick={() => navigate('/day/history')}
          className="text-accent font-semibold hover:underline"
        >
          View History & Heatmap
        </button>
      </div>
    </div>
  )
}
