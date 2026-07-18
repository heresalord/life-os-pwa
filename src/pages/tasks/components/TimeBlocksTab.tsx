import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useAgendaQuery } from '../../../hooks/useAgendaQuery'
import { useAgendaMutations } from '../../../hooks/useAgendaMutations'
import { useTasksQuery } from '../../../hooks/useTasksQuery'
import { useAppStore } from '../../../store/useAppStore'
import { AgendaBlock } from '../../../components/agenda/AgendaBlock'
import { AddBlockModal } from '../../../components/agenda/AddBlockModal'
import { EmptyState } from '../../../components/EmptyState'
import { Clock, CalendarDays } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType } from '../../../db/schema'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToPosition(minutes: number, startHour = 6) {
  return ((minutes - startHour * 60) / (18 * 60)) * 100
}

function blockHeightPct(start: string, end: string) {
  const diff = timeToMinutes(end) - timeToMinutes(start)
  return Math.max((diff / (18 * 60)) * 100, 2)
}

export function TimeBlocksTab() {
  const { selectedDate } = useAppStore()
  const { data: blocks = [], isLoading } = useAgendaQuery(selectedDate)
  const { deleteBlock } = useAgendaMutations(selectedDate)
  const { data: tasks = [] } = useTasksQuery(selectedDate)

  const [orderedBlocks, setOrderedBlocks] = useState<AgendaBlockType[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  useEffect(() => {
    setOrderedBlocks([...blocks].sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_time.localeCompare(b.start_time)
    }))
  }, [blocks])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(orderedBlocks)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setOrderedBlocks(items)
  }

  const scheduledTasks   = tasks.filter(t => t.time_block_start && !t.completed && !t.skipped)
  const unscheduledTasks = tasks.filter(t => !t.time_block_start && !t.completed && !t.skipped)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <div className="flex p-1 bg-surface-2 border border-border rounded-lg">
          <button onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>
            List
          </button>
          <button onClick={() => setViewMode('timeline')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>
            Timeline
          </button>
        </div>
        <div className="flex-1">
          <AddBlockModal date={selectedDate} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : viewMode === 'list' ? (
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Time Blocks</h3>
            {orderedBlocks.length === 0 ? (
              <EmptyState icon={<Clock size={36} />} title="No time blocks" message="Add blocks to structure your day." />
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="time-blocks">
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className={snapshot.isDraggingOver ? 'space-y-2 rounded-xl bg-accent/5 p-1 -m-1' : 'space-y-2'}>
                      {orderedBlocks.map((b, i) => (
                        <Draggable key={b.id} draggableId={b.id} index={i}>
                          {(prov, snap) => (
                            <div ref={prov.innerRef} {...prov.draggableProps}
                              style={{ ...prov.draggableProps.style, opacity: snap.isDragging ? 0.85 : 1 }}
                              className={snap.isDragging ? 'shadow-lg shadow-black/30 rounded-xl' : ''}>
                              <AgendaBlock
                                block={b as Parameters<typeof AgendaBlock>[0]['block']}
                                dragHandleProps={prov.dragHandleProps}
                                onDelete={(id) => deleteBlock.mutate(id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {unscheduledTasks.length > 0 && (
            <div className="mt-6 lg:mt-0 space-y-3">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Unscheduled <span className="text-text-muted/60">({unscheduledTasks.length})</span>
              </h3>
              <div className="space-y-2">
                {unscheduledTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-xl text-sm">
                    <div className="w-2 h-2 rounded-full bg-text-muted/30 flex-shrink-0" />
                    <span className="text-text-secondary flex-1 truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-start"
                style={{ top: `${((h - 6) / 18) * 100}%` }}>
                <span className="text-[10px] text-text-muted w-10 flex-shrink-0 -mt-2 pr-2 text-right">{h}:00</span>
                <div className="flex-1 border-t border-border/40" />
              </div>
            ))}

            {/* Current time indicator */}
            {(() => {
              const now = new Date()
              const nowMin = now.getHours() * 60 + now.getMinutes()
              if (nowMin < 6 * 60 || nowMin > 24 * 60) return null
              return (
                <div className="absolute left-10 right-0 flex items-center z-10"
                  style={{ top: `${minutesToPosition(nowMin)}%` }}>
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 -ml-1" />
                  <div className="flex-1 border-t-2 border-accent border-dashed opacity-60" />
                </div>
              )
            })()}

            {orderedBlocks.filter(b => !b.all_day).map(b => (
              <div key={b.id}
                className="absolute left-10 right-1 bg-accent/20 border border-accent/40 rounded-lg px-2 py-1 overflow-hidden z-10"
                style={{ top: `${minutesToPosition(timeToMinutes(b.start_time))}%`, height: `${blockHeightPct(b.start_time, b.end_time)}%` }}>
                <p className="text-xs font-medium text-accent leading-tight truncate">{b.description}</p>
                <p className="text-[10px] text-accent/70">{b.start_time} – {b.end_time}</p>
              </div>
            ))}

            {scheduledTasks.map(t => {
              if (!t.time_block_start) return null
              return (
                <div key={t.id}
                  className="absolute left-10 right-1 bg-info/20 border border-info/40 rounded-lg px-2 py-1 overflow-hidden z-10"
                  style={{ top: `${minutesToPosition(timeToMinutes(t.time_block_start))}%`, height: `${t.time_block_end ? blockHeightPct(t.time_block_start, t.time_block_end) : 3}%` }}>
                  <p className="text-xs font-medium text-info leading-tight truncate">{t.title}</p>
                </div>
              )
            })}

            {orderedBlocks.length === 0 && scheduledTasks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <CalendarDays size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">No blocks scheduled</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
