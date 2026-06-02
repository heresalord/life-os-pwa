import { useState, useMemo } from 'react'
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
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear
} from 'date-fns'
import clsx from 'clsx'

const TABS = [
  { value: 'overview',     icon: BarChart3,  label: 'Overview'  },
  { value: 'accounts',     icon: Landmark,   label: 'Accounts'  },
  { value: 'transactions', icon: List,       label: 'Activity'  },
  { value: 'budgets',      icon: Target,     label: 'Budgets'   },
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

  const adjustPeriod = (direction: 'prev' | 'next') => {
    const d = new Date(referenceDate + 'T12:00:00')
    const amount = direction === 'prev' ? -1 : 1
    let nextDate = d
    if (period === 'day') nextDate = addDays(d, amount)
    else if (period === 'week') nextDate = addWeeks(d, amount)
    else if (period === 'month') nextDate = addMonths(d, amount)
    else if (period === 'year') nextDate = addYears(d, amount)
    setReferenceDate(format(nextDate, 'yyyy-MM-dd'))
  }

  const getPeriodLabel = () => {
    const d = new Date(referenceDate + 'T12:00:00')
    if (period === 'day') {
      return format(d, 'MMMM d, yyyy')
    }
    if (period === 'week') {
      const start = startOfWeek(d, { weekStartsOn: 1 })
      const end = endOfWeek(d, { weekStartsOn: 1 })
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    }
    if (period === 'month') {
      return format(d, 'MMMM yyyy')
    }
    return format(d, 'yyyy')
  }

  const dateRange = useMemo(() => {
    const d = new Date(referenceDate + 'T12:00:00')
    let from = referenceDate
    let to = referenceDate
    if (period === 'day') {
      from = referenceDate
      to = referenceDate
    } else if (period === 'week') {
      from = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      to = format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    } else if (period === 'month') {
      from = format(startOfMonth(d), 'yyyy-MM-dd')
      to = format(endOfMonth(d), 'yyyy-MM-dd')
    } else if (period === 'year') {
      from = format(startOfYear(d), 'yyyy-MM-dd')
      to = format(endOfYear(d), 'yyyy-MM-dd')
    }
    return { from, to }
  }, [referenceDate, period])

  return (
    <div className="space-y-4 lg:max-w-5xl px-4 md:px-0">
      <header>
        <h1 className="text-2xl font-display text-text">Finance</h1>
      </header>

      {/* ── Tab bar ──────────────────────────────────────────────────────
          Grid with 4 columns: guarantees items span full width and fit on mobile.
          Only active item shows text.                                  */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 border border-border rounded-2xl">
        {TABS.map(tab => {
          const Icon    = tab.icon
          const isActive = active === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActive(tab.value)}
              className={clsx(
                'flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all duration-200 font-medium w-full text-xs sm:text-sm',
                isActive
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              {/* Label: always visible on sm+, only on active on mobile */}
              <span className={clsx(
                'text-xs sm:text-sm',
                isActive ? 'inline' : 'hidden sm:inline'
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Timeframe selector (only for overview and transactions tabs) ── */}
      {(active === 'overview' || active === 'transactions') && (
        <div className="flex flex-col gap-3 bg-surface border border-border p-3.5 rounded-2xl shadow-sm">
          {/* Day/Week/Month/Year selector */}
          <div className="flex p-1 bg-surface-2 border border-border rounded-xl">
            {(['day', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p)
                  setReferenceDate(today)
                }}
                className={clsx(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                  period === p ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Timeframe navigation controls */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => adjustPeriod('prev')}
              className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-text">
              {getPeriodLabel()}
            </span>
            <button
              onClick={() => adjustPeriod('next')}
              className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-200">
        {active === 'overview'     && (
          <OverviewTab
            currency={currency}
            from={dateRange.from}
            to={dateRange.to}
            period={period}
          />
        )}
        {active === 'accounts'     && <AccountsTab     currency={currency} />}
        {active === 'transactions' && (
          <TransactionsTab
            currency={currency}
            from={dateRange.from}
            to={dateRange.to}
          />
        )}
        {active === 'budgets'      && <BudgetsTab      currency={currency} />}
      </div>
    </div>
  )
}
