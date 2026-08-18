import React, { useRef, useState } from 'react'
import { Check, X, RotateCw, Trash2, GripVertical, Pencil, ChevronDown, ChevronRight, CalendarDays, Clock } from 'lucide-react'
import { haptic } from '../../lib/haptic'
import type { Task } from '../../db/schema'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { format, isPast, isToday } from 'date-fns'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { TaskEditSheet } from './TaskEditSheet'
import clsx from 'clsx'

interface Subtask { id: string; title: string; completed: boolean }

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
  task, onToggleComplete, onToggleSkip, onDelete, onUpdateSubtasks, dragHandleProps
}: TaskItemProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [fillCheckbox, setFillCheckbox] = useState(false)
  // Pending-delete state: swipe-left shows undo instead of deleting immediately
  const [pendingDelete, setPendingDelete] = useState(false)
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: projects } = useProjectsQuery()
  const linkedProject = projects?.find(p => p.id === task.project_id)

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hr   = parseInt(h)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    return `${hr % 12 || 12}:${m} ${ampm}`
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setDragging(true)
    longPressTimer.current = setTimeout(() => {
      haptic('heavy')
      setEditSheetOpen(true)
    }, 350)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = e.touches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    // Allow dragging but resist after thresholds
    if (diff > 120) {
      setDragX(120 + (diff - 120) * 0.2)
    } else if (diff < -120) {
      setDragX(-120 + (diff + 120) * 0.2)
    } else {
      setDragX(diff)
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    setDragging(false)
    touchStartX.current = null

    if (dragX < -100) {
      // Enter pending-delete state — user has 3s to undo before permanent delete
      haptic('medium')
      setPendingDelete(true)
      setDragX(0)
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current)
      pendingDeleteTimer.current = setTimeout(() => {
        setPendingDelete(false)
        onDelete(task.id)
      }, 3000)
    } else if (dragX > 80) {
      handleCheckClick()
      setDragX(0)
    } else {
      setDragX(0)
    }
  }

  const handleUndoDelete = () => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current)
    setPendingDelete(false)
    haptic('light')
  }

  const handleCheckClick = () => {
    if (!task.completed) {
      haptic('success')
      setIsAnimating(true)
      setTimeout(() => {
        setFillCheckbox(true)
      }, 100)
      setTimeout(() => {
        onToggleComplete(task.id, task.completed)
        setIsAnimating(false)
        setFillCheckbox(false)
      }, 300)
    } else {
      haptic('light')
      onToggleComplete(task.id, task.completed)
    }
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

  // Priority-based left border colour
  const priorityBorder = {
    1: 'border-l-[3px] border-red-500',
    2: 'border-l-[3px] border-orange-400',
    3: 'border-l-[3px] border-blue-400',
  }[task.priority ?? 0] ?? ''

  return (
    <div className={clsx(
      'relative overflow-hidden rounded-xl bg-surface border border-border group shadow-[var(--shadow-card)]',
      task.completed || task.skipped ? 'border-l-[3px] border-l-border opacity-75' : (priorityBorder || 'border-l-[3px] border-l-border'),
      isOverdue && !task.completed && 'border-danger/30',
      pendingDelete && 'ring-1 ring-danger/40'
    )}>
      {/* Background slide right action: Complete Task */}
      <div className="absolute inset-y-0 left-0 flex items-center justify-start bg-success/15 px-4 w-full">
        <div className="flex items-center gap-2 text-success font-semibold text-xs">
          <Check size={16} />
          <span>Complete Task</span>
        </div>
      </div>

      {/* Swipe delete zone — shows pending state with Undo */}
      {pendingDelete ? (
        <div className="absolute inset-0 flex items-center justify-between bg-danger/10 px-4">
          <span className="text-xs text-danger font-medium flex items-center gap-1.5">
            <Trash2 size={13} /> Task deleted
          </span>
          <button
            onClick={handleUndoDelete}
            className="text-xs font-semibold text-danger border border-danger/40 px-3 py-1.5 rounded-lg hover:bg-danger/10 transition-colors"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
          <div className="flex items-center gap-2 text-danger font-semibold text-xs">
            <Trash2 size={16} />
            <span>Delete</span>
          </div>
        </div>
      )}

      {/* Main row */}
      <div
        onTouchStart={!pendingDelete ? handleTouchStart : undefined}
        onTouchMove={!pendingDelete ? handleTouchMove : undefined}
        onTouchEnd={!pendingDelete ? handleTouchEnd : undefined}
        style={{
          transform: `translateX(${dragging ? dragX : 0}px)`
        }}
        className={clsx(
          'relative flex items-center gap-2 p-3 bg-surface hover:bg-surface-2',
          !dragging && 'transition-transform duration-200 ease-out',
          pendingDelete && 'opacity-40 pointer-events-none'
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
          style={{ transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          className={clsx(
            'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-all',
            (task.completed || fillCheckbox) ? 'bg-success border-success text-bg' : 'border-border hover:border-text-muted text-transparent hover:text-text-muted',
            isAnimating && 'scale-125'
          )}>
          {(task.completed || fillCheckbox) && (
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"
                className="animate-dash"
                style={{ strokeDasharray: 20, strokeDashoffset: 20 }}
              />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span
            className={clsx('text-sm truncate select-none transition-all duration-200', (task.completed || fillCheckbox || task.skipped) ? 'text-text-muted line-through opacity-60' : 'text-text')}>
            {task.title}
          </span>

          {/* Metadata row */}
          <div className="flex items-center gap-2 flex-wrap">
            {task.carried_from && (
              <span className="text-[10px] text-text-muted flex items-center gap-1 select-none">
                <RotateCw size={9} /> Carried
              </span>
            )}
            {dueDateStr && (
              <span className={clsx('text-[10px] flex items-center gap-1 select-none', isOverdue ? 'text-danger font-medium' : 'text-text-muted')}>
                <CalendarDays size={9} /> {dueDateStr}{isOverdue ? ' · Overdue' : ''}
              </span>
            )}
            {task.time_block_start && (
              <span className="text-[10px] text-accent font-medium flex items-center gap-1 select-none">
                <Clock size={9} /> {formatTime(task.time_block_start)}{task.time_block_end ? ` – ${formatTime(task.time_block_end)}` : ''}
              </span>
            )}
            {linkedProject && (
              <span
                className="text-[9px] font-bold px-2 py-0.2 rounded border uppercase tracking-wider flex items-center gap-1 select-none"
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
        </div>

        {/* Subtask expand toggle */}
        {hasSubtasks && isPending && (
          <button onClick={() => setExpanded(v => !v)} className="text-text-muted hover:text-text flex-shrink-0 p-1 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Edit button — always visible on mobile (no hover-gate), subtle on desktop */}
        {isPending && (
          <button
            onClick={() => setEditSheetOpen(true)}
            className="text-text-muted hover:text-accent p-1.5 flex-shrink-0 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center md:opacity-0 md:group-hover:opacity-100"
            aria-label="Edit task"
          >
            <Pencil size={14} />
          </button>
        )}

        {/* Skip / Undo */}
        {isPending && (
          <button onClick={() => onToggleSkip(task.id, task.skipped)} className="text-text-muted hover:text-warning p-1 flex-shrink-0 select-none" title="Skip">
            <X size={16} />
          </button>
        )}
        {(task.completed || task.skipped) && (
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



      {/* Full Task Edit sheet */}
      <TaskEditSheet 
        task={task} 
        open={editSheetOpen} 
        onClose={() => setEditSheetOpen(false)} 
      />
    </div>
  )
}
