import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { 
  Sun, Moon, Zap, Award, FileText, CheckCircle2, 
  ArrowRight, Check, Plus, Edit2, Play, ChevronLeft, ChevronRight, ChevronDown,
  Frown, Annoyed, Meh, Smile, Laugh, X, Star, AlertTriangle, CalendarDays,
  Flame, Heart, ListChecks, Wind, Mic, MicOff, Settings2,
  ExternalLink, BarChart2, Hash, Sparkles
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
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { applyTags } from '../../lib/noteTagUtils'

const MOOD_ICONS = [Frown, Annoyed, Meh, Smile, Laugh]
const MOOD_LABELS = ['Low', 'Difficult', 'Okay', 'Good', 'Great']

// Night journal preset sections key in localStorage
const NIGHT_SECTIONS_KEY = 'life-os-night-journal-sections'
const DEFAULT_NIGHT_SECTIONS = ['Biggest Win', 'What Went Well', "What I'd Do Differently", "Tomorrow's Focus"]

const JOURNAL_TEMPLATES = {
  blank: '',
  gratitude: `## Morning Gratitude\n1. I am grateful for...\n2. I am grateful for...\n3. I am grateful for...\n\n## What would make today great?\n- [ ] \n- [ ] `,
  weekly_review: `## Weekly Review\n### Achievements & Wins\n- \n\n### Challenges & Roadblocks\n- \n\n### Key Learnings\n- \n\n### Focus for Next Week\n- `,
  stress_log: `## Stress Log\n### What is causing me stress?\n- \n\n### What can I control about it?\n- \n\n### Action Steps (Things I can do today/tomorrow)\n- [ ] `
}

const TEMPLATE_OPTIONS = [
  { key: 'blank' as const, label: 'Blank', icon: FileText },
  { key: 'gratitude' as const, label: 'Gratitude', icon: Heart },
  { key: 'weekly_review' as const, label: 'Weekly', icon: ListChecks },
  { key: 'stress_log' as const, label: 'Stress', icon: Wind },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a date string to a friendly journal note title, e.g. "Journal – Sep 7, 2026" */
function journalNoteTitle(dateStr: string): string {
  try {
    return `Journal – ${format(parseISO(dateStr + 'T12:00:00'), 'MMM d, yyyy')}`
  } catch {
    return `Journal – ${dateStr}`
  }
}

/** Upsert a section (## heading) inside markdown content. */
function upsertSection(content: string, heading: string, body: string): string {
  const heading2 = `## ${heading}`
  const lines = content.split('\n')
  const startIdx = lines.findIndex(l => l.trim() === heading2)
  if (startIdx === -1) {
    // Append new section
    const trimmed = content.trimEnd()
    return trimmed + (trimmed ? '\n\n' : '') + `${heading2}\n${body}`
  }
  // Find end of section (next ## heading or EOF)
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { endIdx = i; break }
  }
  const before = lines.slice(0, startIdx).join('\n')
  const after = lines.slice(endIdx).join('\n')
  const section = `${heading2}\n${body}`
  return [before, section, after].filter(Boolean).join('\n\n').trim()
}

/**
 * Insert a timestamped free-journal entry (### h:mm AM/PM) into the day's
 * journal note, positioned after any "## Morning" section and before any
 * "## Evening" section — so the note reads Morning → entries throughout
 * the day → Evening, in chronological order, no matter when each piece
 * was written.
 */
function insertTimestampedEntry(content: string, body: string, when: Date = new Date()): string {
  const timeLabel = format(when, 'h:mm a')
  const entryBlock = `### ${timeLabel}\n${body.trim()}`

  const lines = content.split('\n')
  const eveningIdx = lines.findIndex(l => l.trim() === '## Evening')

  if (eveningIdx === -1) {
    // No evening section yet — append at the end (after Morning, if any)
    const trimmed = content.trimEnd()
    return trimmed + (trimmed ? '\n\n' : '') + entryBlock
  }

  const before = lines.slice(0, eveningIdx).join('\n').trimEnd()
  const after = lines.slice(eveningIdx).join('\n')
  return `${before}\n\n${entryBlock}\n\n${after}`
}

/** Build night journal initial content from enabled sections. */
function buildNightJournalTemplate(sections: string[], enabledMap: Record<string, boolean>): string {
  return sections
    .filter(s => enabledMap[s] !== false)
    .map(s => `## ${s}\n`)
    .join('\n\n')
}

/** Auto-extract #hashtags from text and return them as tag strings. */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) ?? []
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
}

