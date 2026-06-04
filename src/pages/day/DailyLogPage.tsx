import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Sun, Moon, Zap, Award, FileText, CheckCircle2, 
  ArrowRight, Check, Plus, Edit2, Play, Eye, ChevronLeft, ChevronRight
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

const EMOJIS = ['😶', '😕', '😐', '🙂', '😊']
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

  useEffect(() => {
    async function checkAndCarryOver() {
      if (!user || guidedMode !== 'morning' || carryOverRunning || carryOverCount !== null) return
      setCarryOverRunning(true)
      try {
        const dateObj = new Date(activeDate + 'T12:00:00')
        const yesterdayStr = format(subDays(dateObj, 1), 'yyyy-MM-dd')
        const count = await carryOverTasks(user.id, yesterdayStr, activeDate)
        setCarryOverCount(count)
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

  // --- Guided Wizard Wizard Step ---
  const [wizardStep, setWizardStep] = useState<number>(1)

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
        {[1, 2, 3, 4, 5].map(val => (
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
            <span className="text-3xl mb-1">{EMOJIS[val - 1]}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${currentVal === val ? 'text-info' : 'text-text-muted'}`}>
              {MOOD_LABELS[val - 1]}
            </span>
          </button>
        ))}
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
            <span className="text-xs text-danger">⚠️ Error saving — check connection</span>
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
                      className="text-[10px] font-bold text-warning hover:underline"
                    >
                      ★ Priority
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
                        className="text-[10px] font-bold text-accent hover:underline flex-shrink-0"
                      >
                        ☆ Set Priority
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
          GUIDED MODE OVERLAY DIALOGS
          ======================================================== */}
      {guidedMode === 'morning' && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6 relative">
            <button 
              onClick={() => setSearchParams({})}
              className="absolute right-4 top-4 text-text-muted hover:text-text"
            >
              ✕
            </button>

            <header>
              <div className="flex items-center gap-2 mb-1">
                <Sun size={18} className="text-warning" />
                <span className="text-xs font-bold text-warning uppercase tracking-widest">Morning Guided Routine</span>
              </div>
              <div className="w-full bg-surface-2 rounded-full h-1 overflow-hidden mt-3">
                <div className="bg-warning h-full transition-all duration-300" style={{ width: `${(wizardStep / 4) * 100}%` }} />
              </div>
            </header>

            {/* Step 1: Energy AM */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">How is your morning energy?</h3>
                <p className="text-xs text-text-secondary">Rate your energy level as you start the day.</p>
                <div className="flex justify-center py-2">
                  {renderLightningScale(energyAm, setEnergyAm)}
                </div>
                {carryOverRunning && (
                  <p className="text-[10px] text-text-muted text-center animate-pulse">⚡ Checking yesterday's tasks to carry over...</p>
                )}
                {carryOverCount !== null && carryOverCount > 0 && (
                  <p className="text-[10px] text-warning bg-warning/5 border border-warning/10 p-2.5 rounded-xl text-center">
                    ⚡ Carried over {carryOverCount} pending tasks from yesterday.
                  </p>
                )}
                {carryOverCount !== null && carryOverCount === 0 && (
                  <p className="text-[10px] text-text-muted text-center">
                    ⚡ No pending tasks to carry over from yesterday.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  disabled={carryOverRunning}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-warning text-bg font-semibold rounded-xl hover:bg-warning/90 transition-colors mt-2 disabled:opacity-50"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* Step 2: Intention */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Set your intention</h3>
                <p className="text-xs text-text-secondary">What is the single most important direction or focus for you today?</p>
                <input
                  autoFocus
                  type="text"
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  placeholder="Today, I intend to..."
                  className="w-full bg-surface-2 border border-border focus:border-warning rounded-xl px-4 py-3 text-sm text-text focus:outline-none transition-all"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-warning text-bg font-semibold rounded-xl hover:bg-warning/90 transition-colors"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Gratitude */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Morning Gratitude</h3>
                <p className="text-xs text-text-secondary">Write down 3 things you are genuinely grateful for this morning.</p>
                <div className="space-y-2.5">
                  {gratitude.map((g, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const copy = [...gratitude]
                        copy[idx] = e.target.value
                        setGratitude(copy)
                      }}
                      placeholder={`I am grateful for... (${idx + 1})`}
                      className="w-full bg-surface-2 border border-border focus:border-warning rounded-xl px-3 py-2.5 text-xs text-text focus:outline-none transition-all"
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-warning text-bg font-semibold rounded-xl hover:bg-warning/90 transition-colors"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Priorities */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Verify your priorities</h3>
                <p className="text-xs text-text-secondary">Select or add high-priority tasks to focus on today.</p>
                <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                  {priorities.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 bg-surface-2 border border-border rounded-lg text-xs">
                      <Check size={14} className="text-warning font-bold" />
                      <span className="truncate flex-1 text-text">{t.title}</span>
                    </div>
                  ))}
                  {priorities.length === 0 && (
                    <p className="text-xs text-text-muted italic text-center py-2">Add high-priority tasks using the form below.</p>
                  )}
                </div>
                <form onSubmit={handleAddPriorityTask} className="flex gap-2 border-t border-border pt-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="New priority task..."
                    className="flex-1 bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none"
                  />
                  <button type="submit" className="px-2.5 bg-warning text-bg rounded-lg hover:bg-warning/90">Add</button>
                </form>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={finishMorningWizard}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-success text-bg font-semibold rounded-xl hover:bg-success/90 transition-colors"
                  >
                    Finish Morning <CheckCircle2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {guidedMode === 'evening' && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6 relative">
            <button 
              onClick={() => setSearchParams({})}
              className="absolute right-4 top-4 text-text-muted hover:text-text"
            >
              ✕
            </button>

            <header>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={18} className="text-info" />
                <span className="text-xs font-bold text-info uppercase tracking-widest">Evening Guided Reflection</span>
              </div>
              <div className="w-full bg-surface-2 rounded-full h-1 overflow-hidden mt-3">
                <div className="bg-info h-full transition-all duration-300" style={{ width: `${(wizardStep / 4) * 100}%` }} />
              </div>
            </header>

            {/* Step 1: Mood */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">How was your day?</h3>
                <p className="text-xs text-text-secondary">Take a second to check in with your overall mood.</p>
                {renderMoodScale(mood, setMood)}
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-info text-bg font-semibold rounded-xl hover:bg-info/90 transition-colors mt-2"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* Step 2: Energy PM */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Rate your evening energy</h3>
                <p className="text-xs text-text-secondary">How is your physical/mental energy level right now?</p>
                <div className="flex justify-center py-2">
                  {renderLightningScale(energyPm, setEnergyPm)}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-info text-bg font-semibold rounded-xl hover:bg-info/90 transition-colors"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Win of the Day */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-text">What was your Win of the Day?</h3>
                  <span className={`text-[10px] font-semibold ${winOfDay.length > 280 ? 'text-danger' : 'text-text-muted'}`}>
                    {winOfDay.length}/280
                  </span>
                </div>
                <p className="text-xs text-text-secondary">Forces conciseness. Pick the single best thing that happened.</p>
                <textarea
                  autoFocus
                  value={winOfDay}
                  maxLength={280}
                  onChange={(e) => setWinOfDay(e.target.value)}
                  placeholder="Today, my win was..."
                  rows={4}
                  className="w-full bg-surface-2 border border-border focus:border-info rounded-xl px-4 py-3 text-sm text-text focus:outline-none transition-all resize-none"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-info text-bg font-semibold rounded-xl hover:bg-info/90 transition-colors"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: structured prompts */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text">Structured Reflection</h3>
                <p className="text-xs text-text-secondary">Take a brief moment to log went went well and tomorrow's focus.</p>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">What went well?</label>
                    <textarea
                      value={wentWell}
                      onChange={(e) => setWentWell(e.target.value)}
                      placeholder="Wins, achievements, positive habits..."
                      rows={2}
                      className="w-full bg-surface-2 border border-border focus:border-info rounded-lg p-2 text-xs text-text focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">What I'd do differently?</label>
                    <textarea
                      value={doDifferently}
                      onChange={(e) => setDoDifferently(e.target.value)}
                      placeholder="Challenges, errors, changes for next time..."
                      rows={2}
                      className="w-full bg-surface-2 border border-border focus:border-info rounded-lg p-2 text-xs text-text focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tomorrow's Focus</label>
                    <textarea
                      value={tomorrowFocus}
                      onChange={(e) => setTomorrowFocus(e.target.value)}
                      placeholder="What is your focus for tomorrow?"
                      rows={2}
                      className="w-full bg-surface-2 border border-border focus:border-info rounded-lg p-2 text-xs text-text focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={finishEveningWizard}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-success text-bg font-semibold rounded-xl hover:bg-success/90 transition-colors"
                  >
                    Finish Evening <CheckCircle2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
