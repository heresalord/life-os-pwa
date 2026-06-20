import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Sun, Moon, Zap, Award, FileText, CheckCircle2, 
  ArrowRight, Check, Plus, Edit2, Play, Eye, ChevronLeft, ChevronRight,
  Frown, Annoyed, Meh, Smile, Laugh, X, Star, AlertTriangle,
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

  // Guided mode parameter check
  const guidedMode = searchParams.get('guided') // 'morning' | 'evening' | null

  // Carry over state
  const [carryOverRunning, setCarryOverRunning] = useState(false)
  const [carryOverCount, setCarryOverCount] = useState<number | null>(null)

  // Carry-over is guarded by a localStorage key so it runs at most once per
  // user+date pair, even across remounts, page refreshes, and wizard re-opens.
  useEffect(() => {
    async function checkAndCarryOver() {
      if (!user || guidedMode !== 'morning' || carryOverRunning) return

      const flagKey = `carryover:${user.id}:${activeDate}`
      const stored = localStorage.getItem(flagKey)
      if (stored !== null) {
        // Already ran this session or a previous one — restore the count display.
        setCarryOverCount(parseInt(stored, 10))
        return
      }

      setCarryOverRunning(true)
      try {
        const dateObj = new Date(activeDate + 'T12:00:00')
        const yesterdayStr = format(subDays(dateObj, 1), 'yyyy-MM-dd')
        const count = await carryOverTasks(user.id, yesterdayStr, activeDate)
        setCarryOverCount(count)
        localStorage.setItem(flagKey, String(count))
      } catch (err) {
        console.error('Carry over failed:', err)
      } finally {
        setCarryOverRunning(false)
      }
    }
    checkAndCarryOver()
  }, [guidedMode, user, activeDate])

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

  // Reset to step 1 whenever the wizard type changes — covers direct URL navigation
  // (e.g. deep-linking to ?guided=evening after finishing morning at step 4).
  useEffect(() => {
    setWizardStep(1)
  }, [guidedMode])

  // Reset preview mode when navigating to a different date.
  useEffect(() => {
    setIsPreviewMode(false)
  }, [activeDate])

  // Populate fields from the loaded record — only on first load per date.
  // We deliberately do NOT re-run when `record` mutates after the initial
  // hydration so that in-progress edits are never clobbered by a background
  // refetch (staleTime: 0 means React Query re-fetches on every focus).
  const populatedDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (!record) return
    if (populatedDateRef.current === activeDate) return   // already hydrated for this date
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

  // Save changes wrapper
  const handleSaveFields = async (updates: Record<string, any>) => {
    setSaveStatus('saving')
    try {
      await upsert.mutateAsync(updates)
      setSaveStatus('saved')
    } catch (err) {
      console.error(err)
      setSaveStatus('error')
    }
  }

  // --- Guided Mode Handlers ---
  const startWizard = (type: 'morning' | 'evening') => {
    setSearchParams({ guided: type })
    setWizardStep(1)
  }

  const finishMorningWizard = async () => {
    try {
      await upsert.mutateAsync({
        energy_am: energyAm,
        intent: intention,
        gratitude,
        morning_complete: true
      })
      setSearchParams({})
    } catch {
      setSaveStatus('error')
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
      setSearchParams({})
    } catch {
      setSaveStatus('error')
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
    const nextPriority = (currentPriority || 0) >= 4 ? null : 5
    await updateTask.mutateAsync({
      id: taskId,
      updates: { priority: nextPriority }
    })
  }

  const toggleTaskCompletion = async (taskId: string, currentCompleted: boolean) => {
    await updateTask.mutateAsync({
      id: taskId,
      updates: {
        completed: !currentCompleted,
        completed_at: !currentCompleted ? new Date().toISOString() : null
      }
    })
  }

  // --- Journal Helper ---
  const applyTemplate = (templateKey: keyof typeof JOURNAL_TEMPLATES) => {
    if (!window.confirm('Apply template? This will replace your current journal contents.')) return
    setSelectedTemplate(templateKey)
    setJournal(JOURNAL_TEMPLATES[templateKey])
    handleSaveFields({ journal: JOURNAL_TEMPLATES[templateKey] })
  }

  // Energy lightning scale render helper
  const renderLightningScale = (currentVal: number, onChange: (val: number) => void, readonly = false) => {
    return (
      <div className="flex gap-2.5">
        {[1, 2, 3, 4, 5].map(val => (
          <button
            key={val}
            disabled={readonly}
            type="button"
            onClick={() => onChange(val)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
              val <= currentVal
                ? 'bg-warning/15 border-warning text-warning scale-105'
                : 'bg-surface-2 border-border text-text-muted hover:border-warning/30 hover:text-text'
            }`}
          >
            <Zap size={18} className={val <= currentVal ? 'fill-warning' : ''} />
          </button>
        ))}
      </div>
    )
  }

  // Mood Emoji scale render helper
  const renderMoodScale = (currentVal: number, onChange: (val: number) => void, readonly = false) => {
    return (
      <div className="flex justify-between gap-3">
        {[1, 2, 3, 4, 5].map(val => {
          const MoodIcon = MOOD_ICONS[val - 1]
          return (
            <button
              key={val}
              disabled={readonly}
              type="button"
              onClick={() => onChange(val)}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                currentVal === val
                  ? 'bg-info/10 border-info text-info scale-105'
                  : 'bg-surface-2 border-border hover:border-info/30 hover:bg-surface-2/80'
              }`}
            >
              <MoodIcon size={24} className={`mb-1 ${currentVal === val ? '' : 'text-text-muted'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${currentVal === val ? 'text-info' : 'text-text-muted'}`}>
                {MOOD_LABELS[val - 1]}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 relative">
      {/* Title & Save status */}
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <button
            onClick={() => navigate('/day/history')}
            className="text-xs text-accent font-semibold hover:underline mb-1.5 inline-block"
          >
            ← View History Heatmap
          </button>
          <h1 className="text-2xl font-display font-semibold text-text">
            Daily Log — {displayDate(activeDate, 'EEEE, MMMM d, yyyy')}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Prev / Next date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/day/${format(subDays(parseISO(activeDate + 'T12:00:00'), 1), 'yyyy-MM-dd')}`)}
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
              title="Previous day"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => navigate('/day')}
              disabled={isToday(parseISO(activeDate + 'T12:00:00'))}
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-border bg-surface hover:bg-surface-2 text-text-secondary hover:text-text transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Today
            </button>
            <button
              onClick={() => navigate(`/day/${format(addDays(parseISO(activeDate + 'T12:00:00'), 1), 'yyyy-MM-dd')}`)}
              disabled={isToday(parseISO(activeDate + 'T12:00:00'))}
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-text-secondary hover:text-text transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title="Next day"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {saveStatus === 'saving' && (
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <span className="w-2 h-2 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-success flex items-center gap-1">
              <Check size={14} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-danger flex items-center gap-1">
              <AlertTriangle size={12} /> Error saving — check connection
            </span>
          )}
        </div>
      </header>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* ========================================================
            SECTION 1: MORNING
            ======================================================== */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <Sun size={18} className="text-warning" />
              Morning Ritual
            </h2>
            <div className="flex items-center gap-2">
              {record?.morning_complete && (
                <span className="text-[10px] bg-success/15 border border-success/30 text-success px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Complete
                </span>
              )}
              <button
                onClick={() => startWizard('morning')}
                className="text-xs font-semibold py-1 px-2.5 bg-warning/15 text-warning border border-warning/20 rounded-lg hover:bg-warning/25 transition-colors flex items-center gap-1"
              >
                <Play size={10} className="fill-warning" />
                Guided Mode
              </button>
            </div>
          </div>

          {/* Energy AM */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Morning Energy</label>
            {renderLightningScale(energyAm, (val) => {
              setEnergyAm(val)
              handleSaveFields({ energy_am: val })
            })}
          </div>

          {/* Intention */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Today's Intention</label>
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onBlur={() => handleSaveFields({ intent: intention })}
              placeholder="The single most important focus for today..."
              className="w-full bg-surface-2 border border-border focus:border-warning focus:ring-1 focus:ring-warning rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-all"
            />
          </div>

          {/* Gratitudes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Morning Gratitude</label>
            <div className="space-y-2">
              {gratitude.map((g, idx) => (
                <div key={idx} className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-sm text-text">
                  <span className="text-text-muted font-semibold">{idx + 1}.</span>
                  <input
                    type="text"
                    value={g}
                    onChange={(e) => {
                      const copy = [...gratitude]
                      copy[idx] = e.target.value
                      setGratitude(copy)
                    }}
                    onBlur={() => handleSaveFields({ gratitude })}
                    placeholder="I'm grateful for..."
                    className="bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full placeholder-text-muted text-sm text-text"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Priorities linked to tasks */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Top 3 Priorities (linked to Tasks)</label>
            
            {/* List priorities */}
            {priorities.length === 0 ? (
              <p className="text-xs text-text-muted italic py-1">No priorities designated for today.</p>
            ) : (
              <ul className="space-y-2">
                {priorities.map(t => (
                  <li key={t.id} className="flex items-center justify-between p-2.5 bg-surface-2 border border-border rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button 
                        onClick={() => toggleTaskCompletion(t.id, t.completed)}
                        className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                          t.completed ? 'bg-success border-success text-bg' : 'border-border hover:border-success/50'
                        }`}
                      >
                        {t.completed && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={`text-xs font-medium truncate ${t.completed ? 'line-through text-text-muted' : 'text-text'}`}>
                        {t.title}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleTaskPriority(t.id, t.priority)}
                      className="flex items-center gap-1 text-[10px] font-bold text-warning hover:underline"
                    >
                      <Star size={10} className="fill-warning" /> Priority
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
                className="flex-1 bg-surface-2 border border-border focus:border-warning rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 bg-warning text-bg rounded-xl hover:bg-warning/90 transition-colors flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </form>

            {/* Other task promoter */}
            {otherTasks.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Promote existing task</p>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1.5">
                  {otherTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-text-secondary bg-surface-2/40 px-2.5 py-1.5 rounded-lg border border-border/50">
                      <span className="truncate pr-2">{t.title}</span>
                      <button
                        onClick={() => toggleTaskPriority(t.id, t.priority)}
                        className="flex items-center gap-1 text-[10px] font-bold text-accent hover:underline flex-shrink-0"
                      >
                        <Star size={10} /> Set Priority
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================
            SECTION 2: EVENING
            ======================================================== */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <Moon size={18} className="text-info" />
              Evening Review
            </h2>
            <div className="flex items-center gap-2">
              {record?.evening_complete && (
                <span className="text-[10px] bg-success/15 border border-success/30 text-success px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Complete
                </span>
              )}
              <button
                onClick={() => startWizard('evening')}
                className="text-xs font-semibold py-1 px-2.5 bg-info/15 text-info border border-info/20 rounded-lg hover:bg-info/25 transition-colors flex items-center gap-1"
              >
                <Play size={10} className="fill-info" />
                Guided Mode
              </button>
            </div>
          </div>

          {/* Mood 1-5 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Day's Mood</label>
            {renderMoodScale(mood, (val) => {
              setMood(val)
              handleSaveFields({ mood: val })
            })}
          </div>

          {/* Energy PM */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Evening Energy</label>
            {renderLightningScale(energyPm, (val) => {
              setEnergyPm(val)
              handleSaveFields({ energy_pm: val })
            })}
          </div>

          {/* Win of the Day */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Win of the Day</label>
              <span className={`text-[10px] font-semibold ${winOfDay.length > 280 ? 'text-danger' : 'text-text-muted'}`}>
                {winOfDay.length} / 280
              </span>
            </div>
            <textarea
              value={winOfDay}
              maxLength={280}
              onChange={(e) => setWinOfDay(e.target.value)}
              onBlur={() => handleSaveFields({ win_of_day: winOfDay })}
              placeholder="What was the highlight of your day?"
              rows={2}
              className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Structured prompts */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">What went well?</label>
              <textarea
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                onBlur={() => handleSaveFields({ went_well: wentWell })}
                placeholder="Log achievements, good habits, or items that went smoothly..."
                rows={2}
                className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">What I'd do differently?</label>
              <textarea
                value={doDifferently}
                onChange={(e) => setDoDifferently(e.target.value)}
                onBlur={() => handleSaveFields({ do_differently: doDifferently })}
                placeholder="Log challenges or actions you'd improve next time..."
                rows={2}
                className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tomorrow's Focus</label>
              <textarea
                value={tomorrowFocus}
                onChange={(e) => setTomorrowFocus(e.target.value)}
                onBlur={() => handleSaveFields({ tomorrow_focus: tomorrowFocus })}
                placeholder="What is tomorrow's key direction or top goal?"
                rows={2}
                className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none transition-all resize-none"
              />
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================
          SECTION 3: FREE JOURNAL & SECTION 4: DAY SCORE
          ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 items-start">
        
        {/* FREE JOURNAL */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border/50 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              Free Journal
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Template Picker */}
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value as any)}
                className="text-xs bg-surface border border-border focus:border-accent rounded-lg px-2 py-1 text-text-secondary cursor-pointer focus:outline-none"
              >
                <option value="blank">Blank Draft</option>
                <option value="gratitude">Gratitude Log</option>
                <option value="weekly_review">Weekly Reflection</option>
                <option value="stress_log">Stress Check-In</option>
              </select>

              {/* Preview toggle */}
              <button
                type="button"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="text-xs font-semibold py-1 px-2.5 bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-1.5"
              >
                {isPreviewMode ? (
                  <><Edit2 size={12} /> Write</>
                ) : (
                  <><Eye size={12} /> Preview</>
                )}
              </button>
            </div>
          </div>

          {/* Journal Editor or Preview */}
          {isPreviewMode ? (
            <div className="prose prose-invert max-w-none text-sm text-text bg-surface-2/50 border border-border rounded-xl p-4 min-h-[220px]">
              {journal.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{journal}</ReactMarkdown>
              ) : (
                <p className="text-text-muted italic">Nothing written yet. Write something in Editor mode.</p>
              )}
            </div>
          ) : (
            <textarea
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              onBlur={() => handleSaveFields({ journal })}
              placeholder="Reflect freely about your day here (supports full markdown formatting)..."
              rows={10}
              className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text focus:outline-none transition-all font-mono"
            />
          )}
        </section>

        {/* DAY SCORE */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-5 text-center flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <h2 className="text-base font-semibold text-text flex items-center justify-center gap-2 pb-2 border-b border-border/50">
              <Award size={18} className="text-accent" />
              Day Score
            </h2>
            <p className="text-xs text-text-muted mt-2">Calculated from task completion, mood, and daily energy</p>
          </div>

          {/* Circular Score Gauge */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center my-3">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="var(--color-border)"
                strokeWidth="8"
                fill="transparent"
                className="opacity-25"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={
                  dayScoreValue >= 80 
                    ? 'var(--color-success)' 
                    : dayScoreValue >= 50 
                    ? 'var(--color-warning)' 
                    : 'var(--color-danger)'
                }
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * dayScoreValue) / 100}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-display font-bold text-text tabular-nums">{dayScoreValue}</span>
              <span className="text-xs block text-text-muted">/ 100</span>
            </div>
          </div>

          {/* Component Score breakdown */}
          <div className="space-y-2.5 text-left text-xs bg-surface-2/40 border border-border/50 rounded-xl p-3">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Task Completion:</span>
              <span className="font-semibold text-text">
                {(() => {
                  const nonSkipped = tasks.filter(t => !t.skipped)
                  if (nonSkipped.length === 0) return '—'
                  return `${Math.round((tasks.filter(t => t.completed).length / nonSkipped.length) * 100)}%`
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Mood score:</span>
              <span className="font-semibold text-text">{record?.mood ? `${(record.mood - 1) * 25}/100` : '50/100 (neutral)'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Energy score:</span>
              <span className="font-semibold text-text">
                {(() => {
                  let avg = 3
                  if (record?.energy_am !== null && record?.energy_am !== undefined && record?.energy_pm !== null && record?.energy_pm !== undefined) {
                    avg = ((record.energy_am ?? 3) + (record.energy_pm ?? 3)) / 2
                  } else if (record?.energy_am !== null && record?.energy_am !== undefined) {
                    avg = record.energy_am ?? 3
                  } else if (record?.energy_pm !== null && record?.energy_pm !== undefined) {
                    avg = record.energy_pm ?? 3
                  }
                  return `${Math.round((avg - 1) * 25)}/100`
                })()}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================
          GUIDED MODE — FULL-SCREEN IMMERSIVE WIZARD
          ======================================================== */}
      {(guidedMode === 'morning' || guidedMode === 'evening') && (() => {
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
          <div className={`fixed inset-0 z-50 bg-gradient-to-br ${gradientFrom} ${gradientTo} flex flex-col overflow-hidden`}>
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 blur-3xl"
              style={{ backgroundColor: accentColor, transform: 'translate(30%, -30%)' }} />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 blur-3xl"
              style={{ backgroundColor: accentColor, transform: 'translate(-30%, 30%)' }} />

            {/* Top bar */}
            <div className="relative flex items-center justify-between px-5 pt-safe pt-4 pb-3">
              {/* Close */}
              <button
                onClick={() => setSearchParams({})}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <X size={17} className="text-white" />
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
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border ${accentBorder}`}>
                {isMorning ? <Sun size={13} className={accentLight} /> : <Moon size={13} className={accentLight} />}
                <span className={`text-[11px] font-bold uppercase tracking-wider ${accentLight}`}>
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

            {/* Step content — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="max-w-md mx-auto">

                {/* ── MORNING STEPS ── */}
                {isMorning && wizardStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-amber-300/70 text-sm font-medium mb-1">Step 1 · Energy Check</p>
                      <h2 className="text-2xl font-display font-bold text-white">How's your morning energy?</h2>
                      <p className="text-white/60 text-sm mt-1">Rate how energised you feel right now.</p>
                    </div>
                    <div className="flex justify-center gap-3 py-2">
                      {renderLightningScale(energyAm, setEnergyAm)}
                    </div>
                    {carryOverRunning && (
                      <p className="text-xs text-amber-300/70 text-center flex items-center justify-center gap-1.5 animate-pulse">
                        <Zap size={11} /> Checking yesterday's tasks…
                      </p>
                    )}
                    {carryOverCount !== null && carryOverCount > 0 && (
                      <div className="bg-white/5 border border-amber-400/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-300 flex items-center justify-center gap-1.5">
                          <Zap size={11} className="fill-amber-400" /> Carried over {carryOverCount} task{carryOverCount !== 1 ? 's' : ''} from yesterday
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isMorning && wizardStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-amber-300/70 text-sm font-medium mb-1">Step 2 · Intention</p>
                      <h2 className="text-2xl font-display font-bold text-white">Set your intention</h2>
                      <p className="text-white/60 text-sm mt-1">What's the single most important thing today?</p>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={intention}
                      onChange={e => setIntention(e.target.value)}
                      placeholder="Today, I intend to…"
                      className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} focus:ring-0 rounded-2xl px-4 py-4 text-white placeholder-white/30 text-sm outline-none backdrop-blur-sm transition-colors`}
                    />
                  </div>
                )}

                {isMorning && wizardStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-amber-300/70 text-sm font-medium mb-1">Step 3 · Gratitude</p>
                      <h2 className="text-2xl font-display font-bold text-white">Morning Gratitude</h2>
                      <p className="text-white/60 text-sm mt-1">3 things you're genuinely grateful for.</p>
                    </div>
                    <div className="space-y-3">
                      {gratitude.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full ${accentBg}/20 flex items-center justify-center text-xs font-bold ${accentLight} flex-shrink-0`}>{idx + 1}</span>
                          <input
                            type="text"
                            value={g}
                            onChange={e => { const c = [...gratitude]; c[idx] = e.target.value; setGratitude(c) }}
                            placeholder={`I'm grateful for…`}
                            className={`flex-1 bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3 py-3 text-white placeholder-white/30 text-sm outline-none transition-colors`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isMorning && wizardStep === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-amber-300/70 text-sm font-medium mb-1">Step 4 · Priorities</p>
                      <h2 className="text-2xl font-display font-bold text-white">Today's Priorities</h2>
                      <p className="text-white/60 text-sm mt-1">Your top tasks to focus on today.</p>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {priorities.map(t => (
                        <div key={t.id} className="flex items-center gap-2.5 p-3 bg-white/5 border border-white/10 rounded-xl">
                          <Check size={13} className={accentLight} />
                          <span className="text-sm text-white/90 truncate">{t.title}</span>
                        </div>
                      ))}
                      {priorities.length === 0 && (
                        <p className="text-white/40 text-xs italic text-center py-2">Add priority tasks below.</p>
                      )}
                    </div>
                    <form onSubmit={handleAddPriorityTask} className="flex gap-2">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Add priority task…"
                        className={`flex-1 bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-sm outline-none`}
                      />
                      <button type="submit" className={`px-3 ${accentBg} text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity`}>
                        <Plus size={14} />
                      </button>
                    </form>
                  </div>
                )}

                {/* ── EVENING STEPS ── */}
                {!isMorning && wizardStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-blue-300/70 text-sm font-medium mb-1">Step 1 · Mood Check</p>
                      <h2 className="text-2xl font-display font-bold text-white">How was your day?</h2>
                      <p className="text-white/60 text-sm mt-1">Take a moment to check in with your mood.</p>
                    </div>
                    {renderMoodScale(mood, setMood)}
                  </div>
                )}

                {!isMorning && wizardStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-blue-300/70 text-sm font-medium mb-1">Step 2 · Energy</p>
                      <h2 className="text-2xl font-display font-bold text-white">Evening energy</h2>
                      <p className="text-white/60 text-sm mt-1">How's your physical/mental energy right now?</p>
                    </div>
                    <div className="flex justify-center py-2">
                      {renderLightningScale(energyPm, setEnergyPm)}
                    </div>
                  </div>
                )}

                {!isMorning && wizardStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-300/70 text-sm font-medium mb-1">Step 3 · Win of the Day</p>
                        <h2 className="text-2xl font-display font-bold text-white">Your biggest win?</h2>
                      </div>
                      <span className={`text-[10px] font-semibold mt-1 ${winOfDay.length > 260 ? 'text-red-400' : 'text-white/30'}`}>{winOfDay.length}/280</span>
                    </div>
                    <p className="text-white/60 text-sm -mt-3">Pick the single best thing that happened today.</p>
                    <textarea
                      autoFocus
                      value={winOfDay}
                      maxLength={280}
                      onChange={e => setWinOfDay(e.target.value)}
                      placeholder="Today, my win was…"
                      rows={4}
                      className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none resize-none transition-colors`}
                    />
                  </div>
                )}

                {!isMorning && wizardStep === 4 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <div>
                      <p className="text-blue-300/70 text-sm font-medium mb-1">Step 4 · Reflection</p>
                      <h2 className="text-2xl font-display font-bold text-white">Structured Reflection</h2>
                      <p className="text-white/60 text-sm mt-1">Brief review before you close the day.</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-white/50 uppercase tracking-wider mb-1.5 font-bold">What went well?</label>
                        <textarea value={wentWell} onChange={e => setWentWell(e.target.value)}
                          placeholder="Wins, good habits, smooth moments…" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-xs outline-none resize-none transition-colors`} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-white/50 uppercase tracking-wider mb-1.5 font-bold">What I'd do differently?</label>
                        <textarea value={doDifferently} onChange={e => setDoDifferently(e.target.value)}
                          placeholder="Challenges, errors to improve…" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-xs outline-none resize-none transition-colors`} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-white/50 uppercase tracking-wider mb-1.5 font-bold">Tomorrow's Focus</label>
                        <textarea value={tomorrowFocus} onChange={e => setTomorrowFocus(e.target.value)}
                          placeholder="What's your key direction tomorrow?" rows={2}
                          className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-xs outline-none resize-none transition-colors`} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom nav buttons */}
            <div className="px-5 pb-safe pb-6 pt-3 flex gap-3 max-w-md mx-auto w-full">
              {wizardStep > 1 ? (
                <button
                  onClick={() => setWizardStep(s => s - 1)}
                  className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <ArrowRight size={18} className="text-white rotate-180" />
                </button>
              ) : (
                <div className="w-12" /> // spacer
              )}

              {wizardStep < totalSteps ? (
                <>
                  {/* Skip button on optional steps (gratitude/structured reflection) */}
                  {(wizardStep === 3) && (
                    <button
                      onClick={() => setWizardStep(s => s + 1)}
                      className="px-4 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 text-sm transition-colors"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => setWizardStep(s => s + 1)}
                    disabled={carryOverRunning && wizardStep === 1}
                    className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${btnPrimary} transition-colors disabled:opacity-50`}
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={isMorning ? finishMorningWizard : finishEveningWizard}
                  className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${btnFinish} transition-colors`}
                >
                  <CheckCircle2 size={16} /> Finish {isMorning ? 'Morning' : 'Evening'}
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
