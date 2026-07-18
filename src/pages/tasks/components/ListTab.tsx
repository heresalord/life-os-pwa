import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useState, useEffect, useRef } from 'react'
import { useTasksQuery } from '../../../hooks/useTasksQuery'
import { useTaskMutations } from '../../../hooks/useTaskMutations'
import { useAppStore } from '../../../store/useAppStore'
import { useScrollToHighlight } from '../../../hooks/useScrollToHighlight'
import { TaskItem } from '../../../components/tasks/TaskItem'
import { EmptyState } from '../../../components/EmptyState'
import { TaskListSkeleton } from '../../../components/Skeleton'
import { useTranslation } from '../../../i18n'
import { CheckSquare } from 'lucide-react'
import type { Task } from '../../../db/schema'
import { haptic } from '../../../lib/haptic'

interface Subtask { id: string; title: string; completed: boolean }

export function ListTab({ highlightId }: { highlightId?: string | null } = {}) {
  const { t } = useTranslation()
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useTasksQuery(selectedDate)
  const { updateTask, deleteTask } = useTaskMutations(selectedDate)
  const [pendingOrder, setPendingOrder] = useState<Task[]>([])

  // Deletion undo queue
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useScrollToHighlight(highlightId, !isLoading)

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])

  const filteredTasks = tasks.filter((t: Task) => t.id !== deletingTaskId)
  const completed = filteredTasks.filter((t: Task) => t.completed)
  const skipped   = filteredTasks.filter((t: Task) => t.skipped)
  const pending   = filteredTasks.filter((t: Task) => !t.completed && !t.skipped)

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
  }, [tasks, deletingTaskId])

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

  const handleDelete = (id: string) => {
    if (deletingTaskId) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      deleteTask.mutate(deletingTaskId)
    }
    setDeletingTaskId(id)
    haptic('medium')
    deleteTimeoutRef.current = setTimeout(() => {
      deleteTask.mutate(id)
      setDeletingTaskId(null)
    }, 3000)
  }

  const handleUndoDelete = () => {
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current)
      deleteTimeoutRef.current = null
    }
    setDeletingTaskId(null)
    haptic('light')
  }

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
      {isLoading ? (
        <TaskListSkeleton count={4} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={40} />}
          title={t('tasks.no_tasks', 'No tasks yet')}
          message={t('tasks.add_first_task', 'Add your first task for today.')}
        />
      ) : (
        <div className="space-y-6">
          {pendingOrder.length > 0 && (
            <section className="bg-surface-2/30 border border-border/40 rounded-2xl p-4 space-y-3 shadow-[var(--shadow-card)]">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-0.5 flex items-center gap-2 mb-1">
                {t('tasks.pending', 'Pending')}
                <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text-muted text-[10px] font-bold">
                  {pendingOrder.length}
                </span>
              </h2>
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
            <section className="bg-success/5 border border-success/15 rounded-2xl p-4 space-y-3 shadow-[var(--shadow-card)]">
              <h2 className="text-xs font-semibold text-success/80 uppercase tracking-wider pl-0.5 flex items-center gap-2 mb-1">
                {t('tasks.completed', 'Completed')}
                <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold">
                  {completed.length}
                </span>
              </h2>
              <div className="space-y-2 opacity-60">{completed.map((t: Task) => renderTask(t))}</div>
            </section>
          )}

          {skipped.length > 0 && (
            <section className="bg-surface-2/20 border border-border/20 rounded-2xl p-4 space-y-3 shadow-[var(--shadow-card)]">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider pl-0.5 flex items-center gap-2 mb-1">
                {t('tasks.skipped', 'Skipped')}
                <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text-muted text-[10px] font-bold">
                  {skipped.length}
                </span>
              </h2>
              <div className="space-y-2 opacity-35">{skipped.map((t: Task) => (
                <div key={t.id} className="border-l-2 border-dashed border-text-muted rounded-xl">
                  {renderTask(t)}
                </div>
              ))}</div>
            </section>
          )}
        </div>
      )}

      {/* Undo Delete Toast notification */}
      {deletingTaskId && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-surface border border-border rounded-xl shadow-modal animate-in slide-in-from-bottom-2 duration-200">
          <span className="text-xs text-text">Task deleted</span>
          <button
            onClick={handleUndoDelete}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
