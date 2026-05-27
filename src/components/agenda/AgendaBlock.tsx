import { useRef, useState, useEffect } from 'react'
import { Trash2, GripVertical } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType } from '../../db/schema'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import clsx from 'clsx'

interface AgendaBlockProps {
  block: AgendaBlockType
  onDelete: (id: string) => void
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

function useNowMinutes() {
  const [mins, setMins] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setMins(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return mins
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function AgendaBlock({ block, onDelete, dragHandleProps }: AgendaBlockProps) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const nowMins = useNowMinutes()

  const startMins = toMins(block.start_time)
  const endMins   = toMins(block.end_time)
  const isActive  = nowMins >= startMins && nowMins < endMins
  const pct       = isActive
    ? Math.round(((nowMins - startMins) / (endMins - startMins)) * 100)
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
    const mins = endMins - startMins
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className={clsx(
      'relative overflow-hidden rounded-xl border group',
      isActive ? 'border-accent/50 shadow-md shadow-accent/10' : 'border-border'
    )}>
      {/* Swipe delete background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(block.id)}
          className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'relative flex items-center p-3 bg-surface transition-transform duration-200 ease-out gap-2',
          isActive ? 'border-l-4 border-l-accent' : 'border-l-4 border-l-transparent',
          swiped ? '-translate-x-16' : 'translate-x-0'
        )}
      >
        {/* Drag handle */}
        {dragHandleProps && (
          <div {...dragHandleProps}
            className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none">
            <GripVertical size={16} />
          </div>
        )}

        {/* Time column */}
        <div className="w-24 flex-shrink-0 flex flex-col items-start pr-2 border-r border-border/50 mr-1">
          <span className={clsx('text-sm font-medium', isActive ? 'text-accent' : 'text-text')}>
            {formatTime(block.start_time)}
          </span>
          <span className="text-xs text-text-muted">{formatTime(block.end_time)}</span>
        </div>

        {/* Description + duration + now badge */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={clsx('text-sm font-medium truncate', isActive ? 'text-accent' : 'text-text')}>
              {block.description}
            </span>
            {isActive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent flex-shrink-0 animate-pulse">
                NOW
              </span>
            )}
          </div>
          <span className="text-xs text-text-muted mt-0.5">{getDuration()}</span>
        </div>
      </div>

      {/* Progress bar for active block */}
      {isActive && (
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
