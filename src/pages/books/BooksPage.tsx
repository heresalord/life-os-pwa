import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { BookOpen } from 'lucide-react'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { BookItem } from '../../components/books/BookItem'
import { AddBookModal } from '../../components/books/AddBookModal'
import { EmptyState } from '../../components/EmptyState'

type TabStatus = 'reading' | 'to-read' | 'finished' | 'abandoned'

const TABS: { value: TabStatus; label: string }[] = [
  { value: 'reading',   label: 'Reading'   },
  { value: 'to-read',   label: 'To Read'   },
  { value: 'finished',  label: 'Finished'  },
  { value: 'abandoned', label: 'Abandoned' },
]

const EMPTY_MESSAGES: Record<TabStatus, string> = {
  'reading':   'No books in progress. Start one!',
  'to-read':   'Your reading list is empty.',
  'finished':  'No finished books yet.',
  'abandoned': 'Nothing abandoned — nice.',
}

export function BooksPage() {
  const [tab, setTab] = useState<TabStatus>('reading')
  const { data: allBooks = [], isLoading } = useBooksQuery()
  const { deleteBook } = useBookMutations()

  const filtered = allBooks.filter(b => b.status === tab)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-display text-text">Library</h1>
        <p className="text-sm text-text-secondary mt-1">{allBooks.length} book{allBooks.length !== 1 ? 's' : ''} total</p>
      </header>

      <Tabs.Root value={tab} onValueChange={v => setTab(v as TabStatus)}>
        <Tabs.List className="flex bg-surface-2 p-1 rounded-xl mb-4 gap-1 overflow-x-auto">
          {TABS.map(t => (
            <Tabs.Trigger key={t.value} value={t.value}
              className="flex-1 min-w-fit py-1.5 px-2 text-xs font-medium rounded-lg whitespace-nowrap text-text-muted data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all">
              {t.label}
              {allBooks.filter(b => b.status === t.value).length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {allBooks.filter(b => b.status === t.value).length}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <AddBookModal defaultStatus={tab === 'finished' || tab === 'abandoned' ? 'to-read' : tab} />

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={40} />}
              title="No books here"
              message={EMPTY_MESSAGES[tab]}
            />
          ) : (
            filtered.map(b => (
              <BookItem
                key={b.id}
                book={b as Parameters<typeof BookItem>[0]['book']}
                onDelete={id => deleteBook.mutate(id)}
              />
            ))
          )}
        </div>
      </Tabs.Root>
    </div>
  )
}
