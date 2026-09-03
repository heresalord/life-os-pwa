import { useState } from 'react'
import { Plus, Trash2, Repeat, X, Check } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDb } from '../../db/DbContext'
import type { RecurringTask } from '../../db'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'

type RepeatType = RecurringTask['repeat']

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'daily',            label: 'Every day'        },
  { value: 'weekdays',         label: 'Weekdays (M–F)'   },
  { value: 'weekends',         label: 'Weekends'          },
  { value: 'weekly',           label: 'Weekly (pick days)'},
  { value: 'monthly',          label: 'Monthly (by date)' },
  { value: 'monthly_ordinal',  label: 'Monthly (by day)'  },
]

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ORDINALS: { value: number; label: string }[] = [
  { value:  1, label: 'First'  },
  { value:  2, label: 'Second' },
  { value:  3, label: 'Third'  },
  { value:  4, label: 'Fourth' },
  { value: -1, label: 'Last'   },
]

function repeatLabel(t: RecurringTask): string {
  switch (t.repeat) {
    case 'daily':    return 'Every day'
    case 'weekdays': return 'Mon – Fri'
    case 'weekends': return 'Sat & Sun'
    case 'weekly': {
      const days = t.days?.length
        ? t.days
        : t.day_of_week !== undefined ? [t.day_of_week] : []
      return days.length ? days.map(d => DAYS_SHORT[d]).join(', ') : 'Weekly'
    }
    case 'monthly':
      return t.day_of_month === -1
        ? 'Last day of month'
        : `${t.day_of_month ?? '?'}th of month`
    case 'monthly_ordinal': {
      const ord  = ORDINALS.find(o => o.value === t.ordinal)?.label ?? ''
      const wday = t.weekday !== undefined ? DAYS_SHORT[t.weekday] : ''
      return `${ord} ${wday} of month`
    }
    default: return t.repeat
  }
}

