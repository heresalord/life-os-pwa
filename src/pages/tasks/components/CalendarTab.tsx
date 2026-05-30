import { EmptyState } from '../../../components/EmptyState'
import { Calendar } from 'lucide-react'

export function CalendarTab() {
  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 flex items-center justify-center">
        <EmptyState icon={<Calendar size={40} />} title="Calendar View" message="Monthly and weekly task views coming soon." />
      </div>
    </div>
  )
}
