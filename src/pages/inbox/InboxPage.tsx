
import { useInboxQuery } from '../../hooks/useInboxQuery'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { InboxItemCard } from '../../components/inbox/InboxItemCard'
import { EmptyState } from '../../components/EmptyState'
import { Inbox } from 'lucide-react'

export function InboxPage() {
  const { data: items = [], isLoading } = useInboxQuery(false)
  const { deleteItem } = useInboxMutations()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Inbox</h1>
        <p className="text-sm text-text-secondary mt-1">Process captured thoughts and ideas.</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={40} />}
          title="Inbox is clear"
          message="Capture thoughts using the + button below. They'll appear here to process."
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <InboxItemCard key={item.id} item={item as any} onDelete={(id) => deleteItem.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
