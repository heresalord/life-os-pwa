import React from 'react'

// Auth pages are always light — they render before any user theme preference
// is loaded, so we force light colors and a scroll-safe layout here.
export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
}) {
  return (
    // Force light theme on the whole auth surface regardless of system/user preference
    <div
      data-theme="light"
      style={{
        height: '100dvh',
        backgroundColor: 'var(--theme-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Safe area status bar spacer - prevents keyboard from shifting inputs over status bar */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }} />

      {/* Scrollable content container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
        }}
      >
        {/* Card sits centered with a comfortable margin — scrollable when keyboard opens */}
        <div
          style={{
            width: '100%',
            maxWidth: '448px',
            backgroundColor: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: '20px',
            padding: '2rem',
            marginTop: 'auto',
            marginBottom: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
        {/* Brand */}
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '2.25rem',
              color: '#b09a75',
              letterSpacing: '-0.02em',
              marginBottom: '0.25rem',
            }}
          >
            Life OS
          </h1>
          {title && (
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1a1918', marginTop: '1rem' }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: '#5c5854' }}>
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  </div>
  )
}
