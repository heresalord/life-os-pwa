import React, { useRef, useState } from 'react'
import { Check, X, RotateCw, Trash2, GripVertical, Pencil } from 'lucide-react'
import type { Task } from '../../db/schema'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import clsx from 'clsx'

interface TaskItemProps {
  task: Task
  onToggleComplete: (id: string, current: boolean) => void
  onToggleSkip: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  onEdit?: (id: string, newTitle: string) => void
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

export function TaskItem({ task, onToggleComplete, onToggleSkip, onDelete, onEdit, dragHandleProps }: TaskItemProps) {
  const [swiped, setSwiped] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.title)
  const [justCompleted, setJustCompleted] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const handleCheckClick = () => {
    if (!task.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 600)
    }
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

  const cancelEdit = () => {
    setEditValue(task.title)
    setEditing(false)
  }

  const isPending = !task.completed && !task.skipped

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group">
      {/* Swipe background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(task.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

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
          <div {...dragHandleProps}
            className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none">
            <GripVertical size={16} />
          </div>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Checkbox with completion animation */}
        <button
          onClick={handleCheckClick}
          className={clsx(
            'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-all duration-200',
            task.completed
              ? 'bg-success border-success text-bg'
              : 'border-border hover:border-text-muted text-transparent hover:text-text-muted',
            justCompleted && 'scale-125'
          )}
        >
          <Check size={14} strokeWidth={3}
            className={clsx('transition-transform duration-300', justCompleted && 'scale-110')} />
        </button>

        {/* Title — inline editable */}
        <div className="flex flex-col min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              className="text-sm text-text bg-transparent border-b border-accent focus:outline-none w-full py-0.5"
            />
          ) : (
            <span
              onDoubleClick={isPending ? startEdit : undefined}
              className={clsx(
                'text-sm truncate transition-colors select-none',
                task.completed || task.skipped ? 'text-text-muted line-through' : 'text-text'
              )}
            >
              {task.title}
            </span>
          )}
          {task.carried_from && !editing && (
            <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5 select-none">
              <RotateCw size={10} /> Carried from {task.carried_from}
            </span>
          )}
        </div>

        {/* Priority */}
        {task.priority && isPending && !editing && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-2 text-text-secondary flex-shrink-0 select-none">
            P{task.priority}
          </span>
        )}

        {/* Edit button (desktop hover) */}
        {isPending && !editing && onEdit && (
          <button
            onClick={startEdit}
            className="text-text-muted hover:text-accent transition-colors p-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Edit task"
          >
            <Pencil size={13} />
          </button>
        )}

        {/* Skip / Undo */}
        {isPending && !editing && (
          <button
            onClick={() => onToggleSkip(task.id, task.skipped)}
            className="text-text-muted hover:text-warning transition-colors p-1 flex-shrink-0 select-none"
            title="Skip task"
          >
            <X size={16} />
          </button>
        )}

        {(task.completed || task.skipped) && !editing && (
          <button
            onClick={() => {
              if (task.completed) onToggleComplete(task.id, true)
              else onToggleSkip(task.id, true)
            }}
            className="text-[10px] text-text-muted hover:text-text transition-colors border border-border px-2 py-1 rounded flex-shrink-0 select-none"
          >
            Undo
          </button>
        )}
      </div>

      {/* Completion flash overlay */}
      {justCompleted && (
        <div className="absolute inset-0 bg-success/10 rounded-xl pointer-events-none animate-ping-once" />
      )}
    </div>
  )
}
