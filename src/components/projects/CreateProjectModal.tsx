import { useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FolderPlus, X } from 'lucide-react'
import { useProjectMutations } from '../../hooks/useProjectMutations'
import clsx from 'clsx'

export const PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500' },
  { name: 'Orange', hex: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500' },
  { name: 'Amber', hex: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
  { name: 'Green', hex: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500' },
  { name: 'Indigo', hex: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-500' },
  { name: 'Purple', hex: '#8b5cf6', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500' },
  { name: 'Pink', hex: '#ec4899', bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500' },
]

export interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[4].hex)
  const { addProject } = useProjectMutations()

  const handleCreateProject = async (e: FormEvent) => {
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
    onClose()
  }

  const handleClose = () => {
    if (addProject.isPending) return
    onClose()
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl overflow-y-auto max-h-[85vh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <FolderPlus size={18} />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-text">Create New Project</Dialog.Title>
                <Dialog.Description className="text-xs text-text-muted mt-0.5">
                  Organize your related goals and tasks together
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              onClick={handleClose}
              disabled={addProject.isPending}
              className="p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors disabled:opacity-50"
              aria-label="Close"
            >
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
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2 text-sm text-text placeholder-text-muted focus:outline-none transition-colors"
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
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2 text-sm text-text placeholder-text-muted focus:outline-none transition-colors resize-none"
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
  )
}
