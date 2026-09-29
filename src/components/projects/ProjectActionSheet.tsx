import * as Dialog from '@radix-ui/react-dialog'
import { FolderPlus, KeyRound, X, ChevronRight } from 'lucide-react'

export interface ProjectActionSheetProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: () => void
  onJoinWithCode: () => void
}

/**
 * ProjectActionSheet — Bottom sheet on mobile / centered modal on desktop
 * offering "Create project" and "Join with code". Reused in Phase D.
 */
export function ProjectActionSheet({
  isOpen,
  onClose,
  onCreateProject,
  onJoinWithCode,
}: ProjectActionSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl max-h-[85vh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {/* Mobile pull indicator */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-text">
                Projects
              </Dialog.Title>
              <Dialog.Description className="text-xs text-text-muted mt-0.5">
                Create a new project or join an existing shared project
              </Dialog.Description>
            </div>
            <Dialog.Close
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Action options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                onClose()
                onCreateProject()
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-2/80 border border-border/60 hover:border-accent/40 active:scale-[0.99] transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform flex-shrink-0">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                    Create project
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Start a new workspace for tasks and goals
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose()
                onJoinWithCode()
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-2/80 border border-border/60 hover:border-accent/40 active:scale-[0.99] transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                    Join with code
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Enter an invite code to join a shared project
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
