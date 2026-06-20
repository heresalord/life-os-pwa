import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  Edit2,
  Trash2,
  Save,
  CheckCircle2,
  Target,
  Plus,
  Trash,
  Calendar,
  Share2
} from 'lucide-react'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useProjectMutations } from '../../hooks/useProjectMutations'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../db'
import { GoalItem } from '../../components/goals/GoalItem'
import { ShareModal } from '../../components/dashboard/ShareModal'
import clsx from 'clsx'

const PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444', text: 'text-red-500', bg: 'bg-red-500/10' },
  { name: 'Orange', hex: '#f97316', text: 'text-orange-500', bg: 'bg-orange-500/10' },
  { name: 'Amber', hex: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Green', hex: '#10b981', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Blue', hex: '#3b82f6', text: 'text-blue-500', bg: 'bg-blue-500/10' },
  { name: 'Indigo', hex: '#6366f1', text: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { name: 'Purple', hex: '#8b5cf6', text: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Pink', hex: '#ec4899', text: 'text-pink-500', bg: 'bg-pink-500/10' },
]

export function ProjectDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  // Queries
  const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery()
  const project = useMemo(() => projects.find(p => p.id === id), [projects, id])

  // Fetch linked tasks and goals
  const { data: linkedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => db.tasks.where('project_id').equals(id).toArray(),
    enabled: !!id
  })

  const { data: linkedGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['project-goals', id],
    queryFn: () => db.goals.where('project_id').equals(id).toArray(),
    enabled: !!id
  })

  // Fetch other active unlinked goals to support linking
  const { data: unlinkedGoals = [] } = useQuery({
    queryKey: ['unlinked-goals', user?.id],
    queryFn: async () => {
      const active = await db.goals.where('state').equals('active').toArray()
      return active.filter(g => g.project_id !== id)
    },
    enabled: !!user
  })

  // Mutations
  const { updateProject, deleteProject } = useProjectMutations()
  // Task mutations with dummy date (since invalidateAll updates all tasks cached queries)
  const todayStr = new Date().toISOString().split('T')[0]
  const { addTask, updateTask, deleteTask } = useTaskMutations(todayStr)
  const { updateGoal } = useGoalMutations()

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState('#3b82f6')
  const [editArchived, setEditArchived] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  // Quick Add Task state
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // Goal Linking state
  const [selectedGoalToLink, setSelectedGoalToLink] = useState('')

  // Init form values
  const startEditing = () => {
    if (!project) return
    setEditName(project.name)
    setEditDesc(project.description || '')
    setEditColor(project.color || '#3b82f6')
    setEditArchived(project.archived)
    setIsEditing(true)
  }

  const handleSaveProject = async () => {
    if (!editName.trim()) return
    await updateProject.mutateAsync({
      id,
      updates: {
        name: editName.trim(),
        description: editDesc.trim() || null,
        color: editColor,
        archived: editArchived
      }
    })
    setIsEditing(false)
  }

  const handleDeleteProject = async () => {
    if (window.confirm('Delete this project permanently? This will unlink its tasks and goals.')) {
      await deleteProject.mutateAsync(id)
      navigate('/projects')
    }
  }

  // Quick Task Add Handler
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    await addTask.mutateAsync({
      title: newTaskTitle.trim(),
      date: todayStr,
      project_id: id,
      kanban_status: 'todo',
      priority: 3 // Medium default
    })

    setNewTaskTitle('')
    // Invalidate local query
    qc.invalidateQueries({ queryKey: ['project-tasks', id] })
  }

  // Task inline complete handler
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    await updateTask.mutateAsync({
      id: taskId,
      updates: {
        completed,
        completed_at: completed ? new Date().toISOString() : null
      }
    })
    qc.invalidateQueries({ queryKey: ['project-tasks', id] })
  }

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Delete this task?')) {
      await deleteTask.mutateAsync(taskId)
      qc.invalidateQueries({ queryKey: ['project-tasks', id] })
    }
  }

  // Goal linking handler
  const handleLinkGoal = async () => {
    if (!selectedGoalToLink) return
    await updateGoal.mutateAsync({
      id: selectedGoalToLink,
      updates: { project_id: id }
    })
    setSelectedGoalToLink('')
    // Invalidate local queries
    qc.invalidateQueries({ queryKey: ['project-goals', id] })
    qc.invalidateQueries({ queryKey: ['unlinked-goals', user?.id] })
  }

  const handleUnlinkGoal = async (goalId: string) => {
    if (window.confirm('Unlink this goal from this project?')) {
      await updateGoal.mutateAsync({
        id: goalId,
        updates: { project_id: null }
      })
      qc.invalidateQueries({ queryKey: ['project-goals', id] })
      qc.invalidateQueries({ queryKey: ['unlinked-goals', user?.id] })
    }
  }

  const progress = useMemo(() => {
    const total = linkedTasks.length + linkedGoals.length
    if (total === 0) return 0
    const completedTasks = linkedTasks.filter(t => t.completed).length
    const completedGoals = linkedGoals.filter(g => g.is_completed || g.state === 'completed').length
    return Math.round(((completedTasks + completedGoals) / total) * 100)
  }, [linkedTasks, linkedGoals])

  const colorDef = useMemo(() => {
    if (!project) return PRESET_COLORS[4]
    return PRESET_COLORS.find(c => c.hex === project.color) || PRESET_COLORS[4]
  }, [project])

  if (projectsLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-2xl space-y-4">
        <p className="text-text-secondary text-sm">Project not found or was deleted.</p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2 bg-accent text-bg font-medium rounded-xl text-xs"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 lg:max-w-4xl pb-12">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text font-medium py-1.5 px-3 bg-surface border border-border rounded-xl transition-colors shadow-sm animate-in fade-in duration-200"
        >
          <ChevronLeft size={14} /> Back to Projects
        </button>

        <div className="flex gap-2">
          {!isEditing && (
            <>
              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text bg-surface border border-border px-3 py-1.5 rounded-xl transition-colors shadow-sm"
              >
                <Share2 size={13} /> Share Project
              </button>
              <button
                onClick={startEditing}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text bg-surface border border-border px-3 py-1.5 rounded-xl transition-colors shadow-sm"
              >
                <Edit2 size={13} /> Edit Project
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex items-center gap-1 text-xs text-danger bg-danger/10 hover:bg-danger/20 border border-danger/20 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
              >
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project Banner Card */}
      {!isEditing ? (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: project.color || '#3b82f6' }}
          />

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold text-text-secondary bg-surface-2 border border-border/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Project Area
            </span>
            {project.archived && (
              <span className="text-[10px] font-bold bg-muted border border-border text-text-muted px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Archived
              </span>
            )}
            <span className="text-[10px] font-bold bg-accent/10 border border-accent/20 text-accent px-2.5 py-0.5 rounded-full uppercase tracking-wider ml-auto">
              {progress}% Done
            </span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-display text-text leading-tight">{project.name}</h2>
            {project.description && (
              <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
                {project.description}
              </p>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1.5 pt-2">
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border/50">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: project.color || '#3b82f6'
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Edit Project Card */
        <div className="bg-surface border border-accent/25 rounded-2xl p-5 shadow-md space-y-4">
          <h3 className="text-sm font-semibold text-text">Editing Project Info</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Project Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Description</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preset Colors */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Theme Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditColor(c.hex)}
                      className={clsx(
                        'w-6 h-6 rounded-full border transition-all',
                        editColor === c.hex
                          ? 'ring-2 ring-offset-2 ring-offset-bg ring-accent border-transparent scale-105'
                          : 'border-border opacity-80 hover:opacity-100'
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Archive Toggle */}
              <div className="flex items-center gap-2 pt-2 md:pt-4">
                <input
                  type="checkbox"
                  id="editArchived"
                  checked={editArchived}
                  onChange={e => setEditArchived(e.target.checked)}
                  className="rounded border-border bg-surface-2 text-accent focus:ring-accent"
                />
                <label htmlFor="editArchived" className="text-xs font-semibold text-text cursor-pointer select-none">
                  Archive this project
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSaveProject}
                disabled={updateProject.isPending}
                className="flex-1 bg-accent text-bg font-semibold rounded-xl py-2.5 hover:bg-accent-dim text-xs transition-colors shadow-sm"
              >
                <Save size={13} className="inline mr-1" /> Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-border rounded-xl text-text-secondary hover:text-text hover:bg-surface-2 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Goals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Target size={14} className={colorDef.text} /> Linked Goals ({linkedGoals.length})
          </h3>

          {/* Goal Link Selector */}
          {unlinkedGoals.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <select
                value={selectedGoalToLink}
                onChange={e => setSelectedGoalToLink(e.target.value)}
                className="bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">Choose Goal to Link...</option>
                {unlinkedGoals.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLinkGoal}
                disabled={!selectedGoalToLink}
                className="p-1.5 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg rounded-xl transition-all shadow-sm"
                title="Link Goal"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {goalsLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : linkedGoals.length === 0 ? (
          <div className="text-center p-6 bg-surface-2/30 border border-dashed border-border rounded-xl text-xs text-text-muted">
            No goals linked yet. Link an existing active goal above, or add a project ID when creating a goal.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {linkedGoals.map(g => (
              <div key={g.id} className="relative group">
                <GoalItem goal={g} />
                <button
                  onClick={() => handleUnlinkGoal(g.id)}
                  className="absolute right-2 top-2 p-1 bg-surface border border-border rounded-lg text-text-muted hover:text-danger hover:border-danger/20 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                  title="Unlink goal from project"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Tasks Section */}
      <div className="space-y-4">
        <div className="border-b border-border/40 pb-2">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={14} className={colorDef.text} /> Project Tasks ({linkedTasks.length})
          </h3>
        </div>

        {/* Quick Task Creation Form */}
        <form onSubmit={handleQuickAddTask} className="flex gap-2">
          <input
            type="text"
            placeholder="Add task to this project..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            className="flex-1 bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim() || addTask.isPending}
            className="px-4 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg rounded-xl font-semibold text-xs flex items-center gap-1 transition-all shadow-sm"
          >
            <Plus size={14} /> Add
          </button>
        </form>

        {tasksLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : linkedTasks.length === 0 ? (
          <div className="text-center p-6 bg-surface-2/30 border border-dashed border-border rounded-xl text-xs text-text-muted">
            No tasks linked to this project yet. Add a task above.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border/60">
            {linkedTasks.map(task => (
              <div
                key={task.id}
                className="p-3.5 flex items-center justify-between gap-3 group hover:bg-surface-2/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={e => handleToggleTask(task.id, e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span
                      className={clsx(
                        'text-xs font-semibold text-text break-words',
                        task.completed && 'line-through text-text-muted'
                      )}
                    >
                      {task.title}
                    </span>
                    {task.date && (
                      <p className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1">
                        <Calendar size={10} /> Date: {task.date}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.priority && (
                    <span
                      className={clsx(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider',
                        task.priority === 1 ? 'border-danger/30 text-danger bg-danger/5'
                        : task.priority === 2 ? 'border-warning/30 text-warning bg-warning/5'
                        : 'border-border text-text-muted bg-surface-2'
                      )}
                    >
                      P{task.priority}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/5 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        itemType="project"
        itemId={project.id}
        itemName={project.name}
      />
    </div>
  )
}
