import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useContextualAdd } from '../../hooks/useContextualAdd'
import { useQuery } from '@tanstack/react-query'
import {
  Folder,
  Plus,
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
import { ProjectActionSheet } from '../../components/projects/ProjectActionSheet'
import { CreateProjectModal, PRESET_COLORS } from '../../components/projects/CreateProjectModal'
import { JoinProjectModal } from '../../components/projects/JoinProjectModal'
import clsx from 'clsx'

type ProjectFilter = 'active' | 'archived'

export function ProjectsPage() {
  const db = useDb()
  const { user } = useAuth()
  const [filter, setFilter] = useState<ProjectFilter>('active')

  // Modals / Action Sheet states
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [joinModalOpen, setJoinModalOpen] = useState(false)

  // Single contextual "+" handler: opens the action sheet
  useContextualAdd(() => setActionSheetOpen(true))

  const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery()
  const { updateProject, deleteProject } = useProjectMutations()

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">Projects</h1>
          <p className="text-xs text-text-muted mt-0.5">Manage tasks and goals grouped by areas of focus</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Desktop New Project trigger opens the single Action Sheet */}
          <div className="hidden md:block">
            <button
              type="button"
              onClick={() => setActionSheetOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-bg text-xs font-bold rounded-xl hover:bg-accent-dim active:scale-95 transition-all shadow-[var(--shadow-card)]"
            >
              <Plus size={16} strokeWidth={2.5} /> New Project
            </button>
          </div>

          {/* State Filter dropdown */}
          <div className="relative group">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as ProjectFilter)}
              className="appearance-none bg-surface border border-border rounded-xl pl-4 pr-8 py-2 text-xs font-semibold text-text focus:outline-none focus:border-accent cursor-pointer transition-colors shadow-sm"
            >
              <option value="active">Active Projects</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
          </div>
        </div>
      </header>

      {/* Action Sheet offering Create project or Join with code */}
      <ProjectActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        onCreateProject={() => setCreateModalOpen(true)}
        onJoinWithCode={() => setJoinModalOpen(true)}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Join Project Modal */}
      <JoinProjectModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />

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
                <div className="space-y-3">
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
                <div className="space-y-2 pt-1">
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
