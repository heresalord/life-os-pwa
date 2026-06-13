import React, { useRef, useState } from 'react'
import { Check, X, RotateCw, Trash2, GripVertical, Pencil, ChevronDown, ChevronRight, CalendarDays, Clock } from 'lucide-react'
import { haptic } from '../../lib/haptic'
import type { Task } from '../../db/schema'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { format, isPast, isToday } from 'date-fns'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import clsx from 'clsx'

interface Subtask { id: string; title: string; completed: boolean }

const PRIORITY_STYLES: Record<number, string> = {
  1: 'text-danger bg-danger/10 border-danger/30',
  2: 'text-warning bg-warning/10 border-warning/30',
  3: 'text-info bg-info/10 border-info/30',
  4: 'text-text-muted bg-surface-2 border-border',
}

interface TaskItemProps {
  task: Task
  onToggleComplete: (id: string, current: boolean) => void
  onToggleSkip: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  onEdit?: (id: string, newTitle: string) => void
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

export function TaskItem({
  task, onToggleComplete, onToggleSkip, onDelete, onEdit, onUpdateSubtasks, dragHandleProps
}: TaskItemProps) {
  const [swiped, setSwiped]           = useState(false)
  const [editing, setEditing]         = useState(false)
  const [editValue, setEditValue]     = useState(task.title)
  const [justCompleted, setJustCompleted] = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const touchStartX = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: projects } = useProjectsQuery()
  const linkedProject = projects?.find(p => p.id === task.project_id)

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hr   = parseInt(h)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    return `${hr % 12 || 12}:${m} ${ampm}`
  }

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const handleCheckClick = () => {
    if (!task.completed) { haptic('success'); setJustCompleted(true); setTimeout(() => setJustCompleted(false), 600) }
    else haptic('light')
    onToggleComplete(task.id, task.completed)
  }

  const startEdit = () => {
    setEditValue(task.title)
    setEditing(true)
    setSwiped(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const commitEdit = () => {
    const val = editValue.trim()
    if (val && val !== task.title && onEdit) onEdit(task.id, val)
    setEditing(false)
  }

  const isPending  = !task.completed && !task.skipped
  const subtasks   = (task.subtasks as unknown as Subtask[]) ?? []
  const doneCount  = subtasks.filter(s => s.completed).length
  const hasSubtasks = subtasks.length > 0

  // Due date display
  const dueDateStr = task.due_date
    ? isToday(new Date(task.due_date + 'T12:00:00'))
      ? 'Today'
      : format(new Date(task.due_date + 'T12:00:00'), 'MMM d')
    : null
  const isOverdue = task.due_date && isPast(new Date(task.due_date + 'T23:59:59')) && !task.completed

  const toggleSubtask = (subId: string) => {
    const updated = subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s)
    onUpdateSubtasks?.(task.id, updated)
  }

  return (
    <div className={clsx('relative overflow-hidden rounded-xl bg-surface border border-border group', isOverdue && !task.completed && 'border-danger/30')}>
      {/* Swipe delete zone */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(task.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Main row */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'relative flex items-center gap-2 p-3 bg-surface transition-transform duration-200 ease-out',
          swiped ? '-translate-x-16' : 'translate-x-0'
        )}
      >
        {/* Drag handle */}
        {isPending && dragHandleProps ? (
          <div {...dragHandleProps} className="text-text-muted hover:text-text-secondary flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none">
            <GripVertical size={16} />
          </div>
        ) : <div className="w-4 flex-shrink-0" />}

        {/* Checkbox */}
        <button onClick={handleCheckClick}
          className={clsx(
            'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-all duration-200',
            task.completed ? 'bg-success border-success text-bg' : 'border-border hover:border-text-muted text-transparent hover:text-text-muted',
            justCompleted && 'scale-125'
          )}>
          <Check size={14} strokeWidth={3} />
        </button>

        {/* Content */}
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          {editing ? (
            <input ref={inputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setEditValue(task.title) } }}
              className="text-sm text-text bg-transparent border-b border-accent focus:outline-none w-full py-0.5" />
          ) : (
            <span onDoubleClick={isPending ? startEdit : undefined}
              className={clsx('text-sm truncate select-none', task.completed || task.skipped ? 'text-text-muted line-through' : 'text-text')}>
              {task.title}
            </span>
          )}

          {/* Metadata row */}
          {!editing && (
            <div className="flex items-center gap-2 flex-wrap">
              {task.carried_from && (
                <span className="text-[10px] text-text-muted flex items-center gap-0.5 select-none">
                  <RotateCw size={9} /> Carried
                </span>
              )}
              {dueDateStr && (
                <span className={clsx('text-[10px] flex items-center gap-0.5 select-none', isOverdue ? 'text-danger font-medium' : 'text-text-muted')}>
                  <CalendarDays size={9} /> {dueDateStr}{isOverdue ? ' · Overdue' : ''}
                </span>
              )}
              {task.time_block_start && (
                <span className="text-[10px] text-accent font-medium flex items-center gap-0.5 select-none">
                  <Clock size={9} /> {formatTime(task.time_block_start)}{task.time_block_end ? ` – ${formatTime(task.time_block_end)}` : ''}
                </span>
              )}
              {linkedProject && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider flex items-center gap-0.5 select-none"
                  style={{
                    borderColor: `${linkedProject.color}33`,
                    color: linkedProject.color || '#3b82f6',
                    backgroundColor: `${linkedProject.color}11`
                  }}
                >
                  {linkedProject.name}
                </span>
              )}
              {hasSubtasks && (
                <span className="text-[10px] text-text-muted select-none">{doneCount}/{subtasks.length} subtasks</span>
              )}
            </div>
          )}
        </div>

        {/* Priority badge */}
        {task.priority && isPending && !editing && (
          <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 select-none', PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES[4])}>
            P{task.priority}
          </span>
        )}

        {/* Subtask expand toggle */}
        {hasSubtasks && isPending && !editing && (
          <button onClick={() => setExpanded(v => !v)} className="text-text-muted hover:text-text flex-shrink-0 p-1 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Edit (desktop hover) */}
        {isPending && !editing && onEdit && (
          <button onClick={startEdit} className="text-text-muted hover:text-accent p-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
            <Pencil size={13} />
          </button>
        )}

        {/* Skip / Undo */}
        {isPending && !editing && (
          <button onClick={() => onToggleSkip(task.id, task.skipped)} className="text-text-muted hover:text-warning p-1 flex-shrink-0 select-none" title="Skip">
            <X size={16} />
          </button>
        )}
        {(task.completed || task.skipped) && !editing && (
          <button onClick={() => { if (task.completed) onToggleComplete(task.id, true); else onToggleSkip(task.id, true) }}
            className="text-[10px] text-text-muted hover:text-text border border-border px-2 py-1 rounded flex-shrink-0 select-none">
            Undo
          </button>
        )}
      </div>

      {/* Subtask list */}
      {expanded && hasSubtasks && (
        <div className="border-t border-border bg-bg/30 px-4 py-2 space-y-1">
          {subtasks.map(sub => (
            <label key={sub.id} className="flex items-center gap-2 cursor-pointer py-1 group/sub">
              <div
                onClick={() => toggleSubtask(sub.id)}
                className={clsx(
                  'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-all cursor-pointer',
                  sub.completed ? 'bg-success border-success text-bg' : 'border-border hover:border-text-muted text-transparent hover:text-text-muted'
                )}>
                <Check size={10} strokeWidth={3} />
              </div>
              <span className={clsx('text-xs flex-1 select-none', sub.completed ? 'line-through text-text-muted' : 'text-text-secondary')}>
                {sub.title}
              </span>
            </label>
          ))}
        </div>
      )}

      {justCompleted && (
        <div className="absolute inset-0 bg-success/10 rounded-xl pointer-events-none animate-ping-once" />
      )}
    </div>
  )
}
