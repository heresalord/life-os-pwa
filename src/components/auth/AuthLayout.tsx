import React from 'react'

// Auth pages are always light — they render before any user theme preference
// is loaded, so we force light colors, iOS frosted card and ambient gradient.
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
    <div
      data-theme="light"
      className="relative min-h-[100dvh] flex flex-col justify-between overflow-x-hidden selection:bg-accent/20"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, #faf5ec 0%, #f4ede2 40%, #eee5d7 100%)',
      }}
    >
      {/* Decorative ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[340px] rounded-full blur-3xl opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(223, 207, 176, 0.6) 0%, rgba(196, 176, 141, 0.2) 60%, transparent 80%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(210, 190, 155, 0.5) 0%, transparent 70%)',
        }}
      />

      {/* Safe area status bar spacer */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }} />

      {/* Scrollable card container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 z-10 w-full max-w-lg mx-auto">
        {/* Frosted Glass Card */}
        <div
          className="w-full bg-white/90 backdrop-blur-2xl border border-white/80 rounded-[28px] p-6 sm:p-9 transition-all duration-300"
          style={{
            boxShadow: '0 24px 60px -12px rgba(176, 154, 117, 0.2), 0 8px 24px -4px rgba(0, 0, 0, 0.04), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
          }}
        >
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-3.5 group">
              <div
                className="w-14 h-14 rounded-2xl p-0.5 shadow-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #faeed9 0%, #c4b08d 100%)',
                  boxShadow: '0 8px 20px -4px rgba(196, 176, 141, 0.4)',
                }}
              >
                <img
                  src="/favicon.svg"
                  alt="Kairo"
                  className="w-full h-full rounded-[14px] object-cover"
                />
              </div>
            </div>

            <h1
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                letterSpacing: '-0.03em',
              }}
              className="text-3xl font-normal text-[#1f1c16]"
            >
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
