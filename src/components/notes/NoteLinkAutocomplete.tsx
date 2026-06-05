import { useState, useEffect, useRef } from 'react'
import type { Note } from '../../db/schema'
import { Search, X } from 'lucide-react'

interface NoteLinkAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  notes: Note[]
  body: string
  onBodyChange: (newBody: string) => void
}

interface Match {
  start: number
  query: string
}

function findOpenLink(text: string, cursor: number): Match | null {
  // Look behind cursor for [[ without a closing ]]
  const before = text.slice(0, cursor)
  const openIdx = before.lastIndexOf('[[')
  if (openIdx === -1) return null
  const between = before.slice(openIdx + 2)
  // If there's a closing ]] between [[ and cursor, no match
  if (between.includes(']]')) return null
  return { start: openIdx, query: between }
}

export function NoteLinkAutocomplete({
  textareaRef,
  notes,
  body,
  onBodyChange,
}: NoteLinkAutocompleteProps) {
  const [match, setMatch] = useState<Match | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Re-check whenever body changes
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const c = ta.selectionStart ?? 0
    setCursor(c)
    setMatch(findOpenLink(body, c))
  }, [body, textareaRef])

  // Also listen to selectionchange
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const onSelect = () => {
      const c = ta.selectionStart ?? 0
      setCursor(c)
      setMatch(findOpenLink(ta.value, c))
    }
    ta.addEventListener('keyup', onSelect)
    ta.addEventListener('click', onSelect)
    return () => {
      ta.removeEventListener('keyup', onSelect)
      ta.removeEventListener('click', onSelect)
    }
  }, [textareaRef])

  // Calculate dropdown position (rough approximation below the textarea)
  useEffect(() => {
    if (!match || !textareaRef.current) return
    const rect = textareaRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left + 16 })
  }, [match, textareaRef])

  if (!match) return null

  const query = match.query.toLowerCase()
  const suggestions = notes
    .filter(n => n.title.toLowerCase().includes(query) && n.title.trim())
    .slice(0, 8)

  if (suggestions.length === 0) return null

  const insertLink = (title: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const before = body.slice(0, match.start)
    const after = body.slice(cursor)
    const newBody = `${before}[[${title}]]${after}`
    onBodyChange(newBody)
    setMatch(null)
    requestAnimationFrame(() => {
      ta.focus()
      const newCursor = match.start + title.length + 4
      ta.setSelectionRange(newCursor, newCursor)
    })
  }

  return (
    <div
      ref={listRef}
      className="fixed z-50 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left, minWidth: 220, maxWidth: 320 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={12} className="text-text-muted" />
        <span className="text-xs text-text-muted">Link to note</span>
        <button
          type="button"
          className="ml-auto text-text-muted hover:text-text"
          onMouseDown={e => { e.preventDefault(); setMatch(null) }}
        >
          <X size={12} />
        </button>
      </div>
      <div className="py-1 max-h-48 overflow-y-auto">
        {suggestions.map(note => (
          <button
            key={note.id}
            type="button"
            onMouseDown={e => { e.preventDefault(); insertLink(note.title) }}
            className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-2 transition-colors truncate"
          >
            {note.title}
            {note.word_count > 0 && (
              <span className="ml-2 text-xs text-text-muted">{note.word_count}w</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
