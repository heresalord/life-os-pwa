import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, PenTool } from 'lucide-react'
import { useDailyRecord } from '../../../hooks/useDailyRecord'
import { useAppStore } from '../../../store/useAppStore'
import { haptic } from '../../../lib/haptic'
import clsx from 'clsx'

const MOODS = [
  { value: 1, label: 'Awful', emoji: '😢' },
  { value: 2, label: 'Bad', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
]

export function DailyLogQuickWidget() {
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()
  const { data: record, isLoading, upsert } = useDailyRecord(selectedDate)

  const [intentInput, setIntentInput] = useState('')

  // Sync local input with DB record
  useEffect(() => {
    if (record) {
      setIntentInput(record.intent ?? '')
    } else {
      setIntentInput('')
    }
  }, [record])

  const handleMoodSelect = (moodVal: number) => {
    haptic('medium')
    upsert.mutate({ mood: moodVal })
  }

  const handleIntentBlur = () => {
    if (record?.intent !== intentInput) {
      upsert.mutate({ intent: intentInput })
    }
  }

  const handleIntentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <div
      onClick={() => navigate('/day')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col justify-between h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Daily Quick Entry</span>
        </div>
        {record?.day_score !== undefined && (
          <span className="text-[10px] bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded-full">
            Score: {record.day_score}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Mood Picker */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-text-muted uppercase tracking-wider font-semibold pl-0.5">
                How is your mood?
              </label>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map(m => {
                  const isSelected = record?.mood === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation() // Prevent card click navigation
                        handleMoodSelect(m.value)
                      }}
                      className={clsx(
                        "flex flex-col items-center justify-center py-2.5 rounded-xl border text-xl transition-all duration-200 aspect-square hover:scale-105 active:scale-95",
                        isSelected
                          ? "bg-accent/10 border-accent/60 shadow-inner scale-105"
                          : "bg-surface-2 border-border/80 text-text-muted hover:border-text-secondary"
                      )}
                      title={m.label}
                    >
                      <span>{m.emoji}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Daily Intent */}
            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider font-semibold pl-0.5 flex items-center gap-1">
                <PenTool size={10} /> Today's Intent
              </label>
              <input
                type="text"
                value={intentInput}
                onChange={e => setIntentInput(e.target.value)}
                onBlur={handleIntentBlur}
                onKeyDown={handleIntentKeyDown}
                placeholder="What is your focus today?"
                className="w-full bg-surface-2 border border-border/70 rounded-xl px-3 py-2 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
