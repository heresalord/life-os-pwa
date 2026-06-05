import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useNoteMutations } from '../../hooks/useNoteMutations'

interface TemplatePickerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onNoteCreated: (id: string) => void
}

type TemplateKey = 'morning' | 'evening' | 'weekly-review' | 'gratitude' | 'book-notes' | 'meeting-notes' | null

interface TemplateDef {
  key: TemplateKey
  emoji: string
  label: string
  description: string
  folder: string
  content: string
}

const TEMPLATES: TemplateDef[] = [
  {
    key: 'morning',
    emoji: '☀️',
    label: 'Morning',
    description: 'Intention, gratitude & focus',
    folder: 'Journal',
    content: `## Morning Routine

**Today's intention:**
> 

**Three things I'm grateful for:**
1. 
2. 
3. 

**My top priority today:**
> 

**How do I want to feel today?**
> `,
  },
  {
    key: 'evening',
    emoji: '🌙',
    label: 'Evening',
    description: 'Reflection, wins & tomorrow',
    folder: 'Journal',
    content: `## Evening Reflection

**What went well today?**
> 

**What I'd do differently:**
> 

**My win of the day:**
> 

**Tomorrow's focus:**
> `,
  },
  {
    key: 'weekly-review',
    emoji: '📊',
    label: 'Weekly Review',
    description: 'Wins, challenges & next week',
    folder: 'Journal',
    content: `## Weekly Review — Week of 

**Top wins this week:**
- 

**Biggest challenges:**
- 

**What I learned:**
> 

**Focus areas for next week:**
1. 
2. 
3. `,
  },
  {
    key: 'gratitude',
    emoji: '🙏',
    label: 'Gratitude',
    description: 'Three gratitudes + a note',
    folder: 'Journal',
    content: `## Gratitude Journal

**Date:** 

**I am grateful for:**
1. 
2. 
3. 

**A moment that made me smile:**
> 

**Something I appreciate about myself:**
> `,
  },
  {
    key: 'book-notes',
    emoji: '📚',
    label: 'Book Notes',
    description: 'Title, author, key ideas & quotes',
    folder: 'All',
    content: `## Book Notes

**Title:**
**Author:**
**Date finished:**

---

### Summary
> 

### Key Ideas
- 
- 
- 

### Favourite Quotes
> 

### How I'll apply this
> `,
  },
  {
    key: 'meeting-notes',
    emoji: '🤝',
    label: 'Meeting Notes',
    description: 'Attendees, agenda & actions',
    folder: 'All',
    content: `## Meeting Notes

**Meeting:** 
**Date:** 
**Attendees:** 

---

### Agenda
1. 

### Notes
> 

### Action Items
- [ ] 
- [ ] 
`,
  },
  {
    key: null,
    emoji: '✏️',
    label: 'Blank',
    description: 'Start from scratch',
    folder: 'All',
    content: '',
  },
]

export function TemplatePicker({ open, onOpenChange, onNoteCreated }: TemplatePickerProps) {
  const { selectedDate } = useAppStore()
  const { addNote } = useNoteMutations()

  const pick = (tmpl: TemplateDef) => {
    addNote.mutate(
      {
        title: tmpl.key
          ? `${tmpl.label} — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : 'Untitled Note',
        content: tmpl.content,
        date: selectedDate,
        template: tmpl.key,
        folder: tmpl.folder,
      },
      {
        onSuccess: note => {
          if (!note) return
          onOpenChange(false)
          onNoteCreated(note.id)
        },
      }
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Dialog.Title className="text-base font-display text-text">New Note</Dialog.Title>
              <p className="text-xs text-text-muted mt-0.5">Pick a template to get started</p>
            </div>
            <Dialog.Close asChild>
              <button className="text-text-muted hover:text-text transition-colors">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TEMPLATES.map(tmpl => (
              <button
                key={tmpl.key ?? 'blank'}
                onClick={() => pick(tmpl)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-surface-2 hover:border-accent hover:bg-accent/5 transition-all text-left group"
              >
                <span className="text-2xl">{tmpl.emoji}</span>
                <div>
                  <div className="text-sm font-medium text-text group-hover:text-accent transition-colors">
                    {tmpl.label}
                  </div>
                  <div className="text-xs text-text-muted leading-snug mt-0.5">
                    {tmpl.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
