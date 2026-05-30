import { EmptyState } from '../../../components/EmptyState'
import { Clock } from 'lucide-react'

export function TimeBlocksTab() {
  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 flex items-center justify-center">
        <EmptyState icon={<Clock size={40} />} title="Time Blocking" message="Drag and drop tasks onto a daily schedule coming soon." />
      </div>
    </div>
  )
}
