import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Tag, Folder, AlignLeft, AlertCircle, Share2 } from 'lucide-react'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import type { Task } from '../../db/schema'
import { ShareModal } from '../dashboard/ShareModal'
import { Portal } from '../Portal'
import clsx from 'clsx'

interface TaskEditSheetProps {
  task: Task | null
  open: boolean
  onClose: () => void
}

const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 (High)', color: 'text-danger bg-danger/10 border-danger/30' },
  { value: 2, label: 'P2 (Med)',  color: 'text-warning bg-warning/10 border-warning/30' },
  { value: 3, label: 'P3 (Low)',  color: 'text-info bg-info/10 border-info/30' },
  { value: 4, label: 'P4 (None)', color: 'text-text-secondary bg-surface-2 border-border' },
]

export function TaskEditSheet({ task, open, onClose }: TaskEditSheetProps) {
  const { updateTask } = useTaskMutations(task?.date || '')
  const { data: projects = [] } = useProjectsQuery()

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [projectId, setProjectId] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setPriority(task.priority || 4)
      setDueDate(task.due_date || '')
      setTimeStart(task.time_block_start || '')
      setTimeEnd(task.time_block_end || '')
      setDescription(task.description || '')
      
      const tagsList = Array.isArray(task.tags) 
        ? task.tags 
        : typeof task.tags === 'string'
          ? JSON.parse(task.tags)
          : []
      setTagsInput(tagsList.join(', '))
      
      setProjectId(task.project_id || '')
    }
  }, [task, open])

  if (!open || !task) return null

  const handleSave = async () => {
    if (!title.trim()) return

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    const updates = {
      title: title.trim(),
      priority: priority === 4 ? null : priority,
      due_date: dueDate || null,
      time_block_start: timeStart || null,
      time_block_end: timeEnd || null,
      description: description.trim() || null,
      tags: parsedTags,
      project_id: projectId || null,
    }

    try {
      await updateTask.mutateAsync({ id: task.id, updates })
      onClose()
    } catch (err) {
      console.error('Failed to update task:', err)
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet Content */}
      <div 
        className="relative z-10 w-full sm:max-w-lg bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto sheet-enter"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4.5">
          <h3 className="text-base font-bold text-text flex items-center gap-2">
            Edit Task details
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 text-left">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-sm text-text focus:border-accent outline-none font-medium"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <AlignLeft size={12} /> Description
            </label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-sm text-text focus:border-accent outline-none min-h-[80px]"
              placeholder="Add details, notes, or lists..."
            />
          </div>

          {/* Priority Options */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <AlertCircle size={12} /> Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={clsx(
                    'py-2 border text-xs font-semibold rounded-xl transition-all',
                    priority === opt.value 
                      ? 'bg-accent/10 border-accent text-accent shadow-sm' 
                      : 'border-border text-text-muted hover:border-text-secondary hover:text-text'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <Calendar size={12} /> Due Date
              </label>
              <input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-xs text-text focus:border-accent outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <Folder size={12} /> Project
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:border-accent outline-none"
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time block start/end */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock size={12} /> Time Block
            </label>
            <div className="flex items-center gap-3">
              <input 
                type="time" 
                value={timeStart} 
                onChange={e => setTimeStart(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2 text-xs text-text focus:border-accent outline-none"
              />
              <span className="text-text-muted text-xs font-semibold">to</span>
              <input 
                type="time" 
                value={timeEnd} 
                onChange={e => setTimeEnd(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2 text-xs text-text focus:border-accent outline-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <Tag size={12} /> Tags
            </label>
            <input 
              type="text" 
              value={tagsInput} 
              onChange={e => setTagsInput(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-xs text-text focus:border-accent outline-none"
              placeholder="personal, work, fitness..."
            />
          </div>
        </div>

        {/* Share Button */}
        <div className="mt-4">
          <button 
            type="button"
            onClick={() => setShareOpen(true)}
            className="w-full py-2 bg-surface-2 border border-border text-text font-semibold rounded-xl text-xs hover:bg-surface-3 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={13} /> Share Task
          </button>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 bg-surface-2 text-text font-semibold rounded-xl text-xs hover:bg-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={!title.trim()}
            className="flex-[2] py-3 bg-accent text-bg font-bold rounded-xl text-xs hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        itemType="task"
        itemId={task.id}
        itemName={task.title}
      />
    </div>
    </Portal>
  )
}
