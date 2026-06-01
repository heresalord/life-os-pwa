import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useQuery } from '@tanstack/react-query'
import { useTaskMutations } from '../../../hooks/useTaskMutations'
import { useAuth } from '../../../hooks/useAuth'
import { useAppStore } from '../../../store/useAppStore'
import { AddTaskModal } from '../../../components/tasks/AddTaskModal'
import { supabase } from '../../../lib/supabase'
import { db } from '../../../db'
import { Check, X, Trash2, GripVertical } from 'lucide-react'
import type { Task } from '../../../db/schema'
import clsx from 'clsx'

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

const COLUMNS: { id: KanbanStatus; label: string; color: string }[] = [
  { id: 'backlog',     label: 'Backlog',     color: 'text-text-muted' },
  { id: 'todo',        label: 'To Do',       color: 'text-info' },
  { id: 'in_progress', label: 'In Progress', color: 'text-warning' },
  { id: 'done',        label: 'Done',        color: 'text-success' },
]

const PRIORITY_DOT: Record<number, string> = {
  1: 'bg-danger', 2: 'bg-warning', 3: 'bg-info', 4: 'bg-border',
}

function useAllTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'kanban', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('tasks').select('*')
          .eq('user_id', user!.id)
          .eq('completed', false)
          .eq('skipped', false)
          .order('created_at')
        if (error) throw error
        return (data ?? []) as Task[]
      }
      return db.tasks.where('completed').equals(0)
        .and(t => !t.skipped)
        .toArray() as unknown as Task[]
    },
  })
}

export function KanbanTab() {
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useAllTasks()
  const { updateTask, deleteTask } = useTaskMutations(selectedDate)
  const [columns, setColumns] = useState<Record<KanbanStatus, Task[]>>({
    backlog: [], todo: [], in_progress: [], done: [],
  })

  // Populate columns from tasks
  useEffect(() => {
    const map: Record<KanbanStatus, Task[]> = { backlog: [], todo: [], in_progress: [], done: [] }
    for (const t of tasks) {
      const status = (t.kanban_status as KanbanStatus) || 'todo'
      map[status].push(t)
    }
    setColumns(map)
  }, [tasks])

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const srcCol  = source.droppableId as KanbanStatus
    const dstCol  = destination.droppableId as KanbanStatus
    const srcItems = [...columns[srcCol]]
    const dstItems = srcCol === dstCol ? srcItems : [...columns[dstCol]]

    const [moved] = srcItems.splice(source.index, 1)
    dstItems.splice(destination.index, 0, moved)

    setColumns(prev => ({
      ...prev,
      [srcCol]: srcCol === dstCol ? dstItems : srcItems,
      [dstCol]: dstItems,
    }))

    if (srcCol !== dstCol) {
      updateTask.mutate({ id: draggableId, updates: { kanban_status: dstCol } })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
  }

  return (
    <div className="animate-in fade-in duration-200">
      {/* Add task to backlog */}
      <div className="mb-4">
        <AddTaskModal date={selectedDate} defaultKanbanStatus="backlog" />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map(col => (
            <div key={col.id} className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden">
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className={clsx('text-xs font-semibold uppercase tracking-wider', col.color)}>
                  {col.label}
                </span>
                <span className="text-xs text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
                  {columns[col.id].length}
                </span>
              </div>

              {/* Cards */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={clsx(
                      'flex-1 p-2 space-y-2 min-h-[120px] transition-colors',
                      snapshot.isDraggingOver && 'bg-accent/5'
                    )}
                  >
                    {columns[col.id].map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            style={{ ...prov.draggableProps.style }}
                            className={clsx(
                              'bg-bg border border-border rounded-xl p-2.5 text-sm group',
                              snap.isDragging && 'shadow-lg shadow-black/30 rotate-1'
                            )}
                          >
                            {/* Drag handle + title */}
                            <div className="flex items-start gap-1.5">
                              <div {...prov.dragHandleProps} className="text-text-muted cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5 touch-none">
                                <GripVertical size={14} />
                              </div>
                              <p className="text-sm text-text leading-snug flex-1 min-w-0 break-words">
                                {task.title}
                              </p>
                            </div>

                            {/* Meta */}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1.5">
                                {task.priority && (
                                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority] ?? 'bg-border')} title={`P${task.priority}`} />
                                )}
                                {task.due_date && (
                                  <span className="text-[10px] text-text-muted">{task.due_date}</span>
                                )}
                              </div>
                              {/* Quick actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => updateTask.mutate({ id: task.id, updates: { completed: true, completed_at: new Date().toISOString() } })}
                                  className="p-1 text-text-muted hover:text-success rounded transition-colors"
                                  title="Mark done"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => updateTask.mutate({ id: task.id, updates: { skipped: true, skipped_at: new Date().toISOString() } })}
                                  className="p-1 text-text-muted hover:text-warning rounded transition-colors"
                                  title="Skip"
                                >
                                  <X size={13} />
                                </button>
                                <button
                                  onClick={() => deleteTask.mutate(task.id)}
                                  className="p-1 text-text-muted hover:text-danger rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {columns[col.id].length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-text-muted text-center py-4 select-none">Drop here</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
