import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useAgendaQuery } from '../../hooks/useAgendaQuery'
import { useAgendaMutations } from '../../hooks/useAgendaMutations'
import { useAppStore } from '../../store/useAppStore'
import { AgendaBlock } from '../../components/agenda/AgendaBlock'
import { AddBlockModal } from '../../components/agenda/AddBlockModal'
import { EmptyState } from '../../components/EmptyState'
import { CalendarDays } from 'lucide-react'
import type { AgendaBlock as AgendaBlockType } from '../../db/schema'

export function AgendaPage() {
  const { selectedDate } = useAppStore()
  const { data: blocks = [], isLoading } = useAgendaQuery(selectedDate)
  const { deleteBlock } = useAgendaMutations(selectedDate)

  const [orderedBlocks, setOrderedBlocks] = useState<AgendaBlockType[]>([])

  useEffect(() => {
    const sorted = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))
    setOrderedBlocks(prev => {
      if (prev.length === 0) return sorted
      const ids = new Set(sorted.map(b => b.id))
      const prevIds = new Set(prev.map(b => b.id))
      const merged = prev.filter(b => ids.has(b.id))
      sorted.forEach(b => { if (!prevIds.has(b.id)) merged.push(b) })
      return merged
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(orderedBlocks)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setOrderedBlocks(items)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Agenda</h1>
      </header>

      <AddBlockModal date={selectedDate} />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : orderedBlocks.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No blocks scheduled"
          message="Plan your day in time blocks to stay focused."
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="agenda-blocks">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={snapshot.isDraggingOver
                  ? 'space-y-3 rounded-xl bg-accent/5 p-1 -m-1 transition-colors'
                  : 'space-y-3'}
              >
                {orderedBlocks.map((b, index) => (
                  <Draggable key={b.id} draggableId={b.id} index={index}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        style={{ ...prov.draggableProps.style, opacity: snap.isDragging ? 0.85 : 1 }}
                        className={snap.isDragging ? 'shadow-lg shadow-black/30 rounded-xl' : ''}
                      >
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
  )
}
