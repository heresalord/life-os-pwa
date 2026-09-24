import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { haptic } from '../../lib/haptic'

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
}) {
  const { theme, setTheme } = useAppStore()

  const toggleTheme = () => {
    haptic('light')
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-between overflow-x-hidden bg-bg text-text selection:bg-accent/20 transition-colors duration-300">
      {/* Decorative ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[340px] rounded-full blur-3xl opacity-40 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-30 dark:opacity-15"
        style={{
          background: 'radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)',
        }}
      />

      {/* Top action bar (theme switch & safe area spacer) */}
      <header className="w-full max-w-lg mx-auto px-4 pt-4 flex items-center justify-end z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl bg-surface/80 hover:bg-surface-2 border border-border/80 text-text-secondary hover:text-text transition-all duration-200 shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-medium"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span className="capitalize">{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </header>

      {/* Scrollable card container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 z-10 w-full max-w-lg mx-auto">
        {/* Frosted Glass Card */}
        <div className="w-full bg-surface/90 backdrop-blur-2xl border border-border/80 rounded-[28px] p-6 sm:p-9 shadow-card dark:shadow-modal transition-all duration-300">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-3.5 group">
              <div className="w-14 h-14 rounded-2xl p-0.5 shadow-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105 bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/30">
                <img
                  src="/favicon.svg"
                  alt="Kairo"
                  className="w-full h-full rounded-[14px] object-cover"
                />
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold text-text tracking-tight">
              Kairo
            </h1>

            {title && (
              <h2 className="text-lg font-semibold text-text mt-3 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-text-secondary max-w-xs leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Form / Content Slot */}
          {children}
        </div>
      </main>

      {/* Safe area bottom footer */}
      <footer className="py-4 text-center text-xs text-text-muted/80 z-10">
        <span style={{ height: 'env(safe-area-inset-bottom, 0px)', display: 'block' }} />
      </footer>
    </div>
  )
}
