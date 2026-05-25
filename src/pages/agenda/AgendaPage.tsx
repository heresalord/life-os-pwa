
import { useAgendaQuery } from '../../hooks/useAgendaQuery'
import { useAgendaMutations } from '../../hooks/useAgendaMutations'
import { useAppStore } from '../../store/useAppStore'
import { AgendaBlock } from '../../components/agenda/AgendaBlock'
import { AddBlockModal } from '../../components/agenda/AddBlockModal'
import { EmptyState } from '../../components/EmptyState'
import { CalendarDays } from 'lucide-react'

export function AgendaPage() {
  const { selectedDate } = useAppStore()
  const { data: blocks = [], isLoading } = useAgendaQuery(selectedDate)
  const { deleteBlock } = useAgendaMutations(selectedDate)

  // Sort blocks chronologically
  const sortedBlocks = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Agenda</h1>
      </header>

      <AddBlockModal date={selectedDate} />

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : sortedBlocks.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No blocks scheduled"
          message="Plan your day in time blocks to stay focused."
        />
      ) : (
        <div className="space-y-3">
          {sortedBlocks.map(b => (
            <AgendaBlock key={b.id} block={b as any} onDelete={(id) => deleteBlock.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
