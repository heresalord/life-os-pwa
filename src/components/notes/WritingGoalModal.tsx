import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Flame, PenLine, Check } from 'lucide-react'
import { haptic } from '../../lib/haptic'

interface WritingGoalModalProps {
  open: boolean
  onClose: () => void
  currentGoal: number
  onSaveGoal: (newGoal: number) => void
  thisMonthCount: number
  streak: number
}

const PRESET_GOALS = [5, 10, 15, 20, 30]

export function WritingGoalModal({
  open,
  onClose,
  currentGoal,
  onSaveGoal,
  thisMonthCount,
  streak,
}: WritingGoalModalProps) {
  const [goal, setGoal] = useState<number>(currentGoal)

  const pct = Math.min(Math.round((thisMonthCount / goal) * 100), 100)
  const radius = 32
  const stroke = 5
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (pct / 100) * circumference

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (goal > 0) {
      haptic('success')
      onSaveGoal(goal)
      onClose()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md transition-opacity" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-3xl sm:border animate-in fade-in duration-200"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                <PenLine size={18} />
              </div>
              <div>
                <Dialog.Title className="text-base font-display font-bold text-text">
                  Monthly Writing Goal
                </Dialog.Title>
                <p className="text-xs text-text-muted">Track consistency and daily reflection</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Goal Progress Ring Showcase */}
          <div className="bg-surface-2/60 border border-border/60 rounded-2xl p-5 mb-5 flex items-center gap-5">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                <circle
                  stroke="var(--color-border)"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <circle
                  stroke="var(--color-accent)"
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset }}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-xs font-bold text-text font-display">{pct}%</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-text font-display">
                  {thisMonthCount} <span className="text-xs font-normal text-text-muted">of {goal} notes</span>
                </p>
                {streak > 1 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-warning">
                    <Flame size={13} className="fill-warning" /> {streak} day streak
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary leading-snug">
                {pct >= 100
                  ? '🎉 Monthly goal achieved! Keep writing freely.'
                  : `${goal - thisMonthCount} more note${goal - thisMonthCount > 1 ? 's' : ''} to reach your monthly goal.`}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Target notes this month
              </label>

              {/* Preset chips */}
              <div className="flex gap-2 mb-3">
                {PRESET_GOALS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      haptic('light')
                      setGoal(preset)
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                      goal === preset
                        ? 'bg-accent text-bg border-accent shadow-xs'
                        : 'bg-surface-2 border-border text-text-secondary hover:text-text hover:border-accent/40'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                max="200"
                value={goal}
                onChange={e => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val > 0) setGoal(val)
                }}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none transition-colors"
                placeholder="Custom goal…"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary hover:text-text hover:bg-surface-2 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-accent text-bg hover:opacity-90 active:scale-98 text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} /> Save Goal
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
