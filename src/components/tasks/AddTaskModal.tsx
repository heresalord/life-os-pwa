import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, CalendarDays, AlignLeft, Clock } from 'lucide-react'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import type { AddTaskPayload } from '../../hooks/useTaskMutations'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'

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
}

export function AddTaskModal({ date, defaultKanbanStatus, onAdded }: Props) {
  const [open, setOpen]           = useState(false)
  const [title, setTitle]         = useState('')
  const [priority, setPriority]   = useState<number | null>(null)
  const [dueDate, setDueDate]     = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [projectId, setProjectId] = useState('')
  const [showExtra, setShowExtra] = useState(false)

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
    reset()
    setOpen(false)
    onAdded?.()
  }

  const isTimeInvalid = (!!startTime && !!endTime && startTime >= endTime) || (!startTime && !!endTime)

  return (
    <Dialog.Root open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> Add Task
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-text">New Task</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <input
              autoFocus
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none"
            />

            {/* Priority */}
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Priority</label>
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
                <CalendarDays size={12} /> Due Date (optional)
              </label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            {/* Time Block (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> Start Time (opt)
                </label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> End Time (opt)
                </label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
            </div>
            {startTime && endTime && startTime >= endTime && (
              <p className="text-xs text-danger">End time must be after start time.</p>
            )}
            {!startTime && endTime && (
              <p className="text-xs text-danger">Start time is required if end time is specified.</p>
            )}

            {/* Project Selection */}
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">
                Project (optional)
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
              >
                <option value="">No Project</option>
                {projects?.filter(p => !p.archived).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description (toggle) */}
            {showExtra ? (
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider flex items-center gap-1">
                  <AlignLeft size={12} /> Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Add details…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none text-sm"
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowExtra(true)}
                className="text-xs text-text-muted hover:text-text flex items-center gap-1.5 transition-colors">
                <AlignLeft size={12} /> Add description
              </button>
            )}

            <button type="submit" disabled={!title.trim() || addTask.isPending || isTimeInvalid}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addTask.isPending ? 'Adding…' : 'Add Task'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
