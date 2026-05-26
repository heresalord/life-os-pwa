import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { useDailyRecord } from '../../hooks/useDailyRecord'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useInboxQuery } from '../../hooks/useInboxQuery'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { Moon, ArrowRight, Check } from 'lucide-react'
import { TaskItem } from '../../components/tasks/TaskItem'
import { InboxItemCard } from '../../components/inbox/InboxItemCard'

const MOODS = [
  { value: 1, emoji: '😶', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Difficult' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' }
]

export function ReviewPage() {
  const { selectedDate } = useAppStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 4

  const { data: record, upsert } = useDailyRecord(selectedDate)
  const { data: tasks = [] } = useTasksQuery(selectedDate)
  const { updateTask } = useTaskMutations(selectedDate)
  const { data: inbox = [] } = useInboxQuery(false)
  const { deleteItem } = useInboxMutations()
  const { addNote } = useNoteMutations()

  const [mood, setMood] = useState<number | null>(null)
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)

  const pendingTasks = tasks.filter(t => !t.completed && !t.skipped)

  useEffect(() => {
    if (record?.mood && !mood) setMood(record.mood)
  }, [record])

  const handleNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS))
  const handleBack = () => setStep(s => Math.max(s - 1, 1))

  const handleFinish = async () => {
    if (saving) return
    setSaving(true)
    if (mood && mood !== record?.mood) {
      await upsert.mutateAsync({ mood })
    }
    if (reflection.trim()) {
      await addNote.mutateAsync({
        title: 'Evening Reflection',
        content: reflection.trim(),
        date: selectedDate,
        template: 'night'
      })
    }
    setSaving(false)
    navigate('/')
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-md mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display text-text flex items-center gap-2">
            <Moon className="text-info" size={24} /> Evening Review
          </h1>
          <span className="text-text-muted text-sm font-medium">{step} / {TOTAL_STEPS}</span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
          <div className="bg-info h-full transition-all duration-500 ease-out" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center space-y-8">
            <div>
              <h2 className="text-xl font-medium text-text mb-2">How was your day?</h2>
              <p className="text-sm text-text-secondary">Take a second to check in with yourself.</p>
            </div>
            <div className="flex justify-between gap-2 px-2">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-3 p-3 rounded-2xl transition-all ${mood === m.value ? 'bg-info/20 scale-110 shadow-lg shadow-info/10' : 'hover:bg-surface-2 grayscale hover:grayscale-0'}`}>
                  <span className="text-4xl">{m.emoji}</span>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${mood === m.value ? 'text-info' : 'text-text-muted'}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleNext} disabled={!mood} className="w-full flex items-center justify-center gap-2 py-3.5 bg-info text-bg font-medium rounded-xl hover:bg-info/90 transition-colors disabled:opacity-50">
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
          <div>
            <h2 className="text-xl font-medium text-text mb-2">Wrap up tasks</h2>
            <p className="text-sm text-text-secondary">Mark pending tasks done, skip them, or let them carry over tomorrow.</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-2 pr-2">
            {pendingTasks.length === 0 ? (
              <div className="p-8 text-center bg-surface-2 rounded-2xl border border-border border-dashed">
                <Check className="mx-auto text-success mb-3" size={32} />
                <p className="text-text font-medium">All tasks completed!</p>
              </div>
            ) : (
              pendingTasks.map(t => (
                <TaskItem key={t.id} task={t as Parameters<typeof TaskItem>[0]['task']}
                  onToggleComplete={(id) => updateTask.mutate({ id, updates: { completed: true, completed_at: new Date().toISOString() } })}
                  onToggleSkip={(id) => updateTask.mutate({ id, updates: { skipped: true, skipped_at: new Date().toISOString() } })}
                  onDelete={() => {}} />
              ))
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleBack} className="flex-1 py-3.5 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            <button onClick={handleNext} className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-info text-bg font-medium rounded-xl hover:bg-info/90 transition-colors">
              Continue <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
          <div>
            <h2 className="text-xl font-medium text-text mb-2">Clear your Inbox</h2>
            <p className="text-sm text-text-secondary">Process remaining thoughts so you can disconnect with a clear mind.</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-3 pr-2">
            {inbox.length === 0 ? (
              <div className="p-8 text-center bg-surface-2 rounded-2xl border border-border border-dashed">
                <Check className="mx-auto text-success mb-3" size={32} />
                <p className="text-text font-medium">Inbox is empty!</p>
              </div>
            ) : (
              inbox.map(item => (
                <InboxItemCard key={item.id} item={item as Parameters<typeof InboxItemCard>[0]['item']} onDelete={(id) => deleteItem.mutate(id)} />
              ))
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleBack} className="flex-1 py-3.5 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            <button onClick={handleNext} className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-info text-bg font-medium rounded-xl hover:bg-info/90 transition-colors">
              Continue <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div>
            <h2 className="text-xl font-medium text-text mb-2">Evening Reflection</h2>
            <p className="text-sm text-text-secondary">Write a quick note about today. (Optional)</p>
          </div>
          <textarea
            autoFocus
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="What went well today? What could have been better?"
            rows={6}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-info focus:ring-1 focus:ring-info focus:outline-none transition-all resize-none"
          />
          <div className="flex gap-3 pt-4 border-t border-border/50">
            <button onClick={handleBack} className="flex-1 py-3.5 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            <button onClick={handleFinish} disabled={saving} className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-info text-bg font-medium rounded-xl hover:bg-info/90 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Finish Day'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
