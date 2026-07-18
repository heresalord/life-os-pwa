import React from 'react'
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

const TOOLS = [
  {
    label: 'Bold',
    icon: <Bold size={13} strokeWidth={2.5} />,
  },
  {
    label: 'Italic',
    icon: <Italic size={13} strokeWidth={2.5} />,
  },
  {
    label: 'H1',
    icon: <Heading1 size={13} strokeWidth={2.5} />,
  },
  {
    label: 'H2',
    icon: <Heading2 size={13} strokeWidth={2.5} />,
  },
  {
    label: 'Link',
    icon: <Link size={13} strokeWidth={2.5} />,
  },
  {
    label: 'List',
    icon: <List size={13} strokeWidth={2.5} />,
  },
  {
    label: 'Code',
    icon: <Code size={13} strokeWidth={2.5} />,
  },
]

export function RichTextToolbar({ textareaRef, onBodyChange, onCreateTask }: RichTextToolbarProps) {
  const apply = (fn: (ta: HTMLTextAreaElement) => string) => {
    const ta = textareaRef.current
    if (!ta) return
    onBodyChange(fn(ta))
  }

  const handleToolAction = (label: string) => {
    apply(ta => {
      switch (label) {
        case 'Bold':
          return wrapSelection(ta, '**', '**', 'bold text')
        case 'Italic':
          return wrapSelection(ta, '*', '*', 'italic text')
        case 'H1':
          return prefixLines(ta, '# ')
        case 'H2':
          return prefixLines(ta, '## ')
        case 'Link': {
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
        }
        case 'List':
          return prefixLines(ta, '- ')
        case 'Code': {
          const { selectionStart: s, selectionEnd: e, value } = ta
          const selected = value.slice(s, e)
          const isMultiLine = selected.includes('\n')
          if (isMultiLine) {
            return wrapSelection(ta, '```\n', '\n```', 'code')
          }
          return wrapSelection(ta, '`', '`', 'code')
        }
        default:
          return ta.value
      }
    })
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-surface flex-shrink-0">
      {TOOLS.map((tool, i) => (
        <React.Fragment key={tool.label}>
          {i === 4 && <div className="w-px h-4 bg-border mx-1" />}
          <button
            type="button"
            title={tool.label}
            onMouseDown={e => {
              e.preventDefault() // don't steal textarea focus
              handleToolAction(tool.label)
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
