import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {icon && (
        <div className="text-text-muted mb-4 opacity-50">{icon}</div>
      )}
      <h3 className="text-base font-medium text-text-secondary mb-1">{title}</h3>
      {message && <p className="text-sm text-text-muted max-w-xs">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
