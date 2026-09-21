import { Check } from 'lucide-react'
import clsx from 'clsx'

/**
 * Flip a single markdown checklist line ("- [ ] foo" <-> "- [x] foo") by
 * its 1-indexed source line number, leaving every other line untouched.
 */
export function toggleChecklistLine(body: string, lineNumber: number): string {
  const lines = body.split('\n')
  const idx = lineNumber - 1
  if (idx < 0 || idx >= lines.length) return body
  const line = lines[idx]
  if (/^(\s*[-*+]\s+)\[ \]/.test(line)) {
    lines[idx] = line.replace('[ ]', '[x]')
  } else if (/^(\s*[-*+]\s+)\[x\]/i.test(line)) {
    lines[idx] = line.replace(/\[x\]/i, '[ ]')
  }
  return lines.join('\n')
}

/**
 * ReactMarkdown `components` override that renders GFM task-list items
 * (rendered by remark-gfm) as tappable, rounded, Apple Notes-style
 * checkboxes rather than remark-gfm's plain disabled <input type="checkbox">.
 * Checked items get dimmed, strikethrough text.
 *
 * Usage: <ReactMarkdown remarkPlugins={[remarkGfm]} components={checklistMarkdownComponents(body, onBodyChange)}>
 */
export function checklistMarkdownComponents(body: string, onBodyChange: (next: string) => void) {
  return {
    // remark-gfm marks task-list <li> nodes with a boolean `checked` on the
    // mdast node (not just a prop on the injected <input>), so we read it
    // off `node` directly and build our own row instead of relying on the
    // default injected checkbox.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li: ({ node, children, ...props }: any) => {
      if (typeof node?.checked === 'boolean') {
        const lineNum = node.position?.start?.line
        return (
          <li className="flex items-start gap-2 list-none -ml-5 my-1" {...props}>
            <button
              type="button"
              onClick={() => lineNum && onBodyChange(toggleChecklistLine(body, lineNum))}
              className={clsx(
                'mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors',
                node.checked ? 'bg-accent border-accent' : 'border-text-muted/60 hover:border-accent'
              )}
            >
              {node.checked && <Check size={10} className="text-white" strokeWidth={3} />}
            </button>
            <span className={node.checked ? 'line-through text-text-muted' : ''}>{children}</span>
          </li>
        )
      }
      return <li {...props}>{children}</li>
    },
    // Suppress remark-gfm's own disabled <input type="checkbox"> — the `li`
    // override above renders our own tappable checkbox in its place.
    input: () => null,
  }
}
