
import React, { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType } from '../../db/schema'
import clsx from 'clsx'

const TYPE_COLORS: Record<string, string> = {
  focus: 'border-l-accent bg-accent/10',
  meeting: 'border-l-info bg-info/10',
  routine: 'border-l-success bg-success/10',
  break: 'border-l-warning bg-warning/10',
  other: 'border-l-text-muted bg-surface-2'
}

const TYPE_TEXT_COLORS: Record<string, string> = {
  focus: 'text-accent',
  meeting: 'text-info',
  routine: 'text-success',
  break: 'text-warning',
  other: 'text-text-muted'
}

export function AgendaBlock({ block, onDelete }: { block: AgendaBlockType, onDelete: (id: string) => void }) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => touchStartX.current = null

  // Format time e.g., 09:00:00 -> 9:00 AM
  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    const hr12 = hr % 12 || 12
    return `${hr12}:${m} ${ampm}`
  }

  const colorClass = TYPE_COLORS[block.type || 'other'] || TYPE_COLORS.other
  const textClass = TYPE_TEXT_COLORS[block.type || 'other'] || TYPE_TEXT_COLORS.other

  return (
    <div className="relative overflow-hidden rounded-xl border border-border group">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(block.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex items-center p-3 transition-transform duration-200 ease-out border-l-4",
          colorClass,
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <div className="w-24 flex-shrink-0 flex flex-col items-start pr-2 border-r border-border/50 mr-3">
          <span className="text-sm font-medium text-text">{formatTime(block.start_time)}</span>
          <span className="text-xs text-text-muted">{formatTime(block.end_time)}</span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-text truncate">{block.title}</span>
          <span className={clsx("text-xs capitalize font-medium mt-0.5", textClass)}>{block.type}</span>
        </div>
      </div>
    </div>
  )
}
