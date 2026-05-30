import { EmptyState } from '../../../components/EmptyState'
import { LayoutGrid } from 'lucide-react'

export function KanbanTab() {
  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 flex items-center justify-center">
        <EmptyState icon={<LayoutGrid size={40} />} title="Kanban Board" message="Visual task management coming soon." />
      </div>
    </div>
  )
}
