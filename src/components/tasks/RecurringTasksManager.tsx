import { useState } from 'react'
import { Plus, Trash2, Repeat, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { db } from '../../db'
import type { RecurringTask } from '../../db'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const REPEAT_OPTIONS = [
  { value: 'daily',    label: 'Every day'    },
  { value: 'weekdays', label: 'Weekdays'     },
  { value: 'weekends', label: 'Weekends'     },
  { value: 'weekly',   label: 'Weekly'       },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RecurringTasksManager() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState<RecurringTask['repeat']>('daily')
  const [dayOfWeek, setDayOfWeek] = useState(1) // Mon

  const { data: templates = [] } = useQuery({
    queryKey: ['recurring_tasks', user?.id],
    enabled: !!user,
    queryFn: () => db.recurring_tasks.where('user_id').equals(user!.id).toArray()
  })

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) return
      const t: RecurringTask = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: title.trim(),
        priority: null,
        repeat,
        day_of_week: repeat === 'weekly' ? dayOfWeek : undefined,
        active: true,
        created_at: new Date().toISOString(),
      }
      await db.recurring_tasks.add(t)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] })
      setTitle('')
      setOpen(false)
    }
  })

  const remove = useMutation({
    mutationFn: (id: string) => db.recurring_tasks.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] })
  })

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await db.recurring_tasks.update(id, { active })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] })
  })

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Repeat size={14} /> Recurring Tasks
        </h2>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors">
              <Plus size={14} /> Add
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
            <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-medium text-text">New Recurring Task</Dialog.Title>
                <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Task Title</label>
                  <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Morning run, Take vitamins…"
                    className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Repeat</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REPEAT_OPTIONS.map(o => (
                      <button key={o.value} type="button" onClick={() => setRepeat(o.value as RecurringTask['repeat'])}
                        className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
                          repeat === o.value
                            ? 'bg-accent/15 border-accent/40 text-accent'
                            : 'bg-surface-2 border-border text-text-muted hover:text-text'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                {repeat === 'weekly' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Day of week</label>
                    <div className="flex gap-1">
                      {DAYS.map((d, i) => (
                        <button key={i} type="button" onClick={() => setDayOfWeek(i)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            dayOfWeek === i
                              ? 'bg-accent/15 border-accent/40 text-accent'
                              : 'bg-surface-2 border-border text-text-muted hover:text-text'
                          }`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}
                  className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
                  {add.isPending ? 'Saving…' : 'Create Recurring Task'}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-text-muted py-2">
          Recurring tasks are automatically added to your task list every day they're scheduled.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border">
              <button onClick={() => toggle.mutate({ id: t.id, active: !t.active })}
                className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  t.active ? 'bg-accent border-accent' : 'border-border bg-transparent'
                }`}>
                {t.active && <span className="text-bg text-xs font-bold">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${t.active ? 'text-text' : 'text-text-muted line-through'}`}>{t.title}</p>
                <p className="text-xs text-text-muted capitalize">
                  {REPEAT_OPTIONS.find(o => o.value === t.repeat)?.label}
                  {t.repeat === 'weekly' && t.day_of_week !== undefined ? ` · ${DAYS[t.day_of_week]}` : ''}
                </p>
              </div>
              <button onClick={() => remove.mutate(t.id)} className="text-text-muted hover:text-danger transition-colors p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
