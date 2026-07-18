import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '../../db/DbContext'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Search, CheckSquare, DollarSign, Target, BookOpen, FileText, Inbox, X } from 'lucide-react'
import { displayDate } from '../../lib/dateUtils'

type Module = 'all' | 'tasks' | 'transactions' | 'goals' | 'notes' | 'books' | 'inbox'

interface Result {
  id: string
  module: Module
  title: string
  subtitle?: string
  date?: string
  url: string
}

function useAllData() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: ['search_corpus', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const [tasks, txns, goals, notes, books, inbox] = await Promise.all([
          supabase.from('tasks').select('id,title,date,completed').eq('user_id', user!.id),
          supabase.from('transactions').select('id,description,category,date,type,amount').eq('user_id', user!.id),
          supabase.from('goals').select('id,name,state').eq('user_id', user!.id),
          supabase.from('notes').select('id,title,content,date').eq('user_id', user!.id),
          supabase.from('books').select('id,title,author,status').eq('user_id', user!.id),
          supabase.from('inbox_items').select('id,text,type,processed').eq('user_id', user!.id),
        ])
        return {
          tasks:    tasks.data    ?? [],
          txns:     txns.data     ?? [],
          goals:    goals.data    ?? [],
          notes:    notes.data    ?? [],
          books:    books.data    ?? [],
          inbox:    inbox.data    ?? [],
        }
      }
      return {
        tasks: await db.tasks.toArray(),
        txns:  await db.transactions.toArray(),
        goals: await db.goals.toArray(),
        notes: await db.notes.toArray(),
        books: await db.books.toArray(),
        inbox: await db.inbox_items.toArray(),
      }
    }
  })
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  tasks:        <CheckSquare size={14} />,
  transactions: <DollarSign size={14} />,
  goals:        <Target size={14} />,
  notes:        <FileText size={14} />,
  books:        <BookOpen size={14} />,
  inbox:        <Inbox size={14} />,
}

const MODULE_COLORS: Record<string, string> = {
  tasks:        'text-accent bg-accent/10',
  transactions: 'text-success bg-success/10',
  goals:        'text-info bg-info/10',
  notes:        'text-warning bg-warning/10',
  books:        'text-text-secondary bg-surface-2',
  inbox:        'text-text-muted bg-surface-2',
}

const MODULES: { value: Module; label: string }[] = [
  { value: 'all',          label: 'All'       },
  { value: 'tasks',        label: 'Tasks'     },
  { value: 'notes',        label: 'Notes'     },
  { value: 'goals',        label: 'Goals'     },
  { value: 'books',        label: 'Books'     },
  { value: 'transactions', label: 'Finance'   },
  { value: 'inbox',        label: 'Inbox'     },
]

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [module, setModule] = useState<Module>('all')
  const navigate = useNavigate()
  const { data } = useAllData()

  const results = useMemo((): Result[] => {
    const q = query.toLowerCase().trim()
    if (!q || !data) return []

    const hits: Result[] = []
    const match = (str?: string | null) => str?.toLowerCase().includes(q)

    if (module === 'all' || module === 'tasks') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (data.tasks as any[])) {
        if (match(t.title)) {
          hits.push({ id: t.id, module: 'tasks', title: t.title,
            subtitle: t.completed ? 'Completed' : 'Pending', date: t.date,
            url: `/tasks?date=${t.date}&highlight=${t.id}` })
        }
      }
    }
    if (module === 'all' || module === 'notes') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const n of (data.notes as any[])) {
        if (match(n.title) || match(n.content)) {
          hits.push({ id: n.id, module: 'notes', title: n.title,
            subtitle: n.content?.slice(0, 60), date: n.date, url: `/notes?highlight=${n.id}` })
        }
      }
    }
    if (module === 'all' || module === 'goals') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const g of (data.goals as any[])) {
        if (match(g.name)) {
          hits.push({ id: g.id, module: 'goals', title: g.name,
            subtitle: g.state, url: `/goals/${g.id}` })
        }
      }
    }
    if (module === 'all' || module === 'books') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const b of (data.books as any[])) {
        if (match(b.title) || match(b.author)) {
          hits.push({ id: b.id, module: 'books', title: b.title,
            subtitle: b.author ?? b.status, url: `/books/${b.id}` })
        }
      }
    }
    if (module === 'all' || module === 'transactions') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (data.txns as any[])) {
        if (match(t.description) || match(t.category)) {
          hits.push({ id: t.id, module: 'transactions',
            title: t.description || t.category,
            subtitle: `${t.type === 'income' ? '+' : ''}${Number(t.amount).toFixed(2)} · ${t.category}`,
            date: t.date, url: `/finance?tab=transactions&date=${t.date}&highlight=${t.id}` })
        }
      }
    }
    if (module === 'all' || module === 'inbox') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const i of (data.inbox as any[])) {
        if (match(i.text)) {
          hits.push({ id: i.id, module: 'inbox', title: i.text,
            subtitle: i.processed ? 'Processed' : 'Pending', url: `/inbox?highlight=${i.id}` })
        }
      }
    }

    return hits.slice(0, 50)
  }, [query, module, data])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display text-text">Search</h1>

      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tasks, notes, goals, books…"
          className="selectable w-full bg-surface border border-border rounded-xl pl-11 pr-10 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Module filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {MODULES.map(m => (
          <button key={m.value} onClick={() => setModule(m.value)}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
              module === m.value
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-surface-2 border-border text-text-muted hover:text-text'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!query ? (
        <div className="py-12 text-center">
          <Search size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm text-text-muted">Type to search across all your data</p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-text-muted">No results for "{query}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-muted px-1">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map(r => (
            <button key={r.id} onClick={() => navigate(r.url)}
              className="w-full flex items-start gap-3 p-3 bg-surface border border-border rounded-xl hover:border-accent/30 hover:bg-accent/5 transition-all text-left">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${MODULE_COLORS[r.module]}`}>
                {MODULE_ICONS[r.module]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{r.title}</p>
                {r.subtitle && <p className="text-xs text-text-muted truncate mt-0.5">{r.subtitle}</p>}
                {r.date && <p className="text-[10px] text-text-muted mt-1">{displayDate(r.date)}</p>}
              </div>
              <span className="text-[10px] text-text-muted flex-shrink-0 capitalize mt-0.5">{r.module}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
