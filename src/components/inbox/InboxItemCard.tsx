import React, { useRef, useState } from 'react'
import { Trash2, Share2, CalendarPlus } from 'lucide-react'
import { ProcessItemModal } from './ProcessItemModal'
import type { InboxItem } from '../../db/schema'
import { ShareModal } from '../dashboard/ShareModal'
import { haptic } from '../../lib/haptic'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useAppStore } from '../../store/useAppStore'
import clsx from 'clsx'

export function InboxItemCard({ item, onDelete }: { item: InboxItem, onDelete: (id: string) => void }) {
  const [dragX, setDragX] = useState(0)
  const [swipedLeft, setSwipedLeft] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  
  const { processItem } = useInboxMutations()
  const { selectedDate } = useAppStore()

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = e.touches[0].clientX - touchStartX.current
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
    setDragging(false)
    touchStartX.current = null

    if (dragX < -60) {
      setSwipedLeft(true)
      setDragX(-64)
    } else if (dragX > 80) {
      haptic('success')
      processItem.mutate({
        id: item.id,
        updates: { processed: true, processed_at: new Date().toISOString(), processed_to: 'task' },
        target: { type: 'task', title: item.text.trim(), priority: null, date: selectedDate }
      })
      setDragX(0)
    } else {
      setSwipedLeft(false)
      setDragX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group animate-in fade-in duration-200">
      {/* Background slide right action: Convert to Task */}
      <div className="absolute inset-y-0 left-0 flex items-center justify-start bg-success/15 px-4 w-full">
        <div className="flex items-center gap-2 text-success font-semibold text-xs">
          <CalendarPlus size={16} />
          <span>Convert to Task</span>
        </div>
      </div>

      {/* Background slide left action: Delete */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => { haptic('medium'); onDelete(item.id) }} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <ProcessItemModal item={item}>
        <button
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${dragging ? dragX : (swipedLeft ? -64 : 0)}px)`
          }}
          className={clsx(
            "w-full relative flex flex-col p-4 bg-surface text-left hover:bg-surface-2",
            !dragging && "transition-transform duration-200 ease-out"
          )}
        >
          <div className="flex items-center justify-between mb-2 w-full">
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
              {item.type}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">
                {new Date(item.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  setShareOpen(true)
                }}
                className="p-1 rounded text-text-muted hover:text-accent hover:bg-surface-3 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Share Inbox Item"
              >
                <Share2 size={12} />
              </span>
            </div>
          </div>
          <p className="text-sm text-text leading-relaxed line-clamp-3">{item.text}</p>
        </button>
      </ProcessItemModal>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        itemType="inbox"
        itemId={item.id}
        itemName={item.text || 'Inbox Item'}
      />
    </div>
  )
}
