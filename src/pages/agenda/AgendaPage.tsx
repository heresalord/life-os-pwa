import { useMemo, useState, useEffect } from 'react'
import { useAgendaQuery } from '../../hooks/useAgendaQuery'
import { useAgendaMutations } from '../../hooks/useAgendaMutations'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useAppStore } from '../../store/useAppStore'
import { useNowMinutes } from '../../hooks/useNowMinutes'
import { AgendaBlock } from '../../components/agenda/AgendaBlock'
import { AgendaTaskBlock } from '../../components/agenda/AgendaTaskBlock'
import { AddBlockModal } from '../../components/agenda/AddBlockModal'
import { EmptyState } from '../../components/EmptyState'
import { CalendarDays, Clock, Play } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType, Task } from '../../db/schema'
import { PageSkeleton } from '../../components/Skeleton'
import clsx from 'clsx'


type UnifiedScheduledItem =
  | { type: 'block'; id: string; time: string; item: AgendaBlockType }
  | { type: 'task'; id: string; time: string; item: Task }

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function AgendaPage() {
  const { selectedDate, headerAddTrigger } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const nowMins = useNowMinutes()

  useEffect(() => {
    if (headerAddTrigger > 0) setAddOpen(true)
  }, [headerAddTrigger])

  // Queries
  const { data: blocks = [], isLoading: blocksLoading } = useAgendaQuery(selectedDate)
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery(selectedDate)

  // Mutations
  const { deleteBlock } = useAgendaMutations(selectedDate)
  const { deleteTask } = useTaskMutations(selectedDate)

  // Filter and merge items
  const allDayBlocks = useMemo(() => blocks.filter(b => b.all_day), [blocks])
  const allDayTasks = useMemo(() => tasks.filter(t => !t.time_block_start), [tasks])

  const scheduledItems = useMemo(() => {
    const items: UnifiedScheduledItem[] = []

    blocks.forEach(b => {
      if (!b.all_day && b.start_time) {
        items.push({ type: 'block', id: b.id, time: b.start_time, item: b })
      }
    })

    tasks.forEach(t => {
      if (t.time_block_start) {
        items.push({ type: 'task', id: t.id, time: t.time_block_start, item: t })
      }
    })

    // Sort chronologically by start time
    return items.sort((a, b) => a.time.localeCompare(b.time))
  }, [blocks, tasks])

  const handleDeleteBlock = (id: string) => {
    if (window.confirm('Delete this time block?')) {
      deleteBlock.mutate(id)
    }
  }

  const handleDeleteTask = (id: string) => {
    if (window.confirm('Delete this task?')) {
      deleteTask.mutate(id)
    }
  }

  const isItemActive = (item: UnifiedScheduledItem) => {
    if (item.type === 'block') {
      const start = toMins(item.item.start_time)
      const end = toMins(item.item.end_time)
      return nowMins >= start && nowMins < end
    } else {
      const start = toMins(item.item.time_block_start!)
      const end = item.item.time_block_end ? toMins(item.item.time_block_end) : start + 30
      return !item.item.completed && nowMins >= start && nowMins < end
    }
  }

  const isLoading = blocksLoading || tasksLoading
  const totalItemsCount = allDayBlocks.length + allDayTasks.length + scheduledItems.length

  return (
    <div className="space-y-6 lg:max-w-3xl pb-10">
      <header>
        <h1 className="text-2xl font-display text-text font-bold">Agenda</h1>
        <p className="text-xs text-text-muted mt-0.5">Plan and execute your day side-by-side</p>
      </header>

      <AddBlockModal date={selectedDate} open={addOpen} onOpenChange={setAddOpen} />

      {isLoading ? (
        <PageSkeleton />
      ) : totalItemsCount === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No blocks or tasks scheduled"
          message="Create all-day blocks, schedule time-blocked tasks, or plan standard blocks to get started."
        />
      ) : (
        <div className="space-y-6">
          {/* All Day Section */}
          {(allDayBlocks.length > 0 || allDayTasks.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                <Clock size={13} className="text-accent" /> All-Day Schedule
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allDayBlocks.map(b => (
                  <AgendaBlock
                    key={b.id}
                    block={b}
                    onDelete={handleDeleteBlock}
                  />
                ))}
                {allDayTasks.map(t => (
                  <AgendaTaskBlock
                    key={t.id}
                    task={t}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timeline Section */}
          {scheduledItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                <Play size={12} className="text-accent fill-accent/20" /> Daily Timeline
              </h3>

              <div className="relative pl-6 space-y-4">
                {/* Vertical connecting line */}
                <div className="absolute left-[9px] top-2.5 bottom-2.5 w-[2px] bg-border" />

                {scheduledItems.map(item => {
                  const active = isItemActive(item)
                  return (
                    <div key={item.id} className="relative flex items-stretch gap-4 group">
                      {/* Timeline Node dot */}
                      <div className={clsx(
                        'absolute left-[-22px] top-4 w-4 h-4 rounded-full border-2 bg-bg z-10 flex items-center justify-center transition-all',
                        active
                          ? 'border-accent bg-accent/15 scale-110 shadow-sm shadow-accent/20'
                          : 'border-border'
                      )}>
                        {active && (
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {item.type === 'block' ? (
                          <AgendaBlock
                            block={item.item as AgendaBlockType}
                            onDelete={handleDeleteBlock}
                          />
                        ) : (
                          <AgendaTaskBlock
                            task={item.item}
                            onDelete={handleDeleteTask}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
