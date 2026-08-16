import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, CalendarDays, AlignLeft, Clock, Check } from 'lucide-react'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import type { AddTaskPayload } from '../../hooks/useTaskMutations'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useTranslation } from '../../i18n'
import { SheetSelect } from '../SheetSelect'

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

const PRIORITIES = [
  { value: 1, label: 'P1', title: 'Critical', cls: 'border-danger text-danger bg-danger/10 data-[sel=true]:bg-danger/20' },
  { value: 2, label: 'P2', title: 'High',     cls: 'border-warning text-warning bg-warning/10 data-[sel=true]:bg-warning/20' },
  { value: 3, label: 'P3', title: 'Medium',   cls: 'border-info text-info bg-info/10 data-[sel=true]:bg-info/20' },
  { value: 4, label: 'P4', title: 'Low',      cls: 'border-border text-text-muted bg-surface-2 data-[sel=true]:bg-muted' },
]

interface Props {
  date: string
  defaultKanbanStatus?: KanbanStatus
  onAdded?: () => void
  /** When true, renders as a round FAB button instead of the full-width dashed button */
  asFab?: boolean
  /** External open state — when provided, no internal trigger button is rendered
   *  and the caller fully controls visibility (used by the header "+" action). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddTaskModal({ date, defaultKanbanStatus, onAdded, asFab, open: openProp, onOpenChange }: Props) {
  const { t } = useTranslation()
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setOpenState(v)
  }
  const [title, setTitle]         = useState('')
  const [priority, setPriority]   = useState<number | null>(null)
  const [dueDate, setDueDate]     = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [projectId, setProjectId] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const { data: projects } = useProjectsQuery()
  const { addTask } = useTaskMutations(date)

  const reset = () => {
    setTitle('')
    setPriority(null)
    setDueDate('')
    setDescription('')
    setStartTime('')
    setEndTime('')
    setProjectId('')
    setShowExtra(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isTimeInvalid) return

    const payload: AddTaskPayload = {
      title: title.trim(),
      priority,
      date,
      due_date: dueDate || null,
      description: description.trim() || null,
      kanban_status: defaultKanbanStatus ?? 'todo',
      time_block_start: startTime || null,
      time_block_end: endTime || null,
      project_id: projectId || null,
    }
    addTask.mutate(payload)
    onAdded?.()
    setJustAdded(true)
    setTimeout(() => {
      reset()
      setJustAdded(false)
      setOpen(false)
    }, 700)
  }

  const isTimeInvalid = (!!startTime && !!endTime && startTime >= endTime) || (!startTime && !!endTime)

  return (
    <Dialog.Root open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      {!isControlled && (
        <Dialog.Trigger asChild>
          {asFab ? (
            <button
              className="w-14 h-14 bg-accent text-bg rounded-full flex items-center justify-center shadow-modal hover:scale-105 active:scale-95 transition-transform"
              style={{ transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              aria-label={t('tasks.add_task', 'Add Task')}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          ) : (
            <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
              <Plus size={18} /> {t('tasks.add_task', 'Add Task')}
            </button>
          )}
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-text">{t('tasks.new_task', 'New Task')}</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <input
              autoFocus
              type="text"
              placeholder={t('tasks.placeholder', 'What needs to be done?')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none"
            />

            {/* Priority */}
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">{t('tasks.priority', 'Priority')}</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button key={p.value} type="button" title={p.title}
                    data-sel={priority === p.value ? 'true' : 'false'}
                    onClick={() => setPriority(priority === p.value ? null : p.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${p.cls} ${priority === p.value ? 'ring-2 ring-offset-1 ring-offset-surface' : 'opacity-60 hover:opacity-100'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date row */}
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays size={12} /> {t('tasks.due_date', 'Due Date (optional)')}
              </label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            {/* Time Block (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> {t('tasks.start_time', 'Start Time (opt.)')}
                </label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> {t('tasks.end_time', 'End Time (opt.)')}
                </label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
            </div>
            {startTime && endTime && startTime >= endTime && (
              <p className="text-xs text-danger">{t('tasks.time_error_end', 'End time must be after start time.')}</p>
            )}
            {!startTime && endTime && (
              <p className="text-xs text-danger">{t('tasks.time_error_start', 'Start time is required if end time is specified.')}</p>
            )}

            {/* Project Selection */}
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">
                {t('tasks.project', 'Project (optional)')}
              </label>
              <SheetSelect
                label={t('tasks.project', 'Project')}
                value={projectId}
                onChange={setProjectId}
                placeholder={t('tasks.no_project', 'No Project')}
                options={[{ value: '', label: t('tasks.no_project', 'No Project') }, ...(projects?.filter(p => !p.archived).map(p => ({ value: p.id, label: p.name })) ?? [])]}
              />
            </div>

            {/* Description (toggle) */}
            {showExtra ? (
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <AlignLeft size={12} /> {t('tasks.description', 'Description')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('tasks.description_placeholder', 'Add details…')}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none text-sm"
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowExtra(true)}
                className="text-xs text-text-muted hover:text-text flex items-center gap-2 transition-colors">
                <AlignLeft size={12} /> {t('tasks.add_description', 'Add description')}
              </button>
            )}

            <button type="submit" disabled={!title.trim() || addTask.isPending || isTimeInvalid || justAdded}
              className={`w-full font-medium rounded-xl py-3 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 ${justAdded ? 'bg-success text-bg' : 'bg-accent text-bg hover:bg-accent-dim'}`}>
              {justAdded && <Check size={16} />}
              {justAdded ? t('tasks.added', 'Added!') : addTask.isPending ? t('tasks.adding', 'Adding…') : t('tasks.add_task', 'Add Task')}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
