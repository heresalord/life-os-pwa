import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useContextualAdd } from '../../hooks/useContextualAdd'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Folder,
  Plus,
  X,
  ChevronDown,
  Trash2,
  Archive,
  CheckCircle2,
  Target,
  ChevronRight
} from 'lucide-react'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useProjectMutations } from '../../hooks/useProjectMutations'
import { useAuth } from '../../hooks/useAuth'
import { useDb } from '../../db/DbContext'
import { EmptyState } from '../../components/EmptyState'
import { PageSkeleton } from '../../components/Skeleton'
import clsx from 'clsx'

type ProjectFilter = 'active' | 'archived'

const PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500' },
  { name: 'Orange', hex: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500' },
  { name: 'Amber', hex: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
  { name: 'Green', hex: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500' },
  { name: 'Indigo', hex: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-500' },
  { name: 'Purple', hex: '#8b5cf6', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500' },
  { name: 'Pink', hex: '#ec4899', bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500' },
]

export function ProjectsPage() {
  const db = useDb()
  const { user } = useAuth()
  const [filter, setFilter] = useState<ProjectFilter>('active')
  const [open, setOpen] = useState(false)

  useContextualAdd(() => setOpen(true))

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[4].hex) // Default to blue

  const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery()
  const { addProject, updateProject, deleteProject } = useProjectMutations()

  // Query all tasks and goals for offline metric calculation
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['projects-stats-data', user?.id],
    queryFn: async () => {
      const tasks = await db.tasks.toArray()
      const goals = await db.goals.toArray()
      return { tasks, goals }
    },
    enabled: !!user
  })

  const filteredProjects = useMemo(() => {
    return projects.filter(p => (filter === 'active' ? !p.archived : p.archived))
  }, [projects, filter])

  const projectStats = useMemo(() => {
    if (!statsData) return {}
    const stats: Record<string, {
      totalTasks: number
      completedTasks: number
      totalGoals: number
      completedGoals: number
      progress: number
    }> = {}

    projects.forEach(proj => {
      const projTasks = statsData.tasks.filter(t => t.project_id === proj.id)
      const completedTasks = projTasks.filter(t => t.completed).length

      const projGoals = statsData.goals.filter(g => g.project_id === proj.id)
      const completedGoals = projGoals.filter(g => g.is_completed || g.state === 'completed').length

      const total = projTasks.length + projGoals.length
      const completed = completedTasks + completedGoals

      stats[proj.id] = {
        totalTasks: projTasks.length,
        completedTasks,
        totalGoals: projGoals.length,
        completedGoals,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    })

    return stats
  }, [projects, statsData])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await addProject.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      color: selectedColor
    })

    // Reset Form
    setName('')
    setDescription('')
    setSelectedColor(PRESET_COLORS[4].hex)
    setOpen(false)
  }

  const handleToggleArchive = async (id: string, currentlyArchived: boolean) => {
    await updateProject.mutateAsync({
      id,
      updates: { archived: !currentlyArchived }
    })
  }

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this project permanently? This will unlink its tasks and goals.')) {
      await deleteProject.mutateAsync(id)
    }
  }

  const getProjectColorCls = (colorHex: string | null) => {
    const found = PRESET_COLORS.find(c => c.hex === colorHex)
    return found || PRESET_COLORS[4] // Default blue
  }

  const isLoading = projectsLoading || statsLoading

  return (
    <div className="space-y-6 lg:max-w-5xl pb-10">
      {/* Dialog root wrapping header buttons & float FAB */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display text-text">Projects</h1>
            <p className="text-xs text-text-muted mt-0.5">Manage tasks and goals grouped by areas of focus</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop New Project trigger */}
            <div className="hidden md:block">
              <Dialog.Trigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 bg-accent text-bg text-xs font-bold rounded-xl hover:bg-accent-dim active:scale-95 transition-all shadow-[var(--shadow-card)]">
                  <Plus size={16} strokeWidth={2.5} /> New Project
                </button>
              </Dialog.Trigger>
            </div>

            {/* State Filter dropdown */}
            <div className="relative group">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as ProjectFilter)}
                className="appearance-none bg-surface border border-border rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-text focus:outline-none focus:border-accent cursor-pointer transition-colors shadow-sm"
              >
                <option value="active">Active Projects</option>
                <option value="archived">Archived</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
            </div>
          </div>
        </header>

        {/* Floating FAB on Mobile */}
        <div className="fixed bottom-24 right-4 z-20 md:hidden">
          <Dialog.Trigger asChild>
            <button
              className="w-14 h-14 rounded-full bg-accent text-bg flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:bg-accent-dim active:scale-95 transition-all"
              aria-label="New Project"
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl overflow-y-auto max-h-[85vh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-text">Create New Project</Dialog.Title>
                <Dialog.Description className="text-xs text-text-muted mt-0.5">
                  Organize your related goals and tasks together
                </Dialog.Description>
              </div>
              <Dialog.Close className="p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors">
                <X size={16} />
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Project Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Health & Fitness Goals"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Description (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Describe the main focus or boundaries of this project..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Color highlights */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Highlight Color</label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map(c => {
                    const isSelected = selectedColor === c.hex
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        title={c.name}
                        className={clsx(
                          'w-7 h-7 rounded-full border transition-all flex items-center justify-center',
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-bg ring-accent border-transparent scale-110'
                            : 'border-border opacity-75 hover:opacity-100'
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!name.trim() || addProject.isPending}
                className="w-full bg-accent text-bg font-semibold rounded-xl py-3 hover:bg-accent-dim active:scale-[0.99] transition-all disabled:opacity-50 text-sm shadow-sm"
              >
                {addProject.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {isLoading ? (
        <PageSkeleton />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<Folder size={40} />}
          title={`No ${filter} projects`}
          message={filter === 'active' ? "Create a project to link tasks and goals together." : "No archived projects found."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map(proj => {
            const stats = projectStats[proj.id] || { totalTasks: 0, completedTasks: 0, totalGoals: 0, completedGoals: 0, progress: 0 }
            const colorDef = getProjectColorCls(proj.color)

            // Status pill details
            const statusLabel = stats.progress >= 70 ? 'On Track' : stats.progress >= 25 ? 'Active' : 'At Risk'
            const statusColor = stats.progress >= 70 ? 'bg-success/10 text-success border-success/20'
              : stats.progress >= 25 ? 'bg-info/10 text-info border-info/20'
              : 'bg-danger/10 text-danger border-danger/20'

            return (
              <div
                key={proj.id}
                style={{
                  borderColor: `${proj.color || '#3B82F6'}30`,
                  background: `linear-gradient(135deg, ${(proj.color || '#3B82F6')}0d 0%, var(--theme-surface) 100%)`
                }}
                className="border rounded-2xl p-5 shadow-[var(--shadow-card)] transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-text leading-tight group-hover:text-accent transition-colors flex-1 min-w-0">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status Pill */}
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase', statusColor)}>
                        {statusLabel}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleArchive(proj.id, proj.archived)
                          }}
                          className="p-2 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-2 transition-all bg-surface"
                          title={proj.archived ? 'Unarchive Project' : 'Archive Project'}
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteProject(proj.id)
                          }}
                          className="p-2 rounded-lg border border-transparent hover:border-danger/20 text-text-muted hover:text-danger hover:bg-danger/5 transition-all"
                          title="Delete Project"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {proj.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider text-text-secondary uppercase">
                    <span>Overall Progress</span>
                    <span className="text-text font-bold">{stats.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.progress}%`,
                        backgroundColor: proj.color || '#3b82f6'
                      }}
                    />
                  </div>
                </div>

                {/* Quick details */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-2 text-text-secondary">
                      <CheckCircle2 size={12} className={colorDef.text} />
                      <strong>{stats.completedTasks}</strong> / {stats.totalTasks} Tasks
                    </span>
                    <span className="flex items-center gap-2 text-text-secondary">
                      <Target size={12} className={colorDef.text} />
                      <strong>{stats.completedGoals}</strong> / {stats.totalGoals} Goals
                    </span>
                  </div>
                  <Link
                    to={`/projects/${proj.id}`}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim font-semibold group-hover:translate-x-0.5 transition-transform"
                  >
                    View details <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
