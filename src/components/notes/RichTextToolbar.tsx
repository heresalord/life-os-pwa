import React, { useRef } from 'react'
import { Bold, Italic, Heading1, Heading2, Link, List, Code, ListTodo } from 'lucide-react'

interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onBodyChange: (newBody: string) => void
  body: string
  /** Optional — shows a "Create task" button that hands off the current
   *  selection (or falls back to the note title) to the parent. */
  onCreateTask?: () => void
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string
): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end) || placeholder
  const newText = value.slice(0, start) + before + selected + after + value.slice(end)
  // Restore cursor/selection
  const newStart = start + before.length
  const newEnd = newStart + selected.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(newStart, newEnd)
  })
  return newText
}

function prefixLines(
  textarea: HTMLTextAreaElement,
  prefix: string
): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  // Find the beginning of the first line
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = value.indexOf('\n', end)
  const regionEnd = lineEnd === -1 ? value.length : lineEnd
  const lines = value.slice(lineStart, regionEnd).split('\n')
  const prefixed = lines.map(l => prefix + l).join('\n')
  const newText = value.slice(0, lineStart) + prefixed + value.slice(regionEnd)
  const newPos = lineStart + prefixed.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(newPos, newPos)
  })
  return newText
}

export function RichTextToolbar({ textareaRef, onBodyChange, body, onCreateTask }: RichTextToolbarProps) {
  // Keep a stable ref to latest body so callbacks don't close over stale value
  const bodyRef = useRef(body)
  bodyRef.current = body

  const apply = (fn: (ta: HTMLTextAreaElement) => string) => {
    const ta = textareaRef.current
    if (!ta) return
    onBodyChange(fn(ta))
  }

  const tools = [
    {
      label: 'Bold',
      icon: <Bold size={13} strokeWidth={2.5} />,
      action: () => apply(ta => wrapSelection(ta, '**', '**', 'bold text')),
    },
    {
      label: 'Italic',
      icon: <Italic size={13} strokeWidth={2.5} />,
      action: () => apply(ta => wrapSelection(ta, '*', '*', 'italic text')),
    },
    {
      label: 'H1',
      icon: <Heading1 size={13} strokeWidth={2.5} />,
      action: () => apply(ta => prefixLines(ta, '# ')),
    },
    {
      label: 'H2',
      icon: <Heading2 size={13} strokeWidth={2.5} />,
      action: () => apply(ta => prefixLines(ta, '## ')),
    },
    {
      label: 'Link',
      icon: <Link size={13} strokeWidth={2.5} />,
      action: () => apply(ta => {
        const { selectionStart: s, selectionEnd: e, value } = ta
        const selected = value.slice(s, e) || 'link text'
        const newText = value.slice(0, s) + `[${selected}](url)` + value.slice(e)
        requestAnimationFrame(() => {
          ta.focus()
          // Select the "url" part
          const urlStart = s + selected.length + 3
          ta.setSelectionRange(urlStart, urlStart + 3)
        })
        return newText
      }),
    },
    {
      label: 'List',
      icon: <List size={13} strokeWidth={2.5} />,
      action: () => apply(ta => prefixLines(ta, '- ')),
    },
    {
      label: 'Code',
      icon: <Code size={13} strokeWidth={2.5} />,
      action: () => apply(ta => {
        const { selectionStart: s, selectionEnd: e, value } = ta
        const selected = value.slice(s, e)
        const isMultiLine = selected.includes('\n')
        if (isMultiLine) {
          return wrapSelection(ta, '```\n', '\n```', 'code')
        }
        return wrapSelection(ta, '`', '`', 'code')
      }),
    },
  ]

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-surface flex-shrink-0">
      {tools.map((tool, i) => (
        <React.Fragment key={tool.label}>
          {i === 4 && <div className="w-px h-4 bg-border mx-1" />}
          <button
            type="button"
            title={tool.label}
            onMouseDown={e => {
              e.preventDefault() // don't steal textarea focus
              tool.action()
            }}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-xs font-medium"
          >
            {tool.icon}
          </button>
        </React.Fragment>
      ))}
      {onCreateTask && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            title="Create task from selection"
            onMouseDown={e => {
              e.preventDefault()
              onCreateTask()
            }}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors text-xs font-medium"
          >
            <ListTodo size={13} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  )
}
