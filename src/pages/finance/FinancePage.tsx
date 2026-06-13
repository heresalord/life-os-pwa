import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Landmark, List, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUserSettings } from '../../hooks/useUserSettings'
import { OverviewTab }     from './components/OverviewTab'
import { AccountsTab }     from './components/AccountsTab'
import { TransactionsTab } from './components/TransactionsTab'
import { BudgetsTab }      from './components/BudgetsTab'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import {
  format,
  addDays, addWeeks, addMonths, addYears,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  isBefore, parseISO,
} from 'date-fns'
import clsx from 'clsx'

const TABS = [
  { value: 'overview',     icon: BarChart3, label: 'Overview'     },
  { value: 'accounts',     icon: Landmark,  label: 'Accounts'     },
  { value: 'transactions', icon: List,      label: 'Activity'     },
  { value: 'budgets',      icon: Target,    label: 'Budgets'      },
] as const

type TabValue = typeof TABS[number]['value']

export function FinancePage() {
  const { data: settings } = useUserSettings()
  const currency = settings?.currency ?? 'USD'
  const [active, setActive] = useState<TabValue>('overview')

  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [referenceDate, setReferenceDate] = useState<string>(today)

  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')

  // Deep link from search: jump to the right tab + date so the
  // highlighted transaction is in range.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const date = searchParams.get('date')
    if (tab && TABS.some(t => t.value === tab)) setActive(tab as TabValue)
    if (date) {
      setPeriod('day')
      setReferenceDate(date)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const adjustPeriod = (direction: 'prev' | 'next') => {
    const d = new Date(referenceDate + 'T12:00:00')
    const n = direction === 'prev' ? -1 : 1
    let next = d
    if      (period === 'day')   next = addDays(d, n)
    else if (period === 'week')  next = addWeeks(d, n)
    else if (period === 'month') next = addMonths(d, n)
    else if (period === 'year')  next = addYears(d, n)
    setReferenceDate(format(next, 'yyyy-MM-dd'))
  }

  // Disable the "next" chevron when already at the current period
  const isAtCurrentOrFuturePeriod = useMemo(() => {
    const d = parseISO(referenceDate + 'T12:00:00')
    const t = parseISO(today + 'T12:00:00')
    if (period === 'day')   return !isBefore(d, t)
    if (period === 'week')  return !isBefore(
      startOfWeek(d, { weekStartsOn: 1 }),
      startOfWeek(t, { weekStartsOn: 1 })
    )
    if (period === 'month') return format(d, 'yyyy-MM') >= format(t, 'yyyy-MM')
    return d.getFullYear() >= t.getFullYear()
  }, [referenceDate, period, today])

  const getPeriodLabel = () => {
    const d = new Date(referenceDate + 'T12:00:00')
    if (period === 'day')   return format(d, 'MMMM d, yyyy')
    if (period === 'week') {
      const s = startOfWeek(d, { weekStartsOn: 1 })
      const e = endOfWeek(d,   { weekStartsOn: 1 })
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
    }
    if (period === 'month') return format(d, 'MMMM yyyy')
    return format(d, 'yyyy')
  }

  const dateRange = useMemo(() => {
    const d = new Date(referenceDate + 'T12:00:00')
    if (period === 'day')   return { from: referenceDate, to: referenceDate }
    if (period === 'week')  return {
      from: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to:   format(endOfWeek(d,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
    if (period === 'month') return {
      from: format(startOfMonth(d), 'yyyy-MM-dd'),
      to:   format(endOfMonth(d),   'yyyy-MM-dd'),
    }
    return {
      from: format(startOfYear(d), 'yyyy-MM-dd'),
      to:   format(endOfYear(d),   'yyyy-MM-dd'),
    }
  }, [referenceDate, period])

  return (
    <div className="space-y-4 lg:max-w-5xl">
      <header>
        <h1 className="text-2xl font-display text-text">Finance</h1>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 border border-border rounded-2xl">
        {TABS.map(tab => {
          const Icon     = tab.icon
          const isActive = active === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActive(tab.value)}
              className={clsx(
                'flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all duration-200 font-medium w-full',
                isActive ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={clsx('text-xs sm:text-sm', isActive ? 'inline' : 'hidden sm:inline')}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Timeframe selector ──────────────────────────────────────────── */}
      {(active === 'overview' || active === 'transactions') && (
        <div className="flex flex-col gap-3 bg-surface border border-border p-3.5 rounded-2xl shadow-sm">
          {/* Period pills */}
          <div className="flex p-1 bg-surface-2 border border-border rounded-xl">
            {(['day', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setReferenceDate(today) }}
                className={clsx(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                  period === p ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Prev / label / next */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => adjustPeriod('prev')}
              className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-text">{getPeriodLabel()}</span>
            <button
              onClick={() => adjustPeriod('next')}
              disabled={isAtCurrentOrFuturePeriod}
              className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-200">
        {active === 'overview' && (
          <OverviewTab currency={currency} from={dateRange.from} to={dateRange.to} period={period} />
        )}
        {active === 'accounts' && <AccountsTab currency={currency} />}
        {active === 'transactions' && (
          <TransactionsTab currency={currency} from={dateRange.from} to={dateRange.to} today={today} highlightId={highlightId} />
        )}
        {active === 'budgets' && <BudgetsTab currency={currency} />}
      </div>
    </div>
  )
}