// ─── Voice-to-text hook ───────────────────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const isListeningRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stop = useCallback(() => {
    isListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore if already stopped
    }
    setIsListening(false)
    haptic('light')
  }, [])

  const start = useCallback(() => {
    if (!supported) return
    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript
        }
      }
      const trimmed = finalChunk.trim()
      if (trimmed) {
        onResultRef.current(trimmed)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        isListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      if (isListeningRef.current) {
        // Auto-restart for seamless continuous dictation across pauses
        try {
          recognition.start()
        } catch {
          // Ignore restart collisions
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    isListeningRef.current = true
    try {
      recognition.start()
      setIsListening(true)
      haptic('light')
    } catch {
      isListeningRef.current = false
      setIsListening(false)
    }
  }, [supported])

  useEffect(() => {
    return () => {
      isListeningRef.current = false
      try {
        recognitionRef.current?.stop()
      } catch {
        // Ignore during unmount
      }
    }
  }, [])

  return { supported, isListening, start, stop }
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
  const db = useDb()

  // Notes
  const { addNote, updateNote } = useNoteMutations()
  const { data: allNotes = [] } = useNotesQuery()

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

  // Night journal sections config
  const [nightSections] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(NIGHT_SECTIONS_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_NIGHT_SECTIONS
    } catch { return DEFAULT_NIGHT_SECTIONS }
  })
  const [nightSectionsEnabled, setNightSectionsEnabled] = useState<Record<string, boolean>>({})
  const [showNightSectionConfig, setShowNightSectionConfig] = useState(false)

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
  const [morningJournal, setMorningJournal] = useState<string>('')
  const [intention, setIntention] = useState<string>('')
  const [gratitude, setGratitude] = useState<string[]>(['', '', ''])
  const [newTaskTitle, setNewTaskTitle] = useState<string>('')

  // --- Evening state ---
  const [mood, setMood] = useState<number>(3)
  const [energyPm, setEnergyPm] = useState<number>(3)
  const [nightJournal, setNightJournal] = useState<string>('')
  const [winOfDay, setWinOfDay] = useState<string>('')
  const [wentWell, setWentWell] = useState<string>('')
  const [doDifferently, setDoDifferently] = useState<string>('')
  const [tomorrowFocus, setTomorrowFocus] = useState<string>('')

  // --- Free Journal state ---
  // NOTE: the standalone `journal` free-text field (daily_records.journal)
  // is deprecated in favor of timestamped entries appended directly into
  // the shared Notes/Journal note (see handleAddJournalEntry below). Old
  // data in that column is left untouched but no longer written to.
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof JOURNAL_TEMPLATES>('blank')

  // --- UI Save Indicator ---
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle')

  // --- Guided Wizard Step ---
  const [wizardStep, setWizardStep] = useState<number>(1)

  // Voice-to-text for morning / evening guided wizard
  const morningVoice = useVoiceInput((t) => setMorningJournal(prev => prev ? prev + ' ' + t : t))
  const nightVoice = useVoiceInput((t) => setNightJournal(prev => prev ? prev + ' ' + t : t))

  // Reset to step 1 whenever the wizard type changes
  useEffect(() => {
    setWizardStep(1)
    setWizardCelebration(false)
  }, [guidedMode])

  // Reset early-unlock state when navigating to a different date
  useEffect(() => {
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
  }, [record, activeDate])

  // Populate morning/night journal from Notes Journal folder
  const journalNoteForDate = useMemo(() => {
    const title = journalNoteTitle(activeDate)
    return (allNotes as any[]).find(n => n.title === title && n.folder === 'Journal') ?? null
  }, [allNotes, activeDate])

  useEffect(() => {
    if (!journalNoteForDate) return
    const content = journalNoteForDate.content as string ?? ''
    // Extract morning section
    const morningMatch = content.match(/## Morning\n([\s\S]*?)(?=\n## |$)/)
    if (morningMatch) setMorningJournal(morningMatch[1].trim())
    // Extract evening section
    const eveningMatch = content.match(/## Evening\n([\s\S]*?)(?=\n## |$)/)
    if (eveningMatch) setNightJournal(eveningMatch[1].trim())
  }, [journalNoteForDate])

  // Initialize night journal with preset sections if empty
  useEffect(() => {
    if (nightJournal) return
    if (guidedMode === 'evening' && wizardStep === 3) {
      const template = buildNightJournalTemplate(nightSections, nightSectionsEnabled)
      if (template.trim()) setNightJournal(template)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedMode, wizardStep])

  // "This Day Last Year" note
  const thisTimeLasYear = useMemo(() => {
    try {
      const lastYearDate = format(subDays(parseISO(activeDate + 'T12:00:00'), 365), 'yyyy-MM-dd')
      const title = journalNoteTitle(lastYearDate)
      return (allNotes as any[]).find(n => n.title === title && n.folder === 'Journal') ?? null
    } catch { return null }
  }, [allNotes, activeDate])

  // Monthly journal stats
  const monthlyJournalStats = useMemo(() => {
    const [year, month] = activeDate.split('-')
    const journalNotes = (allNotes as any[]).filter(n =>
      n.folder === 'Journal' &&
      typeof n.date === 'string' &&
      n.date.startsWith(`${year}-${month}`)
    )
    const total = journalNotes.length
    const avgWords = total > 0
      ? Math.round(journalNotes.reduce((sum: number, n: any) => sum + (n.word_count ?? 0), 0) / total)
      : 0
    return { total, avgWords }
  }, [allNotes, activeDate])

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

  // ─── Save journal note to Notes/Journal folder ────────────────────────────
  const saveJournalNote = useCallback(async (morningText: string, eveningText: string) => {
    if (!user) return
    const title = journalNoteTitle(activeDate)
    let content = ''
    if (morningText.trim()) content = upsertSection(content, 'Morning', morningText.trim())
    if (eveningText.trim()) content = upsertSection(content, 'Evening', eveningText.trim())
    if (!content.trim()) return

    // Auto-tag from hashtags in journal content
    const hashtags = extractHashtags(content)
    const finalContent = hashtags.length > 0 ? applyTags(content, hashtags) : content

    if (journalNoteForDate) {
      updateNote.mutate({ id: journalNoteForDate.id, updates: { content: finalContent } })
    } else {
      addNote.mutate({
        title,
        content: finalContent,
        date: activeDate,
        folder: 'Journal',
      })
    }
  }, [user, activeDate, journalNoteForDate, addNote, updateNote])

  // ─── Append a timestamped entry to the day's journal note ────────────
  // This is the "free journaling throughout the day" entry point — distinct
  // from the Morning/Evening ritual fields. Each submission adds a new
  // ### h:mm AM/PM block into the SAME shared journal note, positioned
  // between the Morning and Evening sections, so the note reads as one
  // continuous story of the day rather than three disconnected places.
  const [newEntryText, setNewEntryText] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)

  const handleAddJournalEntry = useCallback(async (text: string) => {
    if (!user || !text.trim()) return
    setAddingEntry(true)
    haptic('light')
    try {
      const baseContent = (journalNoteForDate?.content as string) ?? ''
      const merged = insertTimestampedEntry(baseContent, text.trim())
      const hashtags = extractHashtags(merged)
      const finalContent = hashtags.length > 0 ? applyTags(merged, hashtags) : merged

      if (journalNoteForDate) {
        await updateNote.mutateAsync({ id: journalNoteForDate.id, updates: { content: finalContent } })
      } else {
        await addNote.mutateAsync({
          title: journalNoteTitle(activeDate),
          content: finalContent,
          date: activeDate,
          folder: 'Journal',
        })
      }
      setNewEntryText('')
      haptic('success')
    } catch {
      haptic('error')
    } finally {
      setAddingEntry(false)
    }
  }, [user, activeDate, journalNoteForDate, addNote, updateNote])

  // §0 Fix: Completion Model & Save Fields Wrapper
  const handleSaveFields = useCallback(async (updates: Record<string, any>) => {
    setSaveStatus('saving')
    try {
      const curEnergyAm = updates.energy_am !== undefined ? updates.energy_am : energyAm
      const curIntent = updates.intent !== undefined ? updates.intent : intention
      const curGratitude = updates.gratitude !== undefined ? updates.gratitude : gratitude

      const curWinOfDay = updates.win_of_day !== undefined ? updates.win_of_day : winOfDay

      const morningDerived = Boolean(
        record?.morning_complete || updates.morning_complete ||
        (curEnergyAm != null && curIntent?.trim() && curGratitude.some((g: string) => g?.trim()))
      )

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

  const finishMorningWizard = async () => {
    try {
      await upsert.mutateAsync({
        energy_am: energyAm,
        intent: intention,
        gratitude,
        morning_complete: true
      })
      await saveJournalNote(morningJournal, nightJournal)
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
      await saveJournalNote(morningJournal, nightJournal)
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
    if (!newEntryText.trim()) {
      applyTemplateImmediate(templateKey)
      return
    }
    setPendingTemplateKey(templateKey)
    setConfirmTemplateOpen(true)
  }

  const applyTemplateImmediate = (templateKey: keyof typeof JOURNAL_TEMPLATES) => {
    setSelectedTemplate(templateKey)
    setNewEntryText(JOURNAL_TEMPLATES[templateKey])
  }

  // ─── Energy Scale ───────────────────────────────────────────────────────────
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

  // ─── Mood Scale — compact and overflow-proof across all screens ───────────
  const renderMoodScale = (currentVal: number, onChange: (val: number) => void, readonly = false) => {
    return (
      <div className="flex justify-between gap-1 sm:gap-2 w-full">
        {[1, 2, 3, 4, 5].map(val => {
          const MoodIcon = MOOD_ICONS[val - 1]
          const isSelected = currentVal === val
          return (
            <button
              key={val}
              disabled={readonly}
              type="button"
              aria-label={`Mood: ${MOOD_LABELS[val - 1]}`}
              title={MOOD_LABELS[val - 1]}
              onClick={() => {
                haptic('light')
                onChange(val)
              }}
              className={`flex-1 min-w-0 min-h-[50px] flex flex-col items-center justify-center gap-1 transition-all duration-200 ease-out py-2 px-0.5 sm:px-1 rounded-xl border ${
                isSelected
                  ? 'bg-info/15 border-info text-info scale-105 font-medium'
                  : 'bg-surface-2 border-border text-text-muted hover:border-info/30 hover:bg-surface-2/80 hover:text-text'
              } ${readonly ? 'cursor-default' : 'cursor-pointer active:scale-95'}`}
            >
              <MoodIcon size={20} className={`flex-shrink-0 ${isSelected ? 'text-info' : 'text-text-muted'}`} />
              <span className={`text-[9px] sm:text-[10px] font-medium leading-none truncate max-w-full text-center px-0.5 ${isSelected ? 'text-info' : 'text-text-muted'}`}>
                {MOOD_LABELS[val - 1]}
              </span>
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

  // Time-aware ritual suggestions
  const currentHour = new Date().getHours()
  const isMorningComplete = Boolean(record?.morning_complete)
  const isEveningComplete = Boolean(record?.evening_complete)
  const isEveningTime = currentHour >= 17 // after 5pm
  const isPastNoon = currentHour >= 12

  const eveningUnlocked = isMorningComplete || isPastNoon || eveningUnlockedEarly

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 relative">
      {/* Header */}
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

      {/* PRIMARY MOMENT CTA */}
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
        
        {/* SECTION 1: MORNING RITUAL */}
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

            {morningExpanded && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-4 text-xs">
                <div>
                  <span className="text-text-secondary font-medium block mb-1.5">Energy</span>
                  {renderLightningScale(energyAm, () => {}, true)}
                </div>

                {morningJournal && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1">Morning Journal</span>
                    <p className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-text font-normal line-clamp-3">
                      {morningJournal}
                    </p>
                  </div>
                )}

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

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Energy</label>
              {renderLightningScale(energyAm, (val) => {
                setEnergyAm(val)
                handleSaveFields({ energy_am: val })
              })}
            </div>

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

            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">Priorities</label>
              
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

        {/* SECTION 2: EVENING REVIEW */}
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

                {nightJournal && (
                  <div>
                    <span className="text-text-secondary font-medium block mb-1">Night Journal</span>
                    <p className="p-3 bg-surface-2 border border-border rounded-xl text-sm text-text line-clamp-4">
                      {nightJournal}
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

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Mood</label>
              {renderMoodScale(mood, (val) => {
                setMood(val)
                handleSaveFields({ mood: val })
              })}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary">Energy</label>
              {renderLightningScale(energyPm, (val) => {
                setEnergyPm(val)
                handleSaveFields({ energy_pm: val })
              })}
            </div>

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

      {/* FREE JOURNAL SECTION */}
      <section className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border/50 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <FileText size={18} className="text-text-secondary" />
            Free Journal
          </h2>
          <button
            type="button"
            onClick={() => navigate('/notes?folder=Journal')}
            className="text-xs font-semibold py-1.5 px-3 bg-surface-2 border border-border text-text-secondary rounded-xl hover:bg-surface-3 transition-colors flex items-center gap-1.5 flex-shrink-0"
            title="Open Journal folder in Notes"
          >
            <ExternalLink size={12} /> Notes
          </button>
        </div>

        {/* Monthly journal stats */}
        {monthlyJournalStats.total > 0 && (
          <div className="flex items-center gap-3 p-3 bg-surface-2/60 border border-border/50 rounded-xl text-xs text-text-secondary">
            <BarChart2 size={14} className="text-accent flex-shrink-0" />
            <span>
              <strong className="text-text">{monthlyJournalStats.total}</strong> journal {monthlyJournalStats.total === 1 ? 'entry' : 'entries'} this month
              {monthlyJournalStats.avgWords > 0 && ` · avg ${monthlyJournalStats.avgWords} words`}
            </span>
          </div>
        )}

        {/* This Day Last Year */}
        {thisTimeLasYear && (
          <div className="flex items-start gap-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <Sparkles size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent mb-0.5">This day last year</p>
              <p className="text-xs text-text-secondary line-clamp-2">
                {(thisTimeLasYear as any).content?.replace(/##.*\n?/g, '').replace(/[#*`]/g, '').trim().slice(0, 120) || 'You wrote in your journal.'}
              </p>
              <button
                onClick={() => navigate(`/notes?highlight=${(thisTimeLasYear as any).id}`)}
                className="text-xs text-accent hover:underline mt-1 inline-flex items-center gap-1"
              >
                Read it <ExternalLink size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Add a moment — each submission appends a timestamped entry to
            today's shared journal note, between the Morning and Evening
            sections, rather than replacing anything. */}
        <div className="space-y-2">
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

          <textarea
            value={newEntryText}
            onChange={(e) => setNewEntryText(e.target.value)}
            placeholder="Add a moment from your day… (supports markdown, #hashtags auto-tag)"
            rows={3}
            className="w-full bg-surface-2 border border-border focus:border-border-hover rounded-xl px-4 py-3 text-sm text-text focus:outline-none transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleAddJournalEntry(newEntryText)}
              disabled={!newEntryText.trim() || addingEntry}
              className="px-4 py-2 bg-text text-bg text-xs font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
            >
              <Plus size={14} />
              {addingEntry ? 'Adding…' : `Add entry · ${format(new Date(), 'h:mm a')}`}
            </button>
          </div>
        </div>

        {/* Today's full journal note — Morning, timestamped entries, and
            Evening, all in one continuous read-only preview. Edit Morning /
            Evening via their rituals above; edit the full raw note in Notes. */}
        {journalNoteForDate?.content ? (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-text-secondary mb-2">Today's journal</p>
            <div className="prose prose-invert max-w-none text-sm text-text bg-surface-2/50 border border-border rounded-xl p-4 prose-h2:text-sm prose-h2:mt-3 prose-h2:mb-1 prose-h3:text-xs prose-h3:text-accent prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{journalNoteForDate.content as string}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted italic text-center py-4">
            Nothing written yet today — add a moment above, or start your morning ritual.
          </p>
        )}
      </section>

      {/* DAY SCORE */}
      <section className="p-5 bg-surface border border-border rounded-2xl shadow-[var(--shadow-card)] space-y-4">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <Award size={16} className="text-text-muted" />
          Day Score
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-6">
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

      {/* ConfirmDialog for replacing journal template */}
      <ConfirmDialog
        open={confirmTemplateOpen}
        onOpenChange={setConfirmTemplateOpen}
        title="Replace draft entry?"
        description="This swaps in the template and clears what you've started typing below."
        confirmLabel="Replace draft"
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
          ======================================================== */}
      {(guidedMode === 'morning' || guidedMode === 'evening') && createPortal((() => {
        const isMorning = guidedMode === 'morning'
        const totalSteps = 5

        const pct = Math.round((wizardStep / totalSteps) * 100)

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

            {/* Celebration overlay */}
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

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="max-w-md mx-auto">

                {/* ── MORNING STEPS ── */}

                {/* Step 1: Energy Check */}
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

                {/* Step 2: Free Morning Journal */}
                {isMorning && wizardStep === 2 && (
                  <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 2 · Morning Journal</p>
                      <h2 className="text-2xl font-display font-bold text-white">How are you feeling?</h2>
                      <p className="text-white/60 text-xs mt-1">Free write — no structure needed. Just express yourself.</p>
                    </div>

                    {/* This Day Last Year callout */}
                    {thisTimeLasYear && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-amber-400/20">
                        <Sparkles size={13} className="text-amber-300 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-300 mb-0.5">This day last year you wrote:</p>
                          <p className="text-xs text-white/60 line-clamp-2">
                            {(thisTimeLasYear as any).content?.replace(/##.*\n?/g, '').replace(/[#*`]/g, '').trim().slice(0, 100)}…
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        autoFocus
                        value={morningJournal}
                        onChange={e => setMorningJournal(e.target.value)}
                        placeholder="Write freely… What's on your mind this morning? How do you feel? What are you looking forward to?"
                        rows={8}
                        className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm outline-none resize-none transition-colors`}
                      />
                      {/* Voice-to-text button */}
                      {morningVoice.supported && (
                        <button
                          type="button"
                          onClick={morningVoice.isListening ? morningVoice.stop : morningVoice.start}
                          className={`absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            morningVoice.isListening
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                          }`}
                          title={morningVoice.isListening ? 'Stop dictation' : 'Dictate'}
                        >
                          {morningVoice.isListening ? <MicOff size={15} /> : <Mic size={15} />}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 flex items-center gap-1">
                      <Hash size={10} /> Use #hashtags to auto-tag this note
                    </p>
                  </div>
                )}

                {/* Step 3: Intention */}
                {isMorning && wizardStep === 3 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 3 · Intention</p>
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

                {/* Step 4: Gratitude */}
                {isMorning && wizardStep === 4 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 4 · Gratitude</p>
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

                {/* Step 5: Priorities */}
                {isMorning && wizardStep === 5 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-amber-300/70 text-xs font-medium mb-1">Step 5 · Priorities</p>
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

                {/* Step 1: Mood Check */}
                {!isMorning && wizardStep === 1 && (
                  <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div>
                      <p className="text-blue-300/70 text-xs font-medium mb-1">Step 1 · Mood Check</p>
                      <h2 className="text-2xl font-display font-bold text-white">How was your day?</h2>
                      <p className="text-white/60 text-xs mt-1">Take a moment to check in with your mood.</p>
                    </div>
                    {renderMoodScale(mood, setMood)}
                  </div>
                )}

                {/* Step 2: Energy */}
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

                {/* Step 3: Night Journal */}
                {!isMorning && wizardStep === 3 && (
                  <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-blue-300/70 text-xs font-medium mb-1">Step 3 · Night Journal</p>
                        <h2 className="text-2xl font-display font-bold text-white">Reflect on your day</h2>
                        <p className="text-white/60 text-xs mt-1">Free write or use the preset sections below.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNightSectionConfig(v => !v)}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors flex-shrink-0 mt-1"
                        title="Configure sections"
                      >
                        <Settings2 size={14} />
                      </button>
                    </div>

                    {/* Section configurator */}
                    {showNightSectionConfig && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-white/70">Preset Sections</p>
                        {nightSections.map(section => (
                          <div key={section} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setNightSectionsEnabled(prev => ({ ...prev, [section]: prev[section] === false ? true : false }))}
                              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                nightSectionsEnabled[section] === false
                                  ? 'bg-transparent border-white/30'
                                  : 'bg-blue-400 border-blue-400 text-gray-900'
                              }`}
                            >
                              {nightSectionsEnabled[section] !== false && <Check size={12} strokeWidth={3} />}
                            </button>
                            <span className="text-xs text-white/80 flex-1">{section}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-white/40">Enabled sections appear as headers in your journal.</p>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        autoFocus
                        value={nightJournal}
                        onChange={e => setNightJournal(e.target.value)}
                        placeholder="How did today go? What's on your mind as you wind down?"
                        rows={10}
                        className={`w-full bg-white/10 border border-white/20 ${accentFocusBorder} rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm outline-none resize-none transition-colors`}
                      />
                      {nightVoice.supported && (
                        <button
                          type="button"
                          onClick={nightVoice.isListening ? nightVoice.stop : nightVoice.start}
                          className={`absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            nightVoice.isListening
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                          }`}
                          title={nightVoice.isListening ? 'Stop dictation' : 'Dictate'}
                        >
                          {nightVoice.isListening ? <MicOff size={15} /> : <Mic size={15} />}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 flex items-center gap-1">
                      <Hash size={10} /> Use #hashtags to auto-tag this note
                    </p>
                  </div>
                )}

                {/* Step 4: Structured Reflection */}
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

                {/* Step 5: Win of Day */}
                {!isMorning && wizardStep === 5 && (
                  <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-300/70 text-xs font-medium mb-1">Step 5 · Your biggest win</p>
                        <h2 className="text-2xl font-display font-bold text-white">Biggest win today?</h2>
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
              </div>
            </div>

            {/* Bottom nav */}
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
                  {/* Allow skipping journal steps */}
                  {(wizardStep === 2 || wizardStep === 3) && (
                    <button
                      onClick={() => { haptic('light'); setWizardStep(s => s + 1) }}
                      className="px-4 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => {
                      haptic('light')
                      if (isMorning && wizardStep === 2) {
                        saveJournalNote(morningJournal, nightJournal)
                      } else if (!isMorning && wizardStep === 3) {
                        saveJournalNote(morningJournal, nightJournal)
                      }
                      setWizardStep(s => s + 1)
                    }}
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
