import React, { useRef, useState } from 'react'
import { Trash2, Pin, MoreHorizontal, Download, Copy, FolderInput, Files } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Note } from '../../db/schema'
import { extractTags, stripTags } from '../../lib/noteTagUtils'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import clsx from 'clsx'

const SYSTEM_FOLDERS = ['All', 'Pinned', 'Journal', 'Templates']

function exportAsMarkdown(note: Note) {
  const body = stripTags(note.content)
  const blob = new Blob([`# ${note.title}\n\n${body}`], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function copyAsPlainText(note: Note) {
  const body = stripTags(note.content).replace(/[#*`_~[\]]/g, '').trim()
  navigator.clipboard.writeText(`${note.title}\n\n${body}`)
}

function highlightText(text: string, search: string) {
  if (!search.trim()) return <span>{text}</span>
  const regex = new RegExp(`(${search.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-warning/20 text-warning px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

export function NoteCard({
  note,
  onClick,
  onDelete,
  folders = [],
  isActive = false,
  searchTerm = '',
}: {
  note: Note
  onClick: () => void
  onDelete: (id: string) => void
  folders?: string[]
  isActive?: boolean
  searchTerm?: string
}) {
  const [swiped, setSwiped] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const { pinNote, moveToFolder, addNote } = useNoteMutations()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const tags    = extractTags(note.content)
  const snippet = stripTags(note.content).replace(/[#*`_~]/g, '').slice(0, 100).trim() || 'No content'

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSwiped(false)
    setShowDeleteConfirm(true)
  }

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    pinNote.mutate({ id: note.id, pinned: !note.pinned })
  }

  const allFolders = [...new Set([...SYSTEM_FOLDERS, ...folders])].filter(f => f !== 'All' && f !== 'Pinned')

  const wordCount = (note as any).word_count as number | undefined

  return (
    <>
      <div
        className={clsx(
          'relative overflow-hidden rounded-xl border group cursor-pointer transition-colors',
          isActive
            ? 'bg-accent/8 border-accent/40'
            : 'bg-surface border-border',
          (note as any).pinned && 'ring-1 ring-amber-400/30'
        )}
      >
        {/* Swipe-reveal delete zone */}
        <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
          <button onClick={confirmDelete} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div
          onClick={onClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            'relative flex flex-col p-4 transition-all duration-200 ease-out',
            isActive ? 'bg-accent/8' : 'bg-surface hover:bg-surface-2',
            swiped ? '-translate-x-16' : 'translate-x-0'
          )}
        >
          {/* Header row */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {(note as any).pinned && (
                <Pin size={11} className="text-amber-400 flex-shrink-0 fill-amber-400" />
              )}
              <span className="text-sm font-medium text-text truncate">
                {highlightText(note.title, searchTerm)}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {/* Pin button */}
              <button
                onClick={handlePin}
                title={(note as any).pinned ? 'Unpin' : 'Pin'}
                className={clsx(
                  'p-1 rounded-md transition-colors',
                  // Always visible on mobile (no hover), fade-in on desktop hover
                  (note as any).pinned
                    ? 'opacity-100 text-amber-400 hover:text-amber-300'
                    : 'text-text-muted hover:text-text opacity-60 md:opacity-0 md:group-hover:opacity-100'
                )}
              >
                <Pin size={12} className={clsx((note as any).pinned && 'fill-amber-400')} />
              </button>

              {/* Three-dot menu */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="p-1 rounded-md text-text-muted hover:text-text transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 bg-surface border border-border rounded-xl shadow-2xl py-1 min-w-[180px]"
                    sideOffset={4}
                    align="end"
                  >
                    {/* Duplicate */}
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer outline-none"
                      onSelect={() => {
                        addNote.mutate({
                          title: `Copy of ${note.title}`,
                          content: note.content,
                          date: today,
                          folder: (note as any).folder ?? 'All',
                          pinned: false,
                          is_template: (note as any).is_template ?? false,
                        })
                      }}
                    >
                      <Files size={13} className="text-text-muted" />
                      Duplicate
                    </DropdownMenu.Item>

                    {/* Move to folder */}
                    {allFolders.length > 0 && (
                      <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer outline-none">
                          <FolderInput size={13} className="text-text-muted" />
                          Move to Folder
                        </DropdownMenu.SubTrigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.SubContent className="z-50 bg-surface border border-border rounded-xl shadow-2xl py-1 min-w-[160px]">
                            {allFolders.map(f => (
                              <DropdownMenu.Item
                                key={f}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer outline-none"
                                onSelect={() => moveToFolder.mutate({ id: note.id, folder: f })}
                              >
                                {f === (note as any).folder && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                                )}
                                <span className={f !== (note as any).folder ? 'pl-4' : ''}>{f}</span>
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Sub>
                    )}

                    <DropdownMenu.Separator className="h-px bg-border my-1" />

                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer outline-none"
                      onSelect={() => exportAsMarkdown(note)}
                    >
                      <Download size={13} className="text-text-muted" />
                      Export as Markdown
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer outline-none"
                      onSelect={() => copyAsPlainText(note)}
                    >
                      <Copy size={13} className="text-text-muted" />
                      Copy as Plain Text
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="h-px bg-border my-1" />

                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 cursor-pointer outline-none"
                      onSelect={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={13} />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {highlightText(snippet, searchTerm)}
          </p>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-[10px] text-text-muted">
              {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {wordCount !== undefined && wordCount > 0 && (
              <div className="text-[10px] text-text-muted">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(false) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <Dialog.Title className="text-base font-medium text-text mb-1">Delete this note?</Dialog.Title>
            <p className="text-sm text-text-secondary mb-5">
              <span className="font-medium text-text">"{note.title}"</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete(note.id) }}
                className="flex-[2] py-3 bg-danger/15 text-danger font-medium rounded-xl hover:bg-danger/25 transition-colors"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
