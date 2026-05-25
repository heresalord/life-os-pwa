import React from 'react'

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title?: string, subtitle?: string }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display text-accent mb-2 tracking-tight">Life OS</h1>
          {title && <h2 className="text-xl text-text font-medium mt-4">{title}</h2>}
          {subtitle && <p className="text-text-secondary mt-2">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
