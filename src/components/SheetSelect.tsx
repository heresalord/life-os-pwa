import * as Dialog from '@radix-ui/react-dialog'
import { Check, ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

interface SheetSelectOption {
  value: string
  label: string
}

interface SheetSelectProps {
  value: string
  onChange: (value: string) => void
  options: SheetSelectOption[]
  /** Shown as the sheet's title and as placeholder text when nothing is selected */
  label: string
  placeholder?: string
  className?: string
  /** Capitalizes option labels in the trigger + list (matches the old <select> styling) */
  capitalize?: boolean
}

/**
 * A styled stand-in for a native <select>, matching the app's bottom-sheet-on-mobile /
 * centered-dialog-on-desktop pattern instead of handing off to the OS picker UI.
 */
export function SheetSelect({ value, onChange, options, label, placeholder, className, capitalize }: SheetSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full flex items-center justify-between gap-2 bg-surface-2 border border-border rounded-xl px-4 py-3 text-left text-text focus:border-accent focus:outline-none transition-colors hover:border-text-muted',
            capitalize && 'capitalize',
            className
          )}
        >
          <span className={clsx('truncate', !selected && 'text-text-muted')}>
            {selected?.label ?? placeholder ?? label}
          </span>
          <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-[60] bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl max-h-[70dvh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xs sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-sm font-semibold text-text">{label}</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors"><X size={16} /></Dialog.Close>
          </div>

          <div className="space-y-0.5">
            {options.map(o => {
              const isSelected = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    capitalize && 'capitalize',
                    isSelected ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface-2'
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && <Check size={14} className="flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
