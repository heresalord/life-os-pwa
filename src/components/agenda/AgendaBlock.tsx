import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType } from '../../db/schema'
import clsx from 'clsx'

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
  const handleTouchEnd = () => { touchStartX.current = null }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    const hr12 = hr % 12 || 12
    return `${hr12}:${m} ${ampm}`
  }

  // Calculate duration in minutes
  const getDuration = () => {
    const [sh, sm] = block.start_time.split(':').map(Number)
    const [eh, em] = block.end_time.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border group">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button
          onClick={() => onDelete(block.id)}
          className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex items-center p-3 bg-surface transition-transform duration-200 ease-out border-l-4 border-l-accent",
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <div className="w-24 flex-shrink-0 flex flex-col items-start pr-2 border-r border-border/50 mr-3">
          <span className="text-sm font-medium text-text">{formatTime(block.start_time)}</span>
          <span className="text-xs text-text-muted">{formatTime(block.end_time)}</span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-text truncate">{block.description}</span>
          <span className="text-xs text-text-muted mt-0.5">{getDuration()}</span>
        </div>
      </div>
    </div>
  )
}
