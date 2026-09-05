import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { 
  Sun, Moon, Zap, Award, FileText, CheckCircle2, 
  ArrowRight, Check, Plus, Edit2, Play, Eye, ChevronLeft, ChevronRight, ChevronDown,
  Frown, Annoyed, Meh, Smile, Laugh, X, Star, AlertTriangle, CalendarDays,
  Flame, Heart, ListChecks, Wind
} from 'lucide-react'
import { subDays, addDays, format, isToday, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useDailyRecord } from '../../hooks/useDailyRecord'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useAppStore } from '../../store/useAppStore'
import { calculateDayScore } from '../../lib/scoreUtils'
import { displayDate } from '../../lib/dateUtils'
import { useAuth } from '../../hooks/useAuth'
import { carryOverTasks } from '../../lib/carryOver'
import { useDb } from '../../db/DbContext'
import { haptic } from '../../lib/haptic'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useDailyLogStreak } from '../../hooks/useDailyLogStreak'

const MOOD_ICONS = [Frown, Annoyed, Meh, Smile, Laugh]
const MOOD_LABELS = ['Low', 'Difficult', 'Okay', 'Good', 'Great']

const JOURNAL_TEMPLATES = {
  blank: '',
  gratitude: `## Morning Gratitude
1. I am grateful for...
2. I am grateful for...
3. I am grateful for...

## What would make today great?
- [ ] 
- [ ] `,
  weekly_review: `## Weekly Review
### Achievements & Wins
- 

### Challenges & Roadblocks
- 

### Key Learnings
- 

### Focus for Next Week
- `,
  stress_log: `## Stress Log
### What is causing me stress?
- 

### What can I control about it?
- 

### Action Steps (Things I can do today/tomorrow)
- [ ] `
}

const TEMPLATE_OPTIONS = [
  { key: 'blank' as const, label: 'Blank', icon: FileText },
  { key: 'gratitude' as const, label: 'Gratitude', icon: Heart },
  { key: 'weekly_review' as const, label: 'Weekly', icon: ListChecks },
  { key: 'stress_log' as const, label: 'Stress', icon: Wind },
]

