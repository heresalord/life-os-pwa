import { useUserSettings } from '../../hooks/useUserSettings'
import * as Tabs from '@radix-ui/react-tabs'
import { OverviewTab } from './components/OverviewTab'
import { TransactionsTab } from './components/TransactionsTab'
import { BudgetsTab } from './components/BudgetsTab'
import { SavingsTab } from './components/SavingsTab'
import { DebtsTab } from './components/DebtsTab'
import { Wallet, List, Target, PiggyBank, CreditCard } from 'lucide-react'

export function FinancePage() {
  const { data: settings } = useUserSettings()
  const currency = settings?.currency ?? 'USD'

  return (
    <div className="space-y-6 lg:max-w-5xl h-full flex flex-col">
      <header>
        <h1 className="text-2xl font-display text-text">Finance</h1>
      </header>

      <Tabs.Root defaultValue="overview" className="flex-1 flex flex-col gap-4">
        <Tabs.List className="flex overflow-x-auto gap-1 border-b border-border pb-2 scrollbar-none flex-shrink-0">
          <Tabs.Trigger value="overview" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full text-text-muted hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Wallet size={16} /> Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="transactions" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full text-text-muted hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <List size={16} /> Transactions
          </Tabs.Trigger>
          <Tabs.Trigger value="budgets" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full text-text-muted hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Target size={16} /> Budgets
          </Tabs.Trigger>
          <Tabs.Trigger value="savings" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full text-text-muted hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <PiggyBank size={16} /> Savings
          </Tabs.Trigger>
          <Tabs.Trigger value="debts" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full text-text-muted hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <CreditCard size={16} /> Debts
          </Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1 min-h-0">
          <Tabs.Content value="overview" className="h-full outline-none">
            <OverviewTab currency={currency} />
          </Tabs.Content>
          <Tabs.Content value="transactions" className="h-full outline-none">
            <TransactionsTab currency={currency} />
          </Tabs.Content>
          <Tabs.Content value="budgets" className="h-full outline-none">
            <BudgetsTab currency={currency} />
          </Tabs.Content>
          <Tabs.Content value="savings" className="h-full outline-none">
            <SavingsTab currency={currency} />
          </Tabs.Content>
          <Tabs.Content value="debts" className="h-full outline-none">
            <DebtsTab currency={currency} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
