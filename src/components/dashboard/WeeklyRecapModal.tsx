import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { useAppStore } from '../../store/useAppStore'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { Star, X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { db } from '../../db'
import clsx from 'clsx'

// ── Show-window helpers ────────────────────────────────────────────────────────

function getRecapKey() {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `recap-seen-${now.getFullYear()}-W${week}`
}

function isInShowWindow(): boolean {
  const day = new Date().getDay()
  const hour = new Date().getHours()
  return day === 0 || (day === 1 && hour < 1)
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    const particles = Array.from({ length: 80 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 100, y: H / 2,
      vx: (Math.random() - 0.5) * 12, vy: Math.random() * -14 - 2,
      size: Math.random() * 6 + 3,
      color: ['#f59e0b','#60a5fa','#a78bfa','#34d399','#f87171','#fb923c'][Math.floor(Math.random() * 6)],
      rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 8, life: 1,
    }))
    let animId: number
    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => {
        p.x += p.vx; p.vy += 0.4; p.y += p.vy
        p.rot += p.rotV; p.life -= 0.012
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2)
        ctx.restore()
      })
      if (particles.some(p => p.life > 0)) animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [])
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}

// ── Slide ─────────────────────────────────────────────────────────────────────

interface SlideData {
  gradient: string
  icon: string
  title: string
  value: string | number
  subtitle: string
  detail?: string
}

