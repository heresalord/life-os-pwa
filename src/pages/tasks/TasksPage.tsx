import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useState, useEffect } from 'react'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useAppStore } from '../../store/useAppStore'
import { TaskItem } from '../../components/tasks/TaskItem'
import { TaskHistory } from '../../components/tasks/TaskHistory'
import { AddTaskModal } from '../../components/tasks/AddTaskModal'
import { EmptyState } from '../../components/EmptyState'
import { CheckSquare, History } from 'lucide-react'
import type { Task } from '../../db/schema'

type Tab = 'today' | 'history'

export function TasksPage() {
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useTasksQuery(selectedDate)
  const { updateTask, deleteTask } = useTaskMutations(selectedDate)
  const [tab, setTab] = useState<Tab>('today')
  const [pendingOrder, setPendingOrder] = useState<Task[]>([])

  const completed = tasks.filter(t => t.completed)
  const skipped   = tasks.filter(t => t.skipped)
  const pending   = tasks.filter(t => !t.completed && !t.skipped)

  useEffect(() => {
    setPendingOrder(prev => {
      if (prev.length === 0) return pending
      const ids     = new Set(pending.map(t => t.id))
      const prevIds = new Set(prev.map(t => t.id))
      const merged  = prev.filter(t => ids.has(t.id))
      pending.forEach(t => { if (!prevIds.has(t.id)) merged.push(t) })
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
  const handleEdit   = (id: string, newTitle: string) =>
    updateTask.mutate({ id, updates: { title: newTitle } })

  const renderTask = (t: Task, draggableProps?: Parameters<typeof TaskItem>[0]['dragHandleProps']) => (
    <TaskItem
      task={t as Parameters<typeof TaskItem>[0]['task']}
      dragHandleProps={draggableProps}
      onToggleComplete={handleToggleComplete}
      onToggleSkip={handleToggleSkip}
      onDelete={handleDelete}
      onEdit={handleEdit}
    />
  )

  // ── Today's task list — shared between mobile tab and desktop left pane ──
  const todayContent = (
    <>
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
              <div className="space-y-2 opacity-70">{completed.map(t => renderTask(t))}</div>
            </section>
          )}

          {skipped.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Skipped</h2>
              <div className="space-y-2 opacity-50">{skipped.map(t => renderTask(t))}</div>
            </section>
          )}
        </div>
      )}
    </>
  )

  return (
    // ── Desktop: master-detail split [task list | history panel] ──
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start lg:max-w-5xl">

      {/* ── Left / main: today's tasks ── */}
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-display text-text">Tasks</h1>
        </header>

        {/* Tab bar — mobile/tablet only; desktop always shows today */}
        <div className="flex p-1 bg-surface-2 border border-border rounded-xl lg:hidden">
          <button onClick={() => setTab('today')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'today' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>
            <CheckSquare size={15} /> Today
          </button>
          <button onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'history' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>
            <History size={15} /> History
          </button>
        </div>

        {/* Mobile: tab-driven content */}
        <div className="lg:hidden">
          {tab === 'history' ? <TaskHistory /> : todayContent}
        </div>

        {/* Desktop: always show today's tasks */}
        <div className="hidden lg:block">
          {todayContent}
        </div>
      </div>

      {/* ── Right / history panel — desktop only ── */}
      <div className="hidden lg:block sticky top-20">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={15} className="text-text-muted" />
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">History</h2>
          </div>
          <TaskHistory />
        </div>
      </div>
    </div>
  )
}
