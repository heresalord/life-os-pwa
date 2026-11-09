import React, { useState } from 'react'
import { FileText, CheckSquare, Inbox, Check, ArrowDownToLine } from 'lucide-react'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useAuth } from '../../hooks/useAuth'
import { getUserLocalDate } from '../../lib/dateUtils'
import { useAppStore } from '../../store/useAppStore'
import { haptic } from '../../lib/haptic'
import type { MessageAttachment } from '../../db/schema'

interface Props {
  attachment: MessageAttachment
  isMe?: boolean
  isSender?: boolean
}

export function AttachmentBubbleCard({ attachment, isMe, isSender }: Props) {
  const isOutgoing = isMe ?? isSender ?? false
  const { user } = useAuth()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  const { addNote } = useNoteMutations()
  const { addTask } = useTaskMutations(today)
  const { addItem: addInboxItem } = useInboxMutations()

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const type = attachment.type
  const snapshot = attachment.snapshot || {}

  const handleSaveToSelf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saved || saving || !user) return

    setSaving(true)
    haptic('light')

    try {
      if (type === 'note') {
        await addNote.mutateAsync({
          title: (snapshot.title as string) || 'Shared Note',
          content: (snapshot.content as string) || '',
          date: today,
        })
      } else if (type === 'task') {
        await addTask.mutateAsync({
          title: (snapshot.title as string) || 'Shared Task',
          priority: Number(snapshot.priority) || 4,
          due_date: (snapshot.date as string) || today,
          date: today,
        })
      } else if (type === 'inbox_item') {
        await addInboxItem.mutateAsync((snapshot.text as string) || 'Shared Item')
      }

      setSaved(true)
      haptic('success')
    } catch (err) {
      console.error('[Attachment] Failed to save shared item:', err)
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  // Visual formatting depending on attachment kind
  const config = (() => {
    switch (type) {
      case 'note':
        return {
          label: 'Note',
          icon: FileText,
          title: (snapshot.title as string) || 'Untitled Note',
          preview: (snapshot.content as string) || '',
          actionLabel: 'Save to Notes',
          savedLabel: 'Saved to Notes',
        }
      case 'task':
        return {
          label: 'Task',
          icon: CheckSquare,
          title: (snapshot.title as string) || 'Untitled Task',
          preview: snapshot.date ? `Due: ${snapshot.date}` : undefined,
          actionLabel: 'Add to Tasks',
          savedLabel: 'Added to Tasks',
        }
      case 'inbox_item':
        return {
          label: 'Inbox Item',
          icon: Inbox,
          title: (snapshot.text as string) || 'Inbox Idea',
          preview: undefined,
          actionLabel: 'Add to Inbox',
          savedLabel: 'Added to Inbox',
        }
      default:
        return {
          label: 'Attachment',
          icon: FileText,
          title: 'Unsupported attachment',
          preview: 'Please update the app to view this item.',
          actionLabel: 'Unsupported',
          savedLabel: 'Unsupported',
        }
    }
  })()

  const Icon = config.icon

  return (
    <div
      className={`rounded-2xl border p-3.5 space-y-2.5 max-w-sm transition-all duration-200 select-none shadow-xs ${
        isOutgoing
          ? 'bg-white/10 border-white/20 text-white'
          : 'bg-surface border-border/80 text-text'
      }`}
    >
      {/* Badge + Type */}
      <div className="flex items-center justify-between text-[11px] font-medium tracking-wide">
        <div className="flex items-center gap-1.5 opacity-80">
          <Icon size={12} />
          <span className="uppercase">{config.label}</span>
        </div>
        {typeof snapshot.word_count === 'number' && (
          <span className="opacity-70 text-[10px]">{snapshot.word_count} words</span>
        )}
      </div>

      {/* Main card body */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold line-clamp-1">{config.title}</h4>
        {config.preview && (
          <p className="text-xs opacity-75 line-clamp-2 leading-relaxed whitespace-pre-line">
            {config.preview}
          </p>
        )}
      </div>

      {/* Action button for recipient (save to their own account) */}
      {!isOutgoing && (
        <button
          onClick={handleSaveToSelf}
          disabled={saved || saving}
          className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 ${
            saved
              ? 'bg-success/20 text-success border border-success/30 cursor-default'
              : 'bg-accent text-white hover:bg-accent/90 shadow-2xs'
          }`}
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <>
              <Check size={13} />
              <span>{config.savedLabel}</span>
            </>
          ) : (
            <>
              <ArrowDownToLine size={13} />
              <span>{config.actionLabel}</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
