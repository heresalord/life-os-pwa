
import React, { useRef, useState } from 'react'
import { Check, X, RotateCw, Trash2 } from 'lucide-react'
import type { Task } from '../../db/schema'
import clsx from 'clsx'

interface TaskItemProps {
  task: Task
  onToggleComplete: (id: string, current: boolean) => void
  onToggleSkip: (id: string, current: boolean) => void
  onDelete: (id: string) => void
}

export function TaskItem({ task, onToggleComplete, onToggleSkip, onDelete }: TaskItemProps) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }

  const handleTouchEnd = () => {
    touchStartX.current = null
  }

  const isPending = !task.completed && !task.skipped

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group">
      {/* Background action (Delete) visible on swipe */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(task.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Foreground content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex items-center gap-3 p-3 bg-surface transition-transform duration-200 ease-out",
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <button
          onClick={() => onToggleComplete(task.id, task.completed)}
          className={clsx(
            "w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
            task.completed ? "bg-success border-success text-bg" : "border-border hover:border-text-muted text-transparent"
          )}
        >
          <Check size={14} strokeWidth={3} />
        </button>

        <div className="flex flex-col min-w-0 flex-1">
          <span className={clsx(
            "text-sm truncate transition-colors",
            task.completed || task.skipped ? "text-text-muted line-through" : "text-text"
          )}>
            {task.title}
          </span>
          {task.carried_from && (
            <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
              <RotateCw size={10} /> Carried from {task.carried_from}
            </span>
          )}
        </div>

        {task.priority && isPending && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-2 text-text-secondary flex-shrink-0">
            P{task.priority}
          </span>
        )}

        {isPending && (
          <button
            onClick={() => onToggleSkip(task.id, task.skipped)}
            className="text-text-muted hover:text-warning transition-colors p-1 flex-shrink-0"
            title="Skip task"
          >
            <X size={16} />
          </button>
        )}
        
        {(task.completed || task.skipped) && (
           <button
             onClick={() => {
               if(task.completed) onToggleComplete(task.id, true)
               if(task.skipped) onToggleSkip(task.id, true)
             }}
             className="text-[10px] text-text-muted hover:text-text transition-colors border border-border px-2 py-1 rounded flex-shrink-0"
           >
             Undo
           </button>
        )}
      </div>
    </div>
  )
}
