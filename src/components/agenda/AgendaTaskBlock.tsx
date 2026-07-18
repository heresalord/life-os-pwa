import { useRef, useState, useMemo } from 'react'
import { Trash2, CheckSquare, Square, Briefcase } from 'lucide-react'
import type { Task } from '../../db/schema'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useNowMinutes } from '../../hooks/useNowMinutes'
import { haptic } from '../../lib/haptic'
import clsx from 'clsx'

interface AgendaTaskBlockProps {
  task: Task
  onDelete: (id: string) => void
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function AgendaTaskBlock({ task, onDelete }: AgendaTaskBlockProps) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const nowMins = useNowMinutes()

  const { updateTask } = useTaskMutations(task.date)
  const { data: projects } = useProjectsQuery()

  const linkedProject = useMemo(() => {
    if (!task.project_id) return null
    return projects?.find(p => p.id === task.project_id) || null
  }, [projects, task.project_id])

  const isAllDay  = !task.time_block_start
  const startMins = task.time_block_start ? toMins(task.time_block_start) : 0
  const endMins   = task.time_block_end ? toMins(task.time_block_end) : 0
  const isActive  = !isAllDay && nowMins >= startMins && nowMins < endMins
  const duration  = endMins - startMins
  const pct       = isActive && task.time_block_end && task.time_block_start && duration > 0
    ? Math.min(100, Math.round(((nowMins - startMins) / duration) * 100))
    : 0

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hr   = parseInt(h)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    return `${hr % 12 || 12}:${m} ${ampm}`
  }

  const getDuration = () => {
    if (isAllDay || !task.time_block_start || !task.time_block_end) return ''
    const mins = endMins - startMins
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const handleToggleComplete = () => {
    haptic('medium')
    updateTask.mutate({
      id: task.id,
      updates: {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null
      }
    })
  }

  return (
    <div className={clsx(
      'relative overflow-hidden rounded-xl border group transition-all',
      isActive ? 'border-accent/50 shadow-md shadow-accent/10' : 'border-border',
      task.completed && 'opacity-65'
    )}>
      {/* Swipe delete background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(task.id)}
          className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'relative flex items-center p-3 bg-surface transition-transform duration-200 ease-out gap-3',
          isActive ? 'border-l-4 border-l-accent' : 'border-l-4 border-l-transparent',
          swiped ? '-translate-x-16' : 'translate-x-0'
        )}
      >
        {/* Checkbox selector */}
        <button
          type="button"
          onClick={handleToggleComplete}
          className="text-text-secondary hover:text-accent transition-colors flex-shrink-0 cursor-pointer"
        >
          {task.completed ? (
            <CheckSquare size={18} className="text-accent" />
          ) : (
            <Square size={18} />
          )}
        </button>

        {/* Time column or All Day badge */}
        {isAllDay ? (
          <div className="w-24 flex-shrink-0 flex items-center pr-2 border-r border-border/50 mr-1">
            <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/15 px-2 py-0.5 rounded-lg flex-shrink-0 uppercase tracking-wider">
              All Day
            </span>
          </div>
        ) : (
          <div className="w-24 flex-shrink-0 flex flex-col items-start pr-2 border-r border-border/50 mr-1">
            <span className={clsx('text-sm font-medium', isActive ? 'text-accent' : 'text-text')}>
              {formatTime(task.time_block_start!)}
            </span>
            {task.time_block_end && (
              <span className="text-xs text-text-muted">{formatTime(task.time_block_end)}</span>
            )}
          </div>
        )}

        {/* Task Title & Project Badge */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'text-sm font-medium truncate',
              task.completed ? 'line-through text-text-muted' : (isActive ? 'text-accent' : 'text-text')
            )}>
              {task.title}
            </span>

            {/* Now indicator */}
            {isActive && !task.completed && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent flex-shrink-0 animate-pulse">
                NOW
              </span>
            )}

            {/* Priority Badge */}
            {task.priority && !task.completed && (
              <span className={clsx(
                'text-[9px] font-bold px-2 py-0.2 rounded border uppercase tracking-wider',
                task.priority === 1 ? 'border-danger/30 text-danger bg-danger/5'
                : task.priority === 2 ? 'border-warning/30 text-warning bg-warning/5'
                : 'border-border text-text-muted bg-surface-2'
              )}>
                P{task.priority}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {/* Duration / Label */}
            <span className="text-xs text-text-secondary">
              {isAllDay ? 'All-day task' : getDuration()}
            </span>

            {/* Linked Project Highlight */}
            {linkedProject && (
              <span
                className="text-[9px] font-bold px-2 py-0.2 rounded border uppercase tracking-wider flex items-center gap-1"
                style={{
                  borderColor: `${linkedProject.color}33`,
                  color: linkedProject.color || '#3b82f6',
                  backgroundColor: `${linkedProject.color}11`
                }}
              >
                <Briefcase size={9} />
                {linkedProject.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar for active task */}
      {isActive && !task.completed && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/20">
          <div
            className="h-full bg-accent transition-all duration-60000"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