function Slide({ data, isActive }: { data: SlideData; isActive: boolean }) {
  return (
    <div className={clsx(
      'absolute inset-0 flex flex-col items-center justify-center p-8 text-center transition-all duration-500',
      isActive
        ? 'opacity-100 translate-x-0 scale-100'
        : 'opacity-0 translate-x-8 scale-95 pointer-events-none'
    )}>
      <div className="text-6xl mb-5">{data.icon}</div>
      <h2 className="text-4xl font-display font-bold text-white mb-3 leading-tight">
        {data.value}
      </h2>
      <h3 className="text-lg font-semibold text-white/90 mb-3">{data.title}</h3>
      <p className="text-white/65 text-sm max-w-xs leading-relaxed">{data.subtitle}</p>
      {data.detail && (
        <p className="text-white/45 text-xs mt-2 font-medium">{data.detail}</p>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface WeeklyRecapModalProps {
  forceOpen?: boolean
  onClose?: () => void
}

export function WeeklyRecapModal({ forceOpen = false, onClose }: WeeklyRecapModalProps = {}) {
  const { timezone } = useAppStore()
  const [visible, setVisible]           = useState(false)
  const [dismissed, setDismissed]       = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [weeklyStats, setWeeklyStats]   = useState({ completed: 0, total: 0 })

  const { data: goals = [] } = useGoalsQuery('active')

  useEffect(() => {
    const now = new Date()
    const weekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd   = format(endOfWeek(subWeeks(now, 1),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
    db.tasks.where('date').between(weekStart, weekEnd, true, true).toArray()
      .then(tasks => setWeeklyStats({
        completed: tasks.filter(t => t.completed).length,
        total:     tasks.length,
      }))
      .catch(console.error)
  }, [timezone])

  useEffect(() => {
    if (forceOpen) { setVisible(true); return }
    if (!isInShowWindow()) return
    if (localStorage.getItem(getRecapKey())) return
    setVisible(true)
  }, [forceOpen])

  const dismiss = () => {
    if (!forceOpen) localStorage.setItem(getRecapKey(), '1')
    setDismissed(true)
    setTimeout(() => { setVisible(false); onClose?.() }, 350)
  }

  const now           = new Date()
  const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'MMM d')
  const lastWeekEnd   = format(endOfWeek(subWeeks(now, 1),   { weekStartsOn: 1 }), 'MMM d, yyyy')

  const { completed: completedTasks, total: totalTasks } = weeklyStats
  const habitGoals  = goals.filter(g => g.tracker_type === 'habit')
  const bestStreak  = habitGoals.reduce((m, g) => Math.max(m, g.habit_streak ?? 0), 0)
  const topHabit    = habitGoals.find(g => (g.habit_streak ?? 0) === bestStreak)
  const activeGoals = goals.length
  const allTime     = habitGoals.reduce((s, g) => s + (g.habit_streak ?? 0), 0)

  const slides: SlideData[] = [
    {
      gradient: 'from-amber-600 via-orange-500 to-yellow-400',
      icon: '✨',
      title: 'Your Weekly Recap',
      value: `${lastWeekStart} – ${lastWeekEnd}`,
      subtitle: "Here's how your week looked. Swipe through!",
    },
    {
      gradient: 'from-emerald-700 via-green-500 to-teal-400',
      icon: '✅',
      title: 'Tasks This Week',
      value: completedTasks,
      subtitle: totalTasks > 0
        ? `You completed ${completedTasks} of ${totalTasks} tasks this week.`
        : 'Add tasks and check them off to track your progress.',
      detail: completedTasks > 0 && totalTasks > 0
        ? `${Math.round((completedTasks / totalTasks) * 100)}% completion rate`
        : undefined,
    },
    {
      gradient: 'from-rose-700 via-pink-500 to-red-400',
      icon: '🔥',
      title: 'Best Habit Streak',
      value: `${bestStreak} days`,
      subtitle: topHabit
        ? `"${topHabit.name}" is on fire — keep the chain going.`
        : 'Start tracking a habit to build your streak.',
    },
    {
      gradient: 'from-violet-700 via-purple-500 to-indigo-400',
      icon: '🎯',
      title: 'Active Goals',
      value: activeGoals,
      subtitle: `You're actively tracking ${activeGoals} goal${activeGoals !== 1 ? 's' : ''}.`,
      detail: allTime > 0
        ? `${allTime} total habit days logged across all goals`
        : undefined,
    },
    {
      gradient: 'from-sky-700 via-blue-500 to-cyan-400',
      icon: '🚀',
      title: 'Keep Going!',
      value: '💫',
      subtitle: 'Every week is a fresh start. Small consistent steps lead to big results.',
    },
  ]

  const isLast = currentSlide === slides.length - 1

  if (!visible) return null

  const modal = (
    <div
      className={clsx(
        'fixed inset-0 z-[200] flex items-center justify-center p-5 transition-all duration-300',
        dismissed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-lg" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-auto z-10">
        <div
          className={clsx(
            'relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br',
            slides[currentSlide].gradient
          )}
          style={{ minHeight: '460px' }}
        >
          {/* Deco circles */}
          <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-white/10 blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>

          {/* Pill label */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
            <Sparkles size={11} className="text-white" />
            <span className="text-white text-[10px] font-bold uppercase tracking-wider">
              Weekly Recap
            </span>
          </div>

          {/* Slide area */}
          <div className="relative" style={{ minHeight: '360px' }}>
            {slides.map((slide, i) => (
              <Slide key={i} data={slide} isActive={i === currentSlide} />
            ))}
            {isLast && showConfetti && <ConfettiBurst />}
          </div>

          {/* Dots + navigation */}
          <div className="relative z-20 px-6 pb-7 space-y-4">
            <div className="flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={clsx(
                    'rounded-full transition-all duration-300',
                    i === currentSlide
                      ? 'w-6 h-2 bg-white'
                      : 'w-2 h-2 bg-white/35 hover:bg-white/55'
                  )}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide(c => c - 1)}
                  className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft size={20} className="text-white" />
                </button>
              )}

              {isLast ? (
                <button
                  onClick={dismiss}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-white text-gray-800 font-bold text-sm hover:bg-white/90 transition-colors shadow-lg"
                >
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  See You Next Week!
                </button>
              ) : (
                <button
                  onClick={() => {
                    const next = currentSlide + 1
                    setCurrentSlide(next)
                    if (next === slides.length - 1) {
                      setTimeout(() => setShowConfetti(true), 300)
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-white/25 hover:bg-white/35 transition-colors text-white font-semibold text-sm"
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
