
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useAppStore } from '../../store/useAppStore'
import { TaskItem } from '../../components/tasks/TaskItem'
import { AddTaskModal } from '../../components/tasks/AddTaskModal'
import { EmptyState } from '../../components/EmptyState'
import { CheckSquare } from 'lucide-react'

export function TasksPage() {
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useTasksQuery(selectedDate)
  const { updateTask, deleteTask } = useTaskMutations(selectedDate)

  const pending = tasks.filter(t => !t.completed && !t.skipped)
  const completed = tasks.filter(t => t.completed)
  const skipped = tasks.filter(t => t.skipped)

  const handleToggleComplete = (id: string, current: boolean) => {
    updateTask.mutate({ 
      id, 
      updates: { 
        completed: !current, 
        skipped: false, 
        completed_at: !current ? new Date().toISOString() : null 
      } 
    })
  }

  const handleToggleSkip = (id: string, current: boolean) => {
    updateTask.mutate({ 
      id, 
      updates: { 
        skipped: !current, 
        completed: false, 
        skipped_at: !current ? new Date().toISOString() : null 
      } 
    })
  }

  const handleDelete = (id: string) => {
    deleteTask.mutate(id)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Tasks</h1>
      </header>

      <AddTaskModal date={selectedDate} />

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={40} />}
          title="No tasks yet"
          message="Add your first task for today."
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Pending</h2>
              <div className="space-y-2">
                {pending.map(t => (
                  <TaskItem 
                    key={t.id} 
                    task={t as any} 
                    onToggleComplete={handleToggleComplete}
                    onToggleSkip={handleToggleSkip}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Completed</h2>
              <div className="space-y-2 opacity-70">
                {completed.map(t => (
                  <TaskItem 
                    key={t.id} 
                    task={t as any} 
                    onToggleComplete={handleToggleComplete}
                    onToggleSkip={handleToggleSkip}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {skipped.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider pl-1">Skipped</h2>
              <div className="space-y-2 opacity-50">
                {skipped.map(t => (
                  <TaskItem 
                    key={t.id} 
                    task={t as any} 
                    onToggleComplete={handleToggleComplete}
                    onToggleSkip={handleToggleSkip}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
