
import React, { useRef, useState } from 'react'
import { Trash2, Share2 } from 'lucide-react'
import { ProcessItemModal } from './ProcessItemModal'
import type { InboxItem } from '../../db/schema'
import { ShareModal } from '../dashboard/ShareModal'
import clsx from 'clsx'

export function InboxItemCard({ item, onDelete }: { item: InboxItem, onDelete: (id: string) => void }) {
  const [swiped, setSwiped] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => touchStartX.current = null

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(item.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <ProcessItemModal item={item}>
        <button
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            "w-full relative flex flex-col p-4 bg-surface text-left transition-transform duration-200 ease-out hover:bg-surface-2",
            swiped ? "-translate-x-16" : "translate-x-0"
          )}
        >
          <div className="flex items-center justify-between mb-1.5 w-full">
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
              {item.type}
            </span>
            <div className="flex items-center gap-1.5">
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
