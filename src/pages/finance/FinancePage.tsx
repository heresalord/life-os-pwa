import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Landmark, List, Target, ChevronLeft, ChevronRight, Wallet as WalletIcon } from 'lucide-react'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useWallets } from '../../hooks/useFinanceQueries'
import type { Wallet } from '../../db/schema'
import { OverviewTab }     from './components/OverviewTab'
import { AccountsTab }     from './components/AccountsTab'
import { TransactionsTab } from './components/TransactionsTab'
import { BudgetsTab }      from './components/BudgetsTab'
import { useAppStore } from '../../store/useAppStore'
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

  const { timezone, headerAddTrigger } = useAppStore()
  const today = getUserLocalDate(timezone)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [referenceDate, setReferenceDate] = useState<string>(today)
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

  // Header "+" tap: jump to the Activity tab (where the add form lives) and open it,
  // regardless of which tab was active when it was tapped.
  useEffect(() => {
    if (headerAddTrigger > 0) {
      setActive('transactions')
      setAddOpen(true)
    }
  }, [headerAddTrigger])

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
    <div className="space-y-4 lg:max-w-5xl lg:mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">{t('finance.title', 'Finance')}</h1>
        </div>
      </header>

      {/* Hero net worth balance card */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Total Net Balance</p>
          <p className={clsx('text-2xl font-display font-bold mt-0.5', netWorth >= 0 ? 'text-text' : 'text-danger')}>
            {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs text-text-muted font-body font-normal ml-1">{primaryCurrency}</span>
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
          <WalletIcon size={18} />
        </div>
      </div>

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
                {t(tab.labelKey, tab.defaultLabel)}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Timeframe selector ────────────────────────────────────── */}
      {(active === 'overview' || active === 'transactions') && (
        <div className="flex items-center justify-between gap-2 mb-1">
          {/* Period pills */}
          <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
            {(['day', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setReferenceDate(today) }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
                  period === p ? 'bg-bg text-text shadow-sm' : 'text-text-muted hover:text-text'
                )}
              >
                {t(`finance.period_${p}`, p)}
              </button>
            ))}
          </div>

          {/* Prev / label / next */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjustPeriod('prev')}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium text-text min-w-[90px] text-center">{getPeriodLabel()}</span>
            <button
              onClick={() => adjustPeriod('next')}
              disabled={isAtCurrentOrFuturePeriod}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={15} />
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
          <TransactionsTab currency={currency} from={dateRange.from} to={dateRange.to} today={today} highlightId={highlightId} addOpen={addOpen} onAddOpenChange={setAddOpen} />
        )}
        {active === 'budgets' && <BudgetsTab currency={currency} />}
      </div>
    </div>
  )
}
