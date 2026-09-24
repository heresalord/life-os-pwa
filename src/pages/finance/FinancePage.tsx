import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Landmark, List, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import { haptic } from '../../lib/haptic'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useWallets } from '../../hooks/useFinanceQueries'
import type { Wallet } from '../../db/schema'
import { OverviewTab }     from './components/OverviewTab'
import { AccountsTab }     from './components/AccountsTab'
import { TransactionsTab } from './components/TransactionsTab'
import { BudgetsTab }      from './components/BudgetsTab'
import { useAppStore } from '../../store/useAppStore'
import { useContextualAdd } from '../../hooks/useContextualAdd'
import { useTranslation } from '../../i18n'
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
  { value: 'overview',     icon: BarChart3, labelKey: 'finance.overview',     defaultLabel: 'Overview'     },
  { value: 'accounts',     icon: Landmark,  labelKey: 'finance.accounts',     defaultLabel: 'Accounts'     },
  { value: 'transactions', icon: List,      labelKey: 'finance.activity',     defaultLabel: 'Activity'     },
  { value: 'budgets',      icon: Target,    labelKey: 'finance.budgets',      defaultLabel: 'Budgets'      },
] as const

type TabValue = typeof TABS[number]['value']

export function FinancePage() {
  const { t } = useTranslation()
  const { data: settings } = useUserSettings()
  const currency = settings?.currency ?? 'USD'
  const [active, setActive] = useState<TabValue>('overview')

  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month')
  const [referenceDate, setReferenceDate] = useState<string>(today)
  const [customFrom, setCustomFrom] = useState<string>(today)
  const [customTo, setCustomTo] = useState<string>(today)
  const [addOpen, setAddOpen] = useState(false)

  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')

  // Live balance data
  const { data: wallets = [] } = useWallets()
  const activeWallets = wallets.filter(w => !w.archived)
  const liquidAccounts  = activeWallets.filter(w => w.type === 'bank' || w.type === 'cash')
  const savingsAccounts = activeWallets.filter(w => w.type === 'savings')
  const debtAccounts    = activeWallets.filter(w => w.type === 'credit')

  const liquidBalance  = liquidAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const savingsBalance = savingsAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const debtBalance    = debtAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const netWorth = liquidBalance + savingsBalance - debtBalance
  const primaryCurrency = activeWallets[0]?.currency || currency

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

  // Contextual "+" tap: jump to Activity tab and open add transaction form
  useContextualAdd(() => {
    setActive('transactions')
    setAddOpen(true)
  })

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
    if (period === 'custom') {
      if (customFrom === customTo) return format(new Date(customFrom + 'T12:00:00'), 'MMM d, yyyy')
      return `${format(new Date(customFrom + 'T12:00:00'), 'MMM d, yyyy')} – ${format(new Date(customTo + 'T12:00:00'), 'MMM d, yyyy')}`
    }
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
    if (period === 'custom') return { from: customFrom, to: customTo }
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
  }, [referenceDate, period, customFrom, customTo])

  return (
    <div className="space-y-4 lg:max-w-5xl lg:mx-auto">
      <header className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text tracking-tight">{t('finance.title', 'Finance')}</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Net worth · <span className={clsx('font-semibold', netWorth >= 0 ? 'text-text' : 'text-danger')}>
              {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {primaryCurrency}
            </span>
          </p>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 border border-border rounded-2xl">
        {TABS.map(tab => {
          const Icon     = tab.icon
          const isActive = active === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => {
                haptic('light')
                setActive(tab.value)
              }}
              className={clsx(
                'flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all duration-200 font-semibold w-full active:scale-[0.98]',
                isActive ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={clsx('text-xs sm:text-sm', isActive ? 'inline' : 'hidden sm:inline')}>
                {t(tab.labelKey, tab.defaultLabel)}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Timeframe selector ────────────────────────────────────── */}
      {(active === 'overview' || active === 'transactions') && (
        <div className="space-y-2 mb-1">
          <div className="flex items-center justify-between gap-2">
          {/* Period pills */}
          <div className="flex gap-1 bg-surface-2 rounded-xl p-1 overflow-x-auto">
            {(['day', 'week', 'month', 'year', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  haptic('light')
                  setPeriod(p)
                  if (p !== 'custom') setReferenceDate(today)
                  else { setCustomFrom(referenceDate); setCustomTo(referenceDate) }
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize whitespace-nowrap active:scale-95 cursor-pointer',
                  period === p ? 'bg-bg text-text shadow-xs' : 'text-text-muted hover:text-text'
                )}
              >
                {p === 'custom' ? 'Custom' : t(`finance.period_${p}`, p)}
              </button>
            ))}
          </div>

          {/* Prev / label / next — hidden for custom ranges */}
          {period !== 'custom' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                haptic('light')
                adjustPeriod('prev')
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary transition-all active:scale-90"
              aria-label="Previous period"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-text min-w-[90px] text-center select-none">{getPeriodLabel()}</span>
            <button
              onClick={() => {
                haptic('light')
                adjustPeriod('next')
              }}
              disabled={isAtCurrentOrFuturePeriod}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next period"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          )}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-surface border border-border rounded-xl p-2">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
              />
              <span className="text-text-muted text-xs flex-shrink-0">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={e => setCustomTo(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-200">
        {active === 'overview' && (
          <OverviewTab currency={currency} from={dateRange.from} to={dateRange.to} period={period} />
        )}
        {active === 'accounts' && <AccountsTab currency={currency} />}
        {active === 'transactions' && (
          <TransactionsTab currency={currency} from={dateRange.from} to={dateRange.to} today={today} highlightId={highlightId} addOpen={addOpen} onAddOpenChange={setAddOpen} />
        )}
        {active === 'budgets' && <BudgetsTab currency={currency} />}
      </div>
    </div>
  )
}
