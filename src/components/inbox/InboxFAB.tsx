import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useAuth } from '../../hooks/useAuth'
import { enqueueSync } from '../../db/syncQueue'
import { db } from '../../db'

const TYPES = ['thought', 'idea', 'worry', 'todo', 'other'] as const

export function InboxFAB() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [type, setType] = useState<typeof TYPES[number]>('thought')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()

  const handleCapture = async () => {
    if (!text.trim() || !user) return
    setSaving(true)

    const item = {
      id: crypto.randomUUID(),
      user_id: user.id,
      text: text.trim(),
      type,
      processed: false,
      processed_at: null,
      processed_to: null,
      archived_at: null,
      captured_at: new Date().toISOString(),
    }

    await db.inbox_items.add(item as Parameters<typeof db.inbox_items.add>[0])
    await enqueueSync('inbox_items', 'insert', item)

    setText('')
    setType('thought')
    setSaving(false)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          id="inbox-fab"
          aria-label="Quick capture"
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-accent text-bg shadow-lg shadow-accent/30 flex items-center justify-center hover:bg-accent-dim active:scale-95 transition-all"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />

          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Quick Capture</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  type === t ? 'bg-accent text-bg' : 'bg-surface-2 text-text-secondary hover:bg-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCapture() }}
            placeholder="What's on your mind?"
            rows={3}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none transition-colors text-sm"
          />
          <p className="text-xs text-text-muted mt-1.5 mb-4">⌘↵ to save</p>

          <button
            onClick={handleCapture}
            disabled={!text.trim() || saving}
            className="w-full bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Capture'}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
