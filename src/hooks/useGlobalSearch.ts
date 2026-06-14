
import { useState, useEffect } from 'react'
import { db } from '../db'
import { useAuth } from './useAuth'

export type SearchResult = {
  id: string
  type: 'task' | 'note' | 'inbox' | 'book'
  title: string
  subtitle?: string
  date?: string
  path: string
}

export function useGlobalSearch(query: string) {
  const { user } = useAuth()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setResults([])
      return
    }

    let isMounted = true
    const search = async () => {
      setLoading(true)
      const q = query.toLowerCase().trim()

      try {
        const [tasks, notes, inbox, books] = await Promise.all([
          db.tasks.filter(t => t.user_id === user.id && t.title.toLowerCase().includes(q)).toArray(),
          db.notes.filter(n => n.user_id === user.id && (n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))).toArray(),
          db.inbox_items.filter(i => i.user_id === user.id && i.text.toLowerCase().includes(q)).toArray(),
          db.books.filter(b => b.user_id === user.id && (b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q))).toArray()
        ])

        if (!isMounted) return

        const formatted: SearchResult[] = [
          ...tasks.map(t => ({ id: t.id, type: 'task' as const, title: t.title, subtitle: t.completed ? 'Completed' : 'Pending', date: t.date, path: `/tasks?date=${t.date}&highlight=${t.id}` })),
          ...notes.map(n => ({ id: n.id, type: 'note' as const, title: n.title, subtitle: `Note · ${n.date}`, date: n.date, path: `/notes?highlight=${n.id}` })),
          ...inbox.map(i => ({ id: i.id, type: 'inbox' as const, title: i.text, subtitle: `Inbox · ${i.processed ? 'Processed' : 'Pending'}`, path: `/inbox?highlight=${i.id}` })),
          ...books.map(b => ({ id: b.id, type: 'book' as const, title: b.title, subtitle: b.author || 'Book', path: `/books/${b.id}` }))
        ]

        setResults(formatted)
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    const timer = setTimeout(search, 300) // 300ms debounce
    return () => { isMounted = false; clearTimeout(timer) }
  }, [query, user])

  return { results, loading }
}
