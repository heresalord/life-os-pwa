import React from 'react'
import clsx from 'clsx'

interface RadialGaugeProps {
  /** Progress percentage 0-100 */
  pct: number
  /** Outer diameter in px (default 52) */
  size?: number
  /** Central label — typically the % value or a short string. If null/omitted, shows nothing or percentage */
  label?: string | null
  /** Stroke width in px (default 4.5) */
  strokeWidth?: number
  /** Color theme variant */
  variant?: 'accent' | 'success' | 'warning' | 'primary'
  /** Optional extra className for the container */
  className?: string
  /** Whether to show a subtle ambient glow effect behind the active stroke */
  glow?: boolean
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  pct,
  size = 52,
  label,
  strokeWidth = 4.5,
  variant = 'accent',
  className,
  glow = true,
}) => {
  const clampedPct = Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct))
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference

  const variantColors = {
    accent: 'var(--color-accent, #6366f1)',
    success: 'var(--color-success, #10b981)',
    warning: 'var(--color-warning, #f59e0b)',
    primary: 'var(--color-primary, #3b82f6)',
  }

  const strokeColor = variantColors[variant] || variantColors.accent

  return (
    <div
      className={clsx('relative inline-flex items-center justify-center flex-shrink-0 select-none', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedPct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          {glow && (
            <filter id={`gauge-glow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={strokeColor} floodOpacity="0.4" />
            </filter>
          )}
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border/40"
          strokeWidth={strokeWidth}
        />

        {/* Dynamic progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter={glow ? `url(#gauge-glow-${variant})` : undefined}
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>

      {/* Center content */}
      {label !== null && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <span className="text-[10px] font-semibold text-text-primary tracking-tight">
            {label !== undefined ? label : `${Math.round(clampedPct)}%`}
          </span>
        </div>
      )}
    </div>
  )
}
