
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { useDailyRecord } from '../../hooks/useDailyRecord'
import { useAgendaQuery } from '../../hooks/useAgendaQuery'
import { carryOverTasks } from '../../lib/carryOver'
import { getUserLocalDate } from '../../lib/dateUtils'
import { subDays } from 'date-fns'
import { Sun, ArrowRight, Check } from 'lucide-react'

export function MorningPage() {
  const { user } = useAuth()
  const { selectedDate, timezone } = useAppStore()
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1)
  
  // Step 1 state
  const [carryCount, setCarryCount] = useState<number | null>(null)
  const [carrying, setCarrying] = useState(true)

  // Step 2 state
  const { data: record, upsert } = useDailyRecord(selectedDate)
  const [intent, setIntent] = useState('')

  // Step 3 state
  const { data: agenda = [] } = useAgendaQuery(selectedDate)

  // Initialization
  useEffect(() => {
    if (record?.intent && !intent) setIntent(record.intent)
  }, [record])

  useEffect(() => {
    async function runCarryOver() {
      if (!user) return
      // Safe local date parsing
      const dateObj = new Date(selectedDate + 'T12:00:00')
      const yesterdayStr = getUserLocalDate(timezone, subDays(dateObj, 1))
      
      const count = await carryOverTasks(user.id, yesterdayStr, selectedDate)
      setCarryCount(count)
      setCarrying(false)
    }
    
    if (step === 1 && carrying) {
      runCarryOver()
    }
  }, [step, user, selectedDate, timezone])

  const handleNextStep1 = () => setStep(2)
  
  const handleNextStep2 = async () => {
    if (intent.trim() !== record?.intent) {
      await upsert.mutateAsync({ intent: intent.trim() })
    }
    setStep(3)
  }

  const handleFinish = () => {
    navigate('/')
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-md mx-auto">
      
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display text-text flex items-center gap-2">
            <Sun className="text-warning" size={24} /> Morning Setup
          </h1>
          <span className="text-text-muted text-sm font-medium">{step} / 3</span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
          <div className="bg-warning h-full transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {/* STEP 1: Carry Over */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto mb-6">
              {carrying ? (
                <div className="w-6 h-6 border-2 border-warning/30 border-t-warning rounded-full animate-spin" />
              ) : (
                <Check className="text-warning" size={28} />
              )}
            </div>
            <h2 className="text-xl font-medium text-text">Checking yesterday's tasks</h2>
            
            <p className="text-text-secondary leading-relaxed">
              {carrying ? (
                'Reviewing pending tasks from yesterday to carry forward...'
              ) : carryCount === 0 ? (
                'You had a clean slate yesterday! Nothing to carry over.'
              ) : (
                `Moved ${carryCount} pending task${carryCount !== 1 ? 's' : ''} to today's list.`
              )}
            </p>
          </div>

          <button onClick={handleNextStep1} disabled={carrying} className="w-full flex items-center justify-center gap-2 py-3.5 bg-warning text-bg font-medium rounded-xl hover:bg-warning/90 transition-colors disabled:opacity-50">
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: Intent */}
      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-text">Daily Intent</h2>
            <p className="text-text-secondary leading-relaxed text-sm">
              What is the single most important thing for you today? Set a clear intention.
            </p>
            
            <textarea
              autoFocus
              value={intent}
              onChange={e => setIntent(e.target.value)}
              placeholder="Today, I intend to..."
              rows={4}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-warning focus:ring-1 focus:ring-warning focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3.5 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            <button onClick={handleNextStep2} className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-warning text-bg font-medium rounded-xl hover:bg-warning/90 transition-colors">
              Continue <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Agenda Review */}
      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-text">Today's Agenda</h2>
            
            {agenda.length === 0 ? (
              <div className="p-6 bg-surface-2 rounded-xl text-center border border-border border-dashed">
                <p className="text-text-secondary text-sm">No time blocks scheduled yet.</p>
                <button onClick={() => navigate('/agenda')} className="mt-4 text-warning text-sm font-medium hover:underline">
                  Plan your day
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {agenda.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border text-sm">
                    <div className="w-16 flex-shrink-0 text-text-muted font-medium">
                      {b.start_time.slice(0, 5)}
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="truncate text-text font-medium">{b.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <button onClick={() => setStep(2)} className="flex-1 py-3.5 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            <button onClick={handleFinish} className="flex-[2] py-3.5 bg-warning text-bg font-medium rounded-xl hover:bg-warning/90 transition-colors">
              Start Day
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
