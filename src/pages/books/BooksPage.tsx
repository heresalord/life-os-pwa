
import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { BookOpen } from 'lucide-react'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { BookItem } from '../../components/books/BookItem'
import { AddBookModal } from '../../components/books/AddBookModal'
import { EmptyState } from '../../components/EmptyState'

export function BooksPage() {
  const [tab, setTab] = useState('reading')
  const { data: books = [], isLoading } = useBooksQuery()
  const { deleteBook } = useBookMutations()

  const filtered = books.filter(b => b.status === tab)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Library</h1>
      </header>

      <Tabs.Root value={tab} onValueChange={setTab} className="w-full">
        <Tabs.List className="flex bg-surface-2 p-1 rounded-xl mb-4">
          <Tabs.Trigger value="reading" className="flex-1 py-1.5 text-sm font-medium rounded-lg text-text-muted data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all">Reading</Tabs.Trigger>
          <Tabs.Trigger value="want_to_read" className="flex-1 py-1.5 text-sm font-medium rounded-lg text-text-muted data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all">To Read</Tabs.Trigger>
          <Tabs.Trigger value="completed" className="flex-1 py-1.5 text-sm font-medium rounded-lg text-text-muted data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all">Completed</Tabs.Trigger>
        </Tabs.List>

        <AddBookModal defaultStatus={tab} />

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={40} />}
              title="No books here"
              message={`You have no books marked as ${tab.replace('_', ' ')}.`}
            />
          ) : (
            filtered.map(b => (
              <BookItem key={b.id} book={b as any} onDelete={(id) => deleteBook.mutate(id)} />
            ))
          )}
        </div>
      </Tabs.Root>
    </div>
  )
}