export function RecurringTasksManager() {
  const db = useDb()
  const { user }  = useAuth()
  const qc        = useQueryClient()
  const [open, setOpen] = useState(false)

  // Form state
  const [title,        setTitle]        = useState('')
  const [priority,     setPriority]     = useState<number | null>(null)
  const [repeat,       setRepeat]       = useState<RepeatType>('daily')
  const [weeklyDays,   setWeeklyDays]   = useState<number[]>([1]) // Mon
  const [dayOfMonth,   setDayOfMonth]   = useState(1)
  const [ordinal,      setOrdinal]      = useState(1)
  const [weekday,      setWeekday]      = useState(1) // Mon

  const { data: templates = [] } = useQuery({
    queryKey: ['recurring_tasks', user?.id],
    enabled:  !!user,
    queryFn:  () => db.recurring_tasks.where('user_id').equals(user!.id).toArray(),
  })

  const resetForm = () => {
    setTitle('')
    setPriority(null)
    setRepeat('daily')
    setWeeklyDays([1])
    setDayOfMonth(1)
    setOrdinal(1)
    setWeekday(1)
  }

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) return
      const t: RecurringTask = {
        id:        crypto.randomUUID(),
        user_id:   user.id,
        title:     title.trim(),
        priority,
        repeat,
        days:            repeat === 'weekly'          ? weeklyDays            : undefined,
        day_of_month:    repeat === 'monthly'         ? dayOfMonth            : undefined,
        ordinal:         repeat === 'monthly_ordinal' ? ordinal               : undefined,
        weekday:         repeat === 'monthly_ordinal' ? weekday               : undefined,
        active:    true,
        created_at: new Date().toISOString(),
      }
      await db.recurring_tasks.add(t)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] })
      resetForm()
      setOpen(false)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => db.recurring_tasks.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] }),
  })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      db.recurring_tasks.update(id, { active }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['recurring_tasks', user?.id] }),
  })

  const toggleDay = (d: number) =>
    setWeeklyDays(prev =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter(x => x !== d) : prev) : [...prev, d]
    )

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Repeat size={14} /> Recurring Tasks
        </h2>
        <Dialog.Root open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors">
              <Plus size={14} /> Add
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
            <Dialog.Content
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border overflow-y-auto max-h-[90dvh]"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-medium text-text">New Recurring Task</Dialog.Title>
                <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Task title</label>
                  <input
                    autoFocus value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Morning run, Take vitamins…"
                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Repeat type */}
                <div>
                  <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Repeat</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REPEAT_OPTIONS.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => setRepeat(o.value)}
                        className={clsx(
                          'py-2 text-xs font-medium rounded-xl border transition-colors text-left px-3',
                          repeat === o.value
                            ? 'bg-accent/15 border-accent/40 text-accent'
                            : 'bg-surface-2 border-border text-text-muted hover:text-text'
                        )}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weekly — multi-day picker */}
                {repeat === 'weekly' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Days of week</label>
                    <div className="flex gap-1">
                      {DAYS_SHORT.map((d, i) => (
                        <button key={i} type="button"
                          onClick={() => toggleDay(i)}
                          className={clsx(
                            'flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors',
                            weeklyDays.includes(i)
                              ? 'bg-accent/15 border-accent/40 text-accent'
                              : 'bg-surface-2 border-border text-text-muted hover:text-text'
                          )}>
                          {d.slice(0, 2)}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-text-muted mt-2">
                      {weeklyDays.map(d => DAYS_SHORT[d]).join(', ')}
                    </p>
                  </div>
                )}

                {/* Monthly — pick a day number */}
                {repeat === 'monthly' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Day of month</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min={1} max={31}
                        value={dayOfMonth}
                        onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                        className="w-24 bg-surface-2 border border-border rounded-xl px-3 py-2 text-text focus:border-accent focus:outline-none text-center"
                      />
                      <button type="button"
                        onClick={() => setDayOfMonth(-1)}
                        className={clsx(
                          'px-4 py-2 text-xs font-medium rounded-xl border transition-colors',
                          dayOfMonth === -1
                            ? 'bg-accent/15 border-accent/40 text-accent'
                            : 'bg-surface-2 border-border text-text-muted hover:text-text'
                        )}>
                        Last day
                      </button>
                    </div>
                  </div>
                )}

                {/* Monthly ordinal — "first Monday" etc */}
                {repeat === 'monthly_ordinal' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Which occurrence</label>
                      <div className="flex flex-wrap gap-2">
                        {ORDINALS.map(o => (
                          <button key={o.value} type="button"
                            onClick={() => setOrdinal(o.value)}
                            className={clsx(
                              'px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
                              ordinal === o.value
                                ? 'bg-accent/15 border-accent/40 text-accent'
                                : 'bg-surface-2 border-border text-text-muted hover:text-text'
                            )}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Day of week</label>
                      <div className="flex gap-1">
                        {DAYS_SHORT.map((d, i) => (
                          <button key={i} type="button"
                            onClick={() => setWeekday(i)}
                            className={clsx(
                              'flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors',
                              weekday === i
                                ? 'bg-accent/15 border-accent/40 text-accent'
                                : 'bg-surface-2 border-border text-text-muted hover:text-text'
                            )}>
                            {d.slice(0, 2)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      e.g. {ORDINALS.find(o => o.value === ordinal)?.label} {DAYS_SHORT[weekday]} of every month
                    </p>
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Priority (optional)</label>
                  <div className="flex gap-2">
                    {[
                      { v: 1, l: 'P1', cls: 'border-danger text-danger' },
                      { v: 2, l: 'P2', cls: 'border-warning text-warning' },
                      { v: 3, l: 'P3', cls: 'border-info text-info' },
                      { v: 4, l: 'P4', cls: 'border-border text-text-muted' },
                    ].map(p => (
                      <button key={p.v} type="button"
                        onClick={() => setPriority(priority === p.v ? null : p.v)}
                        className={clsx(
                          'flex-1 py-2 text-xs font-bold rounded-lg border transition-all',
                          p.cls,
                          priority === p.v ? 'opacity-100 ring-2 ring-offset-1 ring-offset-surface bg-surface-2' : 'opacity-40 hover:opacity-70'
                        )}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => add.mutate()}
                  disabled={!title.trim() || add.isPending}
                  className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50"
                >
                  {add.isPending ? 'Saving…' : 'Create Recurring Task'}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-text-muted py-2">
          Recurring tasks are automatically added to your task list on their scheduled days.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border">
              <button
                onClick={() => toggle.mutate({ id: t.id, active: !t.active })}
                className={clsx(
                  'w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                  t.active ? 'bg-accent border-accent' : 'border-border bg-transparent'
                )}
              >
                {t.active && <Check size={11} className="text-bg" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-medium truncate', t.active ? 'text-text' : 'text-text-muted line-through')}>
                  {t.title}
                </p>
                <p className="text-xs text-text-muted">{repeatLabel(t)}</p>
              </div>
              <button
                onClick={() => remove.mutate(t.id)}
                className="text-text-muted hover:text-danger transition-colors p-1 flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
