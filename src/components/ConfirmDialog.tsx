import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { haptic } from '../lib/haptic'
import clsx from 'clsx'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  /** 'default' = neutral action (e.g. reset a layout). 'danger' = destructive / irreversible (e.g. delete data). */
  variant?: 'default' | 'danger'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'default',
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger'

  const handleConfirm = () => {
    haptic(isDanger ? 'heavy' : 'medium')
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              {isDanger && (
                <span className="w-8 h-8 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={15} className="text-danger" />
                </span>
              )}
              <Dialog.Title className={clsx('text-base font-semibold', isDanger ? 'text-danger' : 'text-text')}>
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors flex-shrink-0">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-text-secondary leading-relaxed mb-5">
            {description}
          </Dialog.Description>

          <div className="flex gap-2.5">
            <Dialog.Close asChild>
              <button className="flex-1 py-3 bg-surface-2 border border-border text-text-secondary hover:text-text font-medium text-sm rounded-xl transition-colors">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              className={clsx(
                'flex-1 py-3 font-medium text-sm rounded-xl transition-colors',
                isDanger
                  ? 'bg-danger text-bg hover:bg-danger/90'
                  : 'bg-accent text-bg hover:bg-accent-dim'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