export function DailyLogPage() {
  const { date: paramDate } = useParams<{ date: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { selectedDate } = useAppStore()
  const activeDate = paramDate || selectedDate

  // Fetch daily records and tasks
  const { data: record, upsert } = useDailyRecord(activeDate)
  const { data: tasks = [] } = useTasksQuery(activeDate)
  const { addTask, updateTask } = useTaskMutations(activeDate)
  const { user } = useAuth()
  const db = useDb()

  // Streak data for continuity badges
  const { currentStreak } = useDailyLogStreak()

  // Guided mode parameter check
  const guidedMode = searchParams.get('guided') // 'morning' | 'evening' | null

  // Carry over state
  const [carryOverRunning, setCarryOverRunning] = useState(false)
  const [carryOverCount, setCarryOverCount] = useState<number | null>(null)

  // Section expansion state for progressive disclosure
  const [morningExpanded, setMorningExpanded] = useState(false)
  const [eveningExpanded, setEveningExpanded] = useState(false)
  const [eveningUnlockedEarly, setEveningUnlockedEarly] = useState(false)

  // Template confirmation dialog state
  const [confirmTemplateOpen, setConfirmTemplateOpen] = useState(false)
  const [pendingTemplateKey, setPendingTemplateKey] = useState<keyof typeof JOURNAL_TEMPLATES | null>(null)

  // Wizard completion celebratory beat
  const [wizardCelebration, setWizardCelebration] = useState<boolean>(false)

  // Carry-over is guarded by a localStorage key so it runs at most once per
  // user+date pair, even across remounts, page refreshes, and wizard re-opens.
  useEffect(() => {
    async function checkAndCarryOver() {
      if (!user || guidedMode !== 'morning' || carryOverRunning) return

      const flagKey = `carryover:${user.id}:${activeDate}`
      const stored = localStorage.getItem(flagKey)
      if (stored !== null) {
        setCarryOverCount(parseInt(stored, 10))
        return
      }

      setCarryOverRunning(true)
      try {
        const dateObj = new Date(activeDate + 'T12:00:00')
        const yesterdayStr = format(subDays(dateObj, 1), 'yyyy-MM-dd')
        const count = await carryOverTasks(db, user.id, yesterdayStr, activeDate)
        setCarryOverCount(count)
        localStorage.setItem(flagKey, String(count))
      } catch (err) {
        console.error('Carry over failed:', err)
      } finally {
        setCarryOverRunning(false)
      }
    }
    checkAndCarryOver()
  }, [guidedMode, user, activeDate, carryOverRunning, db])

  // --- Morning state ---
  const [energyAm, setEnergyAm] = useState<number>(3)
  const [intention, setIntention] = useState<string>('')
  const [gratitude, setGratitude] = useState<string[]>(['', '', ''])
  const [newTaskTitle, setNewTaskTitle] = useState<string>('')

  // --- Evening state ---
  const [mood, setMood] = useState<number>(3)
  const [energyPm, setEnergyPm] = useState<number>(3)
  const [winOfDay, setWinOfDay] = useState<string>('')
  const [wentWell, setWentWell] = useState<string>('')
  const [doDifferently, setDoDifferently] = useState<string>('')
  const [tomorrowFocus, setTomorrowFocus] = useState<string>('')

  // --- Journal state ---
  const [journal, setJournal] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof JOURNAL_TEMPLATES>('blank')
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false)

  // --- UI Save Indicator ---
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle')

  // --- Guided Wizard Step ---
  const [wizardStep, setWizardStep] = useState<number>(1)

  // Reset to step 1 whenever the wizard type changes
  useEffect(() => {
    setWizardStep(1)
    setWizardCelebration(false)
  }, [guidedMode])

  // Reset preview mode when navigating to a different date
  useEffect(() => {
    setIsPreviewMode(false)
    setEveningUnlockedEarly(false)
  }, [activeDate])

  // Populate fields from the loaded record — only on first load per date
  const populatedDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (!record) return
    if (populatedDateRef.current === activeDate) return
    populatedDateRef.current = activeDate

    if (record.energy_am !== null && record.energy_am !== undefined) setEnergyAm(record.energy_am)
    if (record.intent !== null && record.intent !== undefined) setIntention(record.intent)
    if (Array.isArray(record.gratitude)) {
      setGratitude([
        typeof record.gratitude[0] === 'string' ? record.gratitude[0] : '',
        typeof record.gratitude[1] === 'string' ? record.gratitude[1] : '',
        typeof record.gratitude[2] === 'string' ? record.gratitude[2] : ''
      ])
    }
    if (record.mood !== null && record.mood !== undefined) setMood(record.mood)
    if (record.energy_pm !== null && record.energy_pm !== undefined) setEnergyPm(record.energy_pm)
    if (record.win_of_day !== null && record.win_of_day !== undefined) setWinOfDay(record.win_of_day)
    if (record.went_well !== null && record.went_well !== undefined) setWentWell(record.went_well)
    if (record.do_differently !== null && record.do_differently !== undefined) setDoDifferently(record.do_differently)
    if (record.tomorrow_focus !== null && record.tomorrow_focus !== undefined) setTomorrowFocus(record.tomorrow_focus)
    if (record.journal !== null && record.journal !== undefined) setJournal(record.journal)
  }, [record, activeDate])

  // Top tasks priorities calculation (priority >= 4)
  const priorities = useMemo(() => {
    return tasks.filter(t => (t.priority || 0) >= 4)
  }, [tasks])

  const otherTasks = useMemo(() => {
    return tasks.filter(t => (t.priority || 0) < 4)
  }, [tasks])

  // Day score calculation
  const dayScoreValue = useMemo(() => {
    return calculateDayScore(tasks, record?.mood ?? null, record?.energy_am ?? null, record?.energy_pm ?? null)
  }, [tasks, record])

  // §0 Fix: Completion Model & Save Fields Wrapper
  // Evaluates field presence to auto-mark completion if criteria are satisfied
  const handleSaveFields = useCallback(async (updates: Record<string, any>) => {
    setSaveStatus('saving')
    try {
      const curEnergyAm = updates.energy_am !== undefined ? updates.energy_am : energyAm
      const curIntent = updates.intent !== undefined ? updates.intent : intention
      const curGratitude = updates.gratitude !== undefined ? updates.gratitude : gratitude

      const curWinOfDay = updates.win_of_day !== undefined ? updates.win_of_day : winOfDay

      // Auto-derive morning completion if energy, intention, and at least one gratitude are entered
      const morningDerived = Boolean(
        record?.morning_complete || updates.morning_complete ||
        (curEnergyAm != null && curIntent?.trim() && curGratitude.some((g: string) => g?.trim()))
      )

      // Auto-derive evening completion if mood, energy, and win are entered.
      // Mood/energy are checked against the *persisted* record, not the local
      // slider state — the sliders default to 3 on mount, so a local-state
      // check would read as "set" even when the user never touched them.
      const savedMood = updates.mood !== undefined ? updates.mood : record?.mood
      const savedEnergyPm = updates.energy_pm !== undefined ? updates.energy_pm : record?.energy_pm
      const eveningDerived = Boolean(
        record?.evening_complete || updates.evening_complete ||
        (savedMood != null && savedEnergyPm != null && curWinOfDay?.trim())
      )

      const payload: Record<string, any> = {
        ...updates,
        ...(morningDerived && !record?.morning_complete ? { morning_complete: true } : {}),
        ...(eveningDerived && !record?.evening_complete ? { evening_complete: true } : {})
      }

      await upsert.mutateAsync(payload)
      setSaveStatus('saved')
      haptic('success')
    } catch (err) {
      console.error(err)
      setSaveStatus('error')
      haptic('error')
    }
  }, [energyAm, intention, gratitude, mood, energyPm, winOfDay, record, upsert])

  // §7 Debounced autosave ref for text typing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedSave = useCallback((updates: Record<string, any>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      handleSaveFields(updates)
    }, 800)
  }, [handleSaveFields])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // --- Guided Mode Handlers ---
  const startWizard = (type: 'morning' | 'evening') => {
    haptic('light')
    setSearchParams({ guided: type })
    setWizardStep(1)
  }

  // §5 Motion & Feedback: 350ms celebratory checkmark beat before dismiss
  const finishMorningWizard = async () => {
    try {
      await upsert.mutateAsync({
        energy_am: energyAm,
        intent: intention,
        gratitude,
        morning_complete: true
      })
      haptic('success')
      setWizardCelebration(true)
      setTimeout(() => {
        setWizardCelebration(false)
        setSearchParams({})
      }, 400)
    } catch {
      setSaveStatus('error')
      haptic('error')
    }
  }

  const finishEveningWizard = async () => {
    try {
      await upsert.mutateAsync({
        mood,
        energy_pm: energyPm,
        win_of_day: winOfDay,
        went_well: wentWell,
        do_differently: doDifferently,
        tomorrow_focus: tomorrowFocus,
        evening_complete: true
      })
      haptic('success')
      setWizardCelebration(true)
      setTimeout(() => {
        setWizardCelebration(false)
        setSearchParams({})
      }, 400)
    } catch {
      setSaveStatus('error')
      haptic('error')
    }
  }

  // --- Priority Task Management ---
  const handleAddPriorityTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    await addTask.mutateAsync({
      title: newTaskTitle.trim(),
      priority: 5,
      date: activeDate,
      kanban_status: 'todo'
    })
    setNewTaskTitle('')
  }

  const toggleTaskPriority = async (taskId: string, currentPriority: number | null) => {
    haptic('light')
    const nextPriority = (currentPriority || 0) >= 4 ? null : 5
    await updateTask.mutateAsync({
      id: taskId,
      updates: { priority: nextPriority }
    })
  }

  const toggleTaskCompletion = async (taskId: string, currentCompleted: boolean) => {
    haptic('light')
    await updateTask.mutateAsync({
      id: taskId,
      updates: {
        completed: !currentCompleted,
        completed_at: !currentCompleted ? new Date().toISOString() : null
      }
    })
  }

  // --- Journal Helper with ConfirmDialog ---
  const requestTemplate = (templateKey: keyof typeof JOURNAL_TEMPLATES) => {
    haptic('light')
    if (!journal.trim()) {
      applyTemplateImmediate(templateKey)
      return
    }
    setPendingTemplateKey(templateKey)
    setConfirmTemplateOpen(true)
  }

  const applyTemplateImmediate = (templateKey: keyof typeof JOURNAL_TEMPLATES) => {
    setSelectedTemplate(templateKey)
    const newContent = JOURNAL_TEMPLATES[templateKey]
    setJournal(newContent)
    handleSaveFields({ journal: newContent })
  }

  // §6 Accessibility: 44px min touch target lightning scale
  const renderLightningScale = (currentVal: number, onChange: (val: number) => void, readonly = false) => {
    return (
      <div className="flex gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map(val => (
          <button
            key={val}
            disabled={readonly}
            type="button"
            aria-label={`Energy level ${val} of 5`}
            onClick={() => {
              haptic('light')
              onChange(val)
            }}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200 ease-out ${
              val <= currentVal
                ? 'bg-warning/15 border-warning text-warning scale-105'
                : 'bg-surface-2 border-border text-text-muted hover:border-warning/30 hover:text-text'
            } ${readonly ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
          >
            <Zap size={20} className={val <= currentVal ? 'fill-warning' : ''} />
          </button>
        ))}
      </div>
    )
  }

  // §6 Accessibility & Motion: Mood scale with min 44px hit targets and consistent easing
  const renderMoodScale = (currentVal: number, onChange: (val: number) => void, readonly = false, compact = false) => {
    return (
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map(val => {
          const MoodIcon = MOOD_ICONS[val - 1]
          const isSelected = currentVal === val
          return (
            <button
              key={val}
              disabled={readonly}
              type="button"
              aria-label={`Mood: ${MOOD_LABELS[val - 1]}`}
              onClick={() => {
                haptic('light')
                onChange(val)
              }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center transition-all duration-200 ease-out ${
                compact ? 'py-3 px-1' : 'p-3'
              } rounded-xl border ${
                isSelected
                  ? 'bg-info/15 border-info text-info scale-105 font-medium'
                  : 'bg-surface-2 border-border text-text-muted hover:border-info/30 hover:bg-surface-2/80 hover:text-text'
              } ${readonly ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
            >
              <MoodIcon
                size={compact ? 22 : 24}
                className={`${compact ? '' : 'mb-1'} ${
                  isSelected ? 'text-info' : 'text-text-muted'
                }`}
              />
              {!compact && (
                <span className={`text-xs font-medium ${
                  isSelected ? 'text-info' : 'text-text-muted'
                }`}>
                  {MOOD_LABELS[val - 1]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const dateInputRef = useRef<HTMLInputElement>(null)

  // Auto-clear the "saved" status after 2s
  useEffect(() => {
    if (saveStatus !== 'saved') return
    const t = setTimeout(() => setSaveStatus('idle'), 2000)
    return () => clearTimeout(t)
  }, [saveStatus])

  // Time-aware ritual suggestions (§1 IA)
  const currentHour = new Date().getHours()
  const isMorningComplete = Boolean(record?.morning_complete)
  const isEveningComplete = Boolean(record?.evening_complete)
  const isEveningTime = currentHour >= 17 // after 5pm
  const isPastNoon = currentHour >= 12

  // Determine whether evening card is currently unlocked
  const eveningUnlocked = isMorningComplete || isPastNoon || eveningUnlockedEarly

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 relative">
      {/* Header — minimal iOS-style nav with accessible 44px tap targets */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/day/${format(subDays(parseISO(activeDate + 'T12:00:00'), 1), 'yyyy-MM-dd')}`)}
            className="w-11 h-11 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text flex items-center justify-center transition-colors"
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-display font-bold text-text px-1">
            {displayDate(activeDate, 'EEE, MMM d')}
          </h1>
          <button
            onClick={() => navigate(`/day/${format(addDays(parseISO(activeDate + 'T12:00:00'), 1), 'yyyy-MM-dd')}`)}
            disabled={isToday(parseISO(activeDate + 'T12:00:00'))}
            className="w-11 h-11 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* §2 Save status: Green dot + visible "Saved" text fading together */}
          <div
            className="flex items-center gap-1.5 transition-opacity duration-500 select-none"
            style={{ opacity: saveStatus === 'saved' ? 1 : 0 }}
            aria-live="polite"
          >
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs font-medium text-success">Saved</span>
          </div>

          {saveStatus === 'error' && (
            <span className="text-xs text-danger flex items-center gap-1" aria-live="polite">
              <AlertTriangle size={13} /> Error saving
            </span>
          )}

          {/* §7 Visible tappable affordance chip for date picker */}
          <button
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
            className="w-11 h-11 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/80 text-text-secondary hover:text-text flex items-center justify-center transition-colors shadow-xs"
            title="Jump to date"
            aria-label="Jump to date"
          >
            <CalendarDays size={18} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={activeDate}
            onChange={e => { if (e.target.value) navigate(`/day/${e.target.value}`) }}
            className="sr-only"
            aria-label="Jump to date"
          />
        </div>
      </header>

      {/* ========================================================
          §1 & §4: PRIMARY MOMENT CTA (One primary action sized to the moment)
          ======================================================== */}
      {(!isMorningComplete || !isEveningComplete) ? (
        <section
          className={`border rounded-2xl p-5 shadow-[var(--shadow-card)] transition-all ${
            !isMorningComplete && !isEveningTime
              ? 'bg-gradient-to-r from-amber-500/10 via-surface to-surface border-warning/30'
              : 'bg-gradient-to-r from-indigo-500/10 via-surface to-surface border-info/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {!isMorningComplete && !isEveningTime ? 'Morning Habit Loop' : 'Evening Review'}
                </span>
                {currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                    <Flame size={12} className="fill-warning" />
                    {currentStreak}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-display font-bold text-text">
                {!isMorningComplete && !isEveningTime ? 'Start your morning with focus' : 'Close out your day intentionally'}
              </h2>
              {currentStreak >= 3 && (
                <p className="text-xs text-text-secondary">
                  {currentStreak} day streak · keep your momentum going
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!isMorningComplete && !isEveningTime ? (
                <button
                  onClick={() => startWizard('morning')}
                  className="w-full sm:w-auto px-6 h-12 bg-amber-400 text-gray-900 rounded-xl font-semibold text-sm hover:bg-amber-300 active:scale-98 transition-all flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <Play size={16} className="fill-gray-900" />
                  <span>Start Morning Ritual</span>
                  {currentStreak > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold pl-1 border-l border-gray-900/20">
                      <Flame size={13} className="fill-gray-900" /> {currentStreak}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => startWizard('evening')}
                  className="w-full sm:w-auto px-6 h-12 bg-indigo-500 text-white rounded-xl font-semibold text-sm hover:bg-indigo-400 active:scale-98 transition-all flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <Play size={16} className="fill-white" />
                  <span>Start Evening Review</span>
                  {currentStreak > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold pl-1 border-l border-white/20">
                      <Flame size={13} className="fill-white" /> {currentStreak}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-r from-success/10 via-surface to-surface border border-success/30 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">All rituals completed for today</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Day Score: <strong className="text-text font-semibold">{dayScoreValue}/100</strong>
                {currentStreak > 0 && ` · ${currentStreak} day streak maintained`}
              </p>
            </div>
          </div>
          {currentStreak > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/15 text-warning border border-warning/30 text-xs font-bold">
              <Flame size={14} className="fill-warning" />
              <span>{currentStreak} Days</span>
            </div>
          )}
        </section>
      )}

      {/* Habit Cards Grid */}
      <div className="space-y-4">
        
        {/* ========================================================
            SECTION 1: MORNING RITUAL (Collapsed summary row when complete)
            ======================================================== */}
        {isMorningComplete ? (
          <section className="bg-surface border border-border border-l-4 border-l-warning rounded-2xl p-4 shadow-[var(--shadow-card)] transition-all">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
                  <Sun size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text">Morning Ritual</h2>
                    <span className="text-[11px] bg-success/15 border border-success/30 text-success px-2 py-0.5 rounded-full font-medium">
                      Complete
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {intention ? `Intention: "${intention}"` : `Energy level: ${energyAm}/5`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startWizard('morning')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text transition-colors flex items-center gap-1.5"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => setMorningExpanded(!morningExpanded)}
                  aria-label={morningExpanded ? "Collapse morning details" : "Expand morning details"}
                  className="w-8 h-8 rounded-xl hover:bg-surface-2 text-text-muted hover:text-text flex items-center justify-center transition-colors"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${morningExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Read-only expanded detail */}
            {morningExpanded && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-4 text-xs">
                <div>
                  <span className="text-text-secondary font-medium block mb-1.5">Energy</span>
                  {renderLightningScale(energyAm, () => {}, true)}
                </div>

                {intention && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1">Intention</span>
                    <p className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-text font-normal">
                      {intention}
                    </p>
                  </div>
                )}

                {gratitude.some(g => g.trim()) && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1.5">Grateful for</span>
                    <ul className="space-y-2">
                      {gratitude.filter(g => g.trim()).map((g, idx) => (
                        <li key={idx} className="flex items-center gap-2 p-2 bg-surface-2 border border-border/80 rounded-xl text-text">
                          <span className="text-text-muted font-semibold">{idx + 1}.</span>
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {priorities.length > 0 && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1.5">Priorities</span>
                    <ul className="space-y-2">
                      {priorities.map(t => (
                        <li key={t.id} className="flex items-center justify-between p-2.5 bg-surface-2 border border-border rounded-xl">
                          <span className={`truncate text-xs ${t.completed ? 'line-through text-text-muted' : 'text-text'}`}>
                            {t.title}
                          </span>
                          <span className="text-[11px] text-warning font-medium">Priority</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <section
            className="bg-surface border border-border border-l-4 border-l-warning rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-5"
            style={{ background: 'linear-gradient(to right, rgba(251,191,36,0.04), transparent)' }}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <h2 className="text-base font-semibold text-text flex items-center gap-2">
                <Sun size={18} className="text-warning" />
                Morning Ritual
              </h2>
            </div>

            {/* §2 Copy: "Energy" */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Energy</label>
              {renderLightningScale(energyAm, (val) => {
                setEnergyAm(val)
                handleSaveFields({ energy_am: val })
              })}
            </div>

            {/* §2 Copy: "Intention" + "What matters most today?" */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Intention</label>
              <input
                type="text"
                value={intention}
                onChange={(e) => {
                  setIntention(e.target.value)
                  debouncedSave({ intent: e.target.value })
                }}
                onBlur={() => handleSaveFields({ intent: intention })}
                placeholder="What matters most today?"
                className="w-full bg-surface-2 border border-border focus:border-warning focus:ring-1 focus:ring-warning rounded-xl px-3.5 py-2.5 text-sm text-text focus:outline-none transition-all"
              />
            </div>

            {/* §2 Copy: "Grateful for" */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Grateful for</label>
              <div className="space-y-2">
                {gratitude.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-sm text-text">
                    <span className="text-text-muted font-medium text-xs">{idx + 1}.</span>
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const copy = [...gratitude]
                        copy[idx] = e.target.value
                        setGratitude(copy)
                        debouncedSave({ gratitude: copy })
                      }}
                      onBlur={() => handleSaveFields({ gratitude })}
                      placeholder="I'm grateful for..."
                      className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full placeholder-text-muted text-sm text-text"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* §2 Copy: "Priorities" (drop "(linked to Tasks)") */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">Priorities</label>
              
              {/* List priorities */}
              {priorities.length === 0 ? (
                <p className="text-xs text-text-muted italic py-1">Nothing set yet — add one below.</p>
              ) : (
                <ul className="space-y-2">
                  {priorities.map(t => (
                    <li key={t.id} className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <button 
                          onClick={() => toggleTaskCompletion(t.id, t.completed)}
                          aria-label={t.completed ? "Mark task incomplete" : "Mark task complete"}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            t.completed ? 'bg-success border-success text-bg' : 'border-border hover:border-success/50'
                          }`}
                        >
                          {t.completed && <Check size={13} strokeWidth={3} />}
                        </button>
                        <span className={`text-xs font-medium truncate ${t.completed ? 'line-through text-text-muted' : 'text-text'}`}>
                          {t.title}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleTaskPriority(t.id, t.priority)}
                        aria-label="Remove from priorities"
                        className="flex items-center gap-1 text-xs font-medium text-warning hover:underline"
                      >
                        <Star size={12} className="fill-warning" /> Priority
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Quick add priority task */}
              <form onSubmit={handleAddPriorityTask} className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add priority task..."
                  className="flex-1 bg-surface-2 border border-border focus:border-warning rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Add priority task"
                  className="w-10 h-9 bg-warning text-bg rounded-xl hover:bg-warning/90 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </form>

              {/* §2 Copy: "Add from today's tasks" */}
              {otherTasks.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-text-secondary mb-2">Add from today's tasks</p>
                  <div className="max-h-28 overflow-y-auto space-y-2 pr-2">
                    {otherTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs text-text-secondary bg-surface-2/60 px-3 py-2 rounded-xl border border-border/50">
                        <span className="truncate pr-2">{t.title}</span>
                        <button
                          onClick={() => toggleTaskPriority(t.id, t.priority)}
                          aria-label={`Set priority for ${t.title}`}
                          className="flex items-center gap-1 text-xs font-medium text-accent hover:underline flex-shrink-0"
                        >
                          <Star size={12} /> Set Priority
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Guided mode full-width primary CTA */}
            <button
              onClick={() => startWizard('morning')}
              className="w-full flex items-center justify-center gap-2 h-12 bg-amber-400 text-gray-900 rounded-xl font-semibold text-sm hover:bg-amber-300 active:scale-98 transition-all shadow-sm"
            >
              <Play size={16} className="fill-gray-900" /> Start Morning Ritual
              {currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold pl-2 border-l border-gray-900/20">
                  <Flame size={12} className="fill-gray-900" /> {currentStreak}
                </span>
              )}
            </button>
          </section>
        )}

        {/* ========================================================
            SECTION 2: EVENING REVIEW (Progressive disclosure: stays closed until morning complete or past noon)
            ======================================================== */}
        {!eveningUnlocked ? (
          <section className="bg-surface border border-border/60 rounded-2xl p-4 text-xs text-text-secondary flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Moon size={16} className="text-text-muted" />
              <span>Evening Review opens once morning ritual is completed or after 12:00.</span>
            </div>
            <button
              onClick={() => setEveningUnlockedEarly(true)}
              className="text-xs text-accent hover:underline font-medium flex-shrink-0"
            >
              Open early
            </button>
          </section>
        ) : isEveningComplete ? (
          <section className="bg-surface border border-border border-l-4 border-l-info rounded-2xl p-4 shadow-[var(--shadow-card)] transition-all">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                  <Moon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text">Evening Review</h2>
                    <span className="text-[11px] bg-success/15 border border-success/30 text-success px-2 py-0.5 rounded-full font-medium">
                      Complete
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {winOfDay ? `Win: "${winOfDay}"` : `Mood: ${MOOD_LABELS[mood - 1]} · Energy: ${energyPm}/5`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startWizard('evening')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text transition-colors flex items-center gap-1.5"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => setEveningExpanded(!eveningExpanded)}
                  aria-label={eveningExpanded ? "Collapse evening details" : "Expand evening details"}
                  className="w-8 h-8 rounded-xl hover:bg-surface-2 text-text-muted hover:text-text flex items-center justify-center transition-colors"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${eveningExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Read-only expanded detail */}
            {eveningExpanded && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-4 text-xs">
                <div>
                  <span className="text-text-secondary font-medium block mb-1.5">Mood</span>
                  {renderMoodScale(mood, () => {}, true)}
                </div>

                <div>
                  <span className="text-text-secondary font-medium block mb-1.5">Energy</span>
                  {renderLightningScale(energyPm, () => {}, true)}
                </div>

                {winOfDay && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1">Today's win</span>
                    <p className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-text">
                      {winOfDay}
                    </p>
                  </div>
                )}

                {(wentWell || doDifferently || tomorrowFocus) && (
                  <div className="space-y-2 pt-1">
                    {wentWell && (
                      <div>
                        <span className="text-text-secondary font-medium block mb-1">What went well?</span>
                        <p className="p-2.5 bg-surface-2/60 border border-border/80 rounded-xl text-text">{wentWell}</p>
                      </div>
                    )}
                    {doDifferently && (
                      <div>
                        <span className="text-text-secondary font-medium block mb-1">What I'd do differently?</span>
                        <p className="p-2.5 bg-surface-2/60 border border-border/80 rounded-xl text-text">{doDifferently}</p>
                      </div>
                    )}
                    {tomorrowFocus && (
                      <div>
                        <span className="text-text-secondary font-medium block mb-1">Tomorrow's Focus</span>
                        <p className="p-2.5 bg-surface-2/60 border border-border/80 rounded-xl text-text">{tomorrowFocus}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <section
            className="bg-surface border border-border border-l-4 border-l-info rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-5"
            style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.04), transparent)' }}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <h2 className="text-base font-semibold text-text flex items-center gap-2">
                <Moon size={18} className="text-info" />
                Evening Review
              </h2>
            </div>

            {/* §2 Copy: "Mood" */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Mood</label>
              {renderMoodScale(mood, (val) => {
                setMood(val)
                handleSaveFields({ mood: val })
              })}
            </div>

            {/* §2 Copy: "Energy" */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Energy</label>
              {renderLightningScale(energyPm, (val) => {
                setEnergyPm(val)
                handleSaveFields({ energy_pm: val })
              })}
            </div>

            {/* §2 Copy: "Today's win" + accessible non-color character counter */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-text-secondary">Today's win</label>
                <span className={`text-xs flex items-center gap-1 ${
                  winOfDay.length >= 260
                    ? 'text-warning font-medium'
                    : 'text-text-muted'
                }`}>
                  {winOfDay.length >= 260 && <AlertTriangle size={11} />}
                  {winOfDay.length} / 280
                </span>
              </div>
              <textarea
                value={winOfDay}
                maxLength={280}
                onChange={(e) => {
                  setWinOfDay(e.target.value)
                  debouncedSave({ win_of_day: e.target.value })
                }}
                onBlur={() => handleSaveFields({ win_of_day: winOfDay })}
                placeholder="What was the highlight of your day?"
                rows={2}
                className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3.5 py-2.5 text-sm text-text focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Structured prompts */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">What went well?</label>
                <textarea
                  value={wentWell}
                  onChange={(e) => {
                    setWentWell(e.target.value)
                    debouncedSave({ went_well: e.target.value })
                  }}
                  onBlur={() => handleSaveFields({ went_well: wentWell })}
                  placeholder="Log achievements, good habits, or items that went smoothly..."
                  rows={2}
                  className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">What I'd do differently?</label>
                <textarea
                  value={doDifferently}
                  onChange={(e) => {
                    setDoDifferently(e.target.value)
                    debouncedSave({ do_differently: e.target.value })
                  }}
                  onBlur={() => handleSaveFields({ do_differently: doDifferently })}
                  placeholder="Log challenges or actions you'd improve next time..."
                  rows={2}
                  className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Tomorrow's Focus</label>
                <textarea
                  value={tomorrowFocus}
                  onChange={(e) => {
                    setTomorrowFocus(e.target.value)
                    debouncedSave({ tomorrow_focus: e.target.value })
                  }}
                  onBlur={() => handleSaveFields({ tomorrow_focus: tomorrowFocus })}
                  placeholder="What is tomorrow's key direction or top goal?"
                  rows={2}
                  className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            {/* Guided mode full-width primary CTA */}
            <button
              onClick={() => startWizard('evening')}
              className="w-full flex items-center justify-center gap-2 h-12 bg-indigo-500 text-white rounded-xl font-semibold text-sm hover:bg-indigo-400 active:scale-98 transition-all shadow-sm"
            >
              <Play size={16} className="fill-white" /> Start Evening Review
              {currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold pl-2 border-l border-white/20">
                  <Flame size={12} className="fill-white" /> {currentStreak}
                </span>
              )}
            </button>
          </section>
        )}
      </div>

      {/* ========================================================
          §1 & §3: SECTION 3: FREE JOURNAL (Monochrome/Neutral, Below Habit Loop)
          ======================================================== */}
      <section className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border/50 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <FileText size={18} className="text-text-secondary" />
            Free Journal
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Preview toggle */}
            <button
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="text-xs font-semibold py-1.5 px-3 bg-surface-2 border border-border text-text rounded-xl hover:bg-surface-3 transition-colors flex items-center gap-2"
            >
              {isPreviewMode ? (
                <><Edit2 size={13} /> Write</>
              ) : (
                <><Eye size={13} /> Preview</>
              )}
            </button>
          </div>
        </div>

        {/* §2 & §3: Template picker with Lucide icons */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {TEMPLATE_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => requestTemplate(key)}
              className={`flex-shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-full border flex items-center gap-1.5 transition-all ${
                selectedTemplate === key
                  ? 'bg-text/10 border-text/40 text-text font-semibold'
                  : 'bg-surface-2 border-border text-text-secondary hover:text-text hover:border-text-secondary'
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Journal Editor or Preview */}
        {isPreviewMode ? (
          <div className="prose prose-invert max-w-none text-sm text-text bg-surface-2/50 border border-border rounded-xl p-4 min-h-[180px]">
            {journal.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{journal}</ReactMarkdown>
            ) : (
              <p className="text-text-muted italic">Nothing written yet. Write something in Editor mode.</p>
            )}
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateAreas: '"overlap"' }}>
            <pre
              aria-hidden
              style={{
                gridArea: 'overlap',
                visibility: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                padding: '0.75rem 1rem',
                margin: 0,
              }}
            >{journal + ' '}</pre>
            <textarea
              value={journal}
              onChange={(e) => {
                setJournal(e.target.value)
                debouncedSave({ journal: e.target.value })
              }}
              onBlur={() => handleSaveFields({ journal })}
              placeholder="Reflect freely about your day here (supports full markdown formatting)..."
              style={{
                gridArea: 'overlap',
                resize: 'none',
                overflow: 'hidden',
                minHeight: '140px',
              }}
              className="w-full bg-surface-2 border border-border focus:border-border-hover rounded-xl px-4 py-3 text-sm text-text focus:outline-none transition-all font-mono"
            />
          </div>
        )}
      </section>

      {/* ========================================================
          §1 & §3: SECTION 4: DAY SCORE (Neutral styling, Below Habits)
          ======================================================== */}
      <section className="p-5 bg-surface border border-border rounded-2xl shadow-[var(--shadow-card)] space-y-4">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <Award size={16} className="text-text-muted" />
          Day Score
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Circular Score Gauge */}
          <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="40"
                stroke="var(--color-border)" strokeWidth="8" fill="transparent" className="opacity-25"
              />
              <circle
                cx="50" cy="50" r="40"
                stroke={dayScoreValue >= 80 ? 'var(--color-success)' : dayScoreValue >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}
                strokeWidth="8" fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * dayScoreValue) / 100}
                className="transition-all duration-1000 ease-out" strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-display font-bold text-text tabular-nums">{dayScoreValue}</span>
              <span className="text-[10px] block text-text-muted">/ 100</span>
            </div>
          </div>

          {/* Component Score breakdown */}
          <div className="flex-1 space-y-2.5 text-xs w-full">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Task Completion</span>
              <span className="font-semibold text-text">
                {(() => {
                  const nonSkipped = tasks.filter(t => !t.skipped)
                  if (nonSkipped.length === 0) return '—'
                  return `${Math.round((tasks.filter(t => t.completed).length / nonSkipped.length) * 100)}%`
                })()}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Mood</span>
              <span className="font-semibold text-text">{record?.mood ? `${(record.mood - 1) * 25}/100` : '—'}</span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Energy</span>
              <span className="font-semibold text-text">
                {(() => {
                  let avg = 3
                  if (record?.energy_am != null && record?.energy_pm != null) {
                    avg = ((record.energy_am ?? 3) + (record.energy_pm ?? 3)) / 2
                  } else if (record?.energy_am != null) {
                    avg = record.energy_am ?? 3
                  } else if (record?.energy_pm != null) {
                    avg = record.energy_pm ?? 3
                  }
                  return `${Math.round((avg - 1) * 25)}/100`
                })()}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* §2 Custom ConfirmDialog for replacing journal template */}
      <ConfirmDialog
        open={confirmTemplateOpen}
        onOpenChange={setConfirmTemplateOpen}
        title="Replace journal?"
        description="This swaps in the template and clears what's currently written."
        confirmLabel="Replace journal"
        variant="danger"
        onConfirm={() => {
          if (pendingTemplateKey) {
            applyTemplateImmediate(pendingTemplateKey)
            setPendingTemplateKey(null)
          }
        }}
      />

      {/* ========================================================
          GUIDED MODE — FULL-SCREEN IMMERSIVE WIZARD
          (With reduced-motion handling & celebratory completion beat)
          ======================================================== */}
      {(guidedMode === 'morning' || guidedMode === 'evening') && createPortal((() => {
        const isMorning = guidedMode === 'morning'
        const totalSteps = 4
        const pct = Math.round((wizardStep / totalSteps) * 100)

        // Gradient config
        const gradientFrom = isMorning ? 'from-amber-950' : 'from-indigo-950'
        const gradientTo   = isMorning ? 'to-orange-900'  : 'to-blue-950'
        const accentColor  = isMorning ? '#f59e0b' : '#60a5fa'
        const accentLight  = isMorning ? 'text-amber-400'  : 'text-blue-400'
        const accentBg     = isMorning ? 'bg-amber-400'    : 'bg-blue-400'
        const accentBorder = isMorning ? 'border-amber-400/30' : 'border-blue-400/30'
        const accentFocusBorder = isMorning ? 'focus:border-amber-400' : 'focus:border-blue-400'
        const btnPrimary   = isMorning
          ? 'bg-amber-400 hover:bg-amber-300 text-gray-900'
          : 'bg-blue-500  hover:bg-blue-400  text-white'
        const btnFinish    = 'bg-emerald-500 hover:bg-emerald-400 text-white'

        // Progress ring (SVG)
        const r = 28
        const circ = 2 * Math.PI * r
        const dash = circ - (circ * pct) / 100

        return (
          <div
            className={`fixed inset-0 z-50 bg-gradient-to-br ${gradientFrom} ${gradientTo} flex flex-col overflow-hidden`}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
              style={{ backgroundColor: accentColor, transform: 'translate(30%, -30%)' }} />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
              style={{ backgroundColor: accentColor, transform: 'translate(-30%, 30%)' }} />

            {/* §5 Celebratory Completion Beat Overlay */}
            {wizardCelebration && (
              <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center motion-safe:animate-in motion-safe:fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg scale-110">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-display font-bold text-white">
                  {isMorning ? 'Morning Ritual complete' : 'Evening Review complete'}
                </h3>
                <p className="text-white/70 text-xs mt-1">Great job investing in your day.</p>
              </div>
            )}

            {/* Top bar */}
            <div className="relative flex items-center justify-between px-5 pt-safe pt-4 pb-3">
              {/* Close button with aria-label */}
              <button
                onClick={() => setSearchParams({})}
                aria-label="Close wizard"
                className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <X size={18} className="text-white" />
              </button>

              {/* Progress ring */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={r} stroke="white" strokeOpacity="0.15" strokeWidth="4" fill="none" />
                  <circle
                    cx="32" cy="32" r={r}
                    stroke={accentColor}
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={circ}
                    strokeDashoffset={dash}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-white">{wizardStep}/{totalSteps}</span>
              </div>

              {/* Mode label */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border ${accentBorder}`}>
                {isMorning ? <Sun size={14} className={accentLight} /> : <Moon size={14} className={accentLight} />}
                <span className={`text-xs font-semibold ${accentLight}`}>
                  {isMorning ? 'Morning' : 'Evening'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mx-5 mb-2 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${accentBg} transition-all duration-500 rounded-full`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Step content with motion-safe animations */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="max-w-md mx-auto">

                {/* ── MORNING STEPS ── */}
                {isMorning && wizardStep === 1 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 1 · Energy Check</p>
                      <h2 className="text-2xl font-display font-bold text-white">How's your morning energy?</h2>
                      <p className="text-white/60 text-xs mt-1">Rate how energized you feel right now.</p>
                    </div>
                    <div className="flex justify-center gap-3 py-2">
                      {renderLightningScale(energyAm, setEnergyAm)}
                    </div>
                    {carryOverRunning && (
                      <p className="text-xs text-amber-300/70 text-center flex items-center justify-center gap-2 animate-pulse">
                        <Zap size={12} /> Checking yesterday's tasks…
                      </p>
                    )}
                    {carryOverCount !== null && carryOverCount > 0 && (
                      <div className="bg-white/5 border border-amber-400/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-300 flex items-center justify-center gap-2">
                          <Zap size={12} className="fill-amber-400" /> Carried over {carryOverCount} task{carryOverCount !== 1 ? 's' : ''} from yesterday
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isMorning && wizardStep === 2 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 2 · Intention</p>
                      <h2 className="text-2xl font-display font-bold text-white">Set your intention</h2>
                      <p className="text-white/60 text-xs mt-1">What matters most today?</p>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={intention}
                      onChange={e => setIntention(e.target.value)}
                      placeholder="What matters most today?"
                      className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} focus:ring-0 rounded-xl px-4 py-3.5 text-white placeholder-white/40 text-sm outline-none backdrop-blur-sm transition-colors`}
                    />
                  </div>
                )}

                {isMorning && wizardStep === 3 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 3 · Gratitude</p>
                      <h2 className="text-2xl font-display font-bold text-white">Grateful for</h2>
                      <p className="text-white/60 text-xs mt-1">3 things you're genuinely grateful for.</p>
                    </div>
                    <div className="space-y-3">
                      {gratitude.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full ${accentBg}/20 flex items-center justify-center text-xs font-bold ${accentLight} flex-shrink-0`}>{idx + 1}</span>
                          <input
                            type="text"
                            value={g}
                            onChange={e => { const c = [...gratitude]; c[idx] = e.target.value; setGratitude(c) }}
                            placeholder="I'm grateful for..."
                            className={`flex-1 bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3.5 py-3 text-white placeholder-white/40 text-sm outline-none transition-colors`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isMorning && wizardStep === 4 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 4 · Priorities</p>
                      <h2 className="text-2xl font-display font-bold text-white">Today's Priorities</h2>
                      <p className="text-white/60 text-xs mt-1">Your top tasks to focus on today.</p>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {priorities.map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                          <Check size={14} className={accentLight} />
                          <span className="text-sm text-white/90 truncate">{t.title}</span>
                        </div>
                      ))}
                      {priorities.length === 0 && (
                        <p className="text-white/40 text-xs italic text-center py-2">Nothing set yet — add one below.</p>
                      )}
                    </div>
                    <form onSubmit={handleAddPriorityTask} className="flex gap-2">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Add priority task…"
                        className={`flex-1 bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3.5 py-2.5 text-white placeholder-white/40 text-sm outline-none`}
                      />
                      <button type="submit" aria-label="Add task" className={`w-11 h-10 ${accentBg} text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center`}>
                        <Plus size={16} />
                      </button>
                    </form>
                  </div>
                )}

                {/* ── EVENING STEPS ── */}
                {!isMorning && wizardStep === 1 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-blue-300/70 text-xs font-medium mb-1">Step 1 · Mood Check</p>
                      <h2 className="text-2xl font-display font-bold text-white">How was your day?</h2>
                      <p className="text-white/60 text-xs mt-1">Take a moment to check in with your mood.</p>
                    </div>
                    {renderMoodScale(mood, setMood, false, true)}
                  </div>
                )}

                {!isMorning && wizardStep === 2 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-blue-300/70 text-xs font-medium mb-1">Step 2 · Energy</p>
                      <h2 className="text-2xl font-display font-bold text-white">Evening Energy</h2>
                      <p className="text-white/60 text-xs mt-1">How's your physical and mental energy right now?</p>
                    </div>
                    <div className="flex justify-center py-2">
                      {renderLightningScale(energyPm, setEnergyPm)}
                    </div>
                  </div>
                )}

                {!isMorning && wizardStep === 3 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-300/70 text-xs font-medium mb-1">Step 3 · Today's win</p>
                        <h2 className="text-2xl font-display font-bold text-white">Your biggest win?</h2>
                      </div>
                      <span className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                        winOfDay.length >= 260 ? 'text-amber-300 font-bold' : 'text-white/40'
                      }`}>
                        {winOfDay.length >= 260 && <AlertTriangle size={11} />}
                        {winOfDay.length}/280
                      </span>
                    </div>
                    <p className="text-white/60 text-xs -mt-3">What was the highlight of your day?</p>
                    <textarea
                      autoFocus
                      value={winOfDay}
                      maxLength={280}
                      onChange={e => setWinOfDay(e.target.value)}
                      placeholder="What was the highlight of your day?"
                      rows={4}
                      className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm outline-none resize-none transition-colors`}
                    />
                  </div>
                )}

                {!isMorning && wizardStep === 4 && (
                  <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-blue-300/70 text-xs font-medium mb-1">Step 4 · Reflection</p>
                      <h2 className="text-2xl font-display font-bold text-white">Structured Reflection</h2>
                      <p className="text-white/60 text-xs mt-1">Brief review before you close out the day.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/70 font-medium mb-1">What went well?</label>
                        <textarea value={wentWell} onChange={e => setWentWell(e.target.value)}
                          placeholder="Wins, good habits, smooth moments…" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3.5 py-2 text-white placeholder-white/40 text-xs outline-none resize-none transition-colors`} />
                      </div>
                      <div>
                        <label className="block text-xs text-white/70 font-medium mb-1">What I'd do differently?</label>
                        <textarea value={doDifferently} onChange={e => setDoDifferently(e.target.value)}
                          placeholder="Challenges, errors to improve…" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3.5 py-2 text-white placeholder-white/40 text-xs outline-none resize-none transition-colors`} />
                      </div>
                      <div>
                        <label className="block text-xs text-white/70 font-medium mb-1">Tomorrow's Focus</label>
                        <textarea value={tomorrowFocus} onChange={e => setTomorrowFocus(e.target.value)}
                          placeholder="What's your key direction tomorrow?" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3.5 py-2 text-white placeholder-white/40 text-xs outline-none resize-none transition-colors`} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom nav buttons — Apple 44pt touch standards */}
            <div className="px-5 pb-safe pb-6 pt-3 flex gap-3 max-w-md mx-auto w-full">
              {wizardStep > 1 ? (
                <button
                  onClick={() => { haptic('light'); setWizardStep(s => s - 1) }}
                  aria-label="Previous step"
                  className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <ArrowRight size={18} className="text-white rotate-180" />
                </button>
              ) : (
                <div className="w-12" />
              )}

              {wizardStep < totalSteps ? (
                <>
                  {wizardStep === 3 && (
                    <button
                      onClick={() => { haptic('light'); setWizardStep(s => s + 1) }}
                      className="px-4 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => { haptic('light'); setWizardStep(s => s + 1) }}
                    disabled={carryOverRunning && wizardStep === 1}
                    className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${btnPrimary} transition-colors disabled:opacity-50`}
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={isMorning ? finishMorningWizard : finishEveningWizard}
                  className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${btnFinish} transition-colors shadow-md`}
                >
                  <CheckCircle2 size={18} /> Finish {isMorning ? 'Morning' : 'Evening'}
                </button>
              )}
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}
