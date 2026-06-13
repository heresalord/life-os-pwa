import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useState, useEffect } from 'react'
import { useTasksQuery } from '../../../hooks/useTasksQuery'
import { useTaskMutations } from '../../../hooks/useTaskMutations'
import { useAppStore } from '../../../store/useAppStore'
import { useScrollToHighlight } from '../../../hooks/useScrollToHighlight'
import { TaskItem } from '../../../components/tasks/TaskItem'
import { AddTaskModal } from '../../../components/tasks/AddTaskModal'
import { EmptyState } from '../../../components/EmptyState'
import { CheckSquare } from 'lucide-react'
import type { Task } from '../../../db/schema'

interface Subtask { id: string; title: string; completed: boolean }

export function ListTab({ highlightId }: { highlightId?: string | null } = {}) {
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useTasksQuery(selectedDate)
  const { updateTask, deleteTask } = useTaskMutations(selectedDate)
  const [pendingOrder, setPendingOrder] = useState<Task[]>([])

  useScrollToHighlight(highlightId, !isLoading)

  const completed = tasks.filter((t: Task) => t.completed)
  const skipped   = tasks.filter((t: Task) => t.skipped)
  const pending   = tasks.filter((t: Task) => !t.completed && !t.skipped)

  useEffect(() => {
    setPendingOrder(prev => {
      if (prev.length === 0) return pending
      const ids     = new Set(pending.map((t: Task) => t.id))
      const prevIds = new Set(prev.map(t => t.id))
      const merged  = prev.filter(t => ids.has(t.id))
      pending.forEach((t: Task) => { if (!prevIds.has(t.id)) merged.push(t) })
      return merged
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(pendingOrder)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setPendingOrder(items)
  }

  const handleToggleComplete = (id: string, current: boolean) =>
    updateTask.mutate({ id, updates: { completed: !current, skipped: false, completed_at: !current ? new Date().toISOString() : null } })

  const handleToggleSkip = (id: string, current: boolean) =>
    updateTask.mutate({ id, updates: { skipped: !current, completed: false, skipped_at: !current ? new Date().toISOString() : null } })

  const handleDelete = (id: string) => deleteTask.mutate(id)

  const handleEdit = (id: string, newTitle: string) =>
    updateTask.mutate({ id, updates: { title: newTitle } })

  const handleUpdateSubtasks = (id: string, subtasks: Subtask[]) =>
    updateTask.mutate({ id, updates: { subtasks } })

  const renderTask = (t: Task, dragHandleProps?: Parameters<typeof TaskItem>[0]['dragHandleProps']) => (
    <div data-item-id={t.id} className="rounded-xl">
      <TaskItem
        key={t.id}
        task={t as Parameters<typeof TaskItem>[0]['task']}
        dragHandleProps={dragHandleProps}
        onToggleComplete={handleToggleComplete}
        onToggleSkip={handleToggleSkip}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onUpdateSubtasks={handleUpdateSubtasks}
      />
    </div>
  )

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <AddTaskModal date={selectedDate} />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<CheckSquare size={40} />} title="No tasks yet" message="Add your first task for today." />
      ) : (
        <div className="space-y-6">
          {pendingOrder.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Pending</h2>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="pending-tasks">
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className={snapshot.isDraggingOver ? 'space-y-2 rounded-xl bg-accent/5 p-1 -m-1 transition-colors' : 'space-y-2'}>
                      {pendingOrder.map((t, index) => (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(prov, snap) => (
                            <div ref={prov.innerRef} {...prov.draggableProps}
                              style={{ ...prov.draggableProps.style, opacity: snap.isDragging ? 0.85 : 1 }}
                              className={snap.isDragging ? 'shadow-lg shadow-black/30 rounded-xl' : ''}>
                              {renderTask(t, prov.dragHandleProps)}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Completed</h2>
              <div className="space-y-2 opacity-70">{completed.map((t: Task) => renderTask(t))}</div>
            </section>
          )}

          {skipped.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Skipped</h2>
              <div className="space-y-2 opacity-50">{skipped.map((t: Task) => renderTask(t))}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
