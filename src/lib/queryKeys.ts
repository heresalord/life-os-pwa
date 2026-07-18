/**
 * queryKeys.ts — Phase 4: centralized React Query key definitions.
 *
 * Every `useQuery` queryKey and every `invalidateQueries` call in the app
 * must use a function from this file. This prevents the two failure modes
 * that scattered inline keys cause:
 *
 *   1. Silent invalidation misses — a mutation calls invalidateQueries with
 *      a key that doesn't match any live query because the shape diverged.
 *
 *   2. Refactoring drift — changing the shape of a key in one place breaks
 *      all callers that were inlined elsewhere.
 *
 * Convention:
 *   - Specific key  → used in useQuery's queryKey and setQueryData.
 *   - Prefix key    → used in invalidateQueries for broad invalidation.
 *     Prefix keys end with just the table name so they match all variants
 *     (any date, any filter) for that table + user combo. Since the app now
 *     uses user-scoped Dexie databases and clears React Query cache on
 *     signout, broad table-level invalidation is safe even without userId
 *     in the prefix.
 *
 * Key shape: ['table', ...filters, userId] — userId is always last so that
 * prefix-based invalidation on ['table'] catches all user variants.
 */

export const QK = {

  // ── Tasks ──────────────────────────────────────────────────────────────────
  tasks:    (date: string,   userId: string) => ['tasks', date, userId]             as const,
  tasksAll: ()                               => ['tasks']                            as const,

  // ── Goals ──────────────────────────────────────────────────────────────────
  goals:      (state: string, userId: string) => ['goals', state, userId]           as const,
  goalsAll:   ()                              => ['goals']                           as const,
  goal:       (id: string,    userId: string) => ['goal', id, userId]               as const,

  habitLogs:    (goalId: string | undefined, userId: string) => ['habit_logs', goalId, userId]   as const,
  habitLogsAll: ()                                           => ['habit_logs']                    as const,

  milestones:    (goalId: string | undefined, userId: string) => ['milestones', goalId, userId]  as const,
  milestonesAll: ()                                           => ['milestones']                   as const,

  goalEvents:    (goalIds: string[], userId: string) => ['goal_events', goalIds, userId]         as const,
  goalEventsAll: ()                                  => ['goal_events']                          as const,

  // ── Finance ────────────────────────────────────────────────────────────────
  wallets:           (userId: string)                           => ['wallets', userId]            as const,
  budgets:           (userId: string)                           => ['budgets', userId]            as const,
  savingsGoals:      (userId: string)                           => ['savings_goals', userId]      as const,
  debts:             (userId: string)                           => ['debts', userId]              as const,
  transactions:      (date: string,  userId: string)            => ['transactions', date, userId] as const,
  transactionsAll:   ()                                         => ['transactions']               as const,
  transactionsRange: (from: string,  to: string, userId: string)=> ['transactions_range', from, to, userId] as const,

  // ── Notes ──────────────────────────────────────────────────────────────────
  notes:    (date: string | undefined, userId: string) => ['notes', date, userId]  as const,
  notesAll: ()                                         => ['notes']                 as const,

  // ── Inbox ──────────────────────────────────────────────────────────────────
  inbox:    (processedOnly: boolean, userId: string) => ['inbox_items', processedOnly, userId]   as const,
  inboxAll: ()                                       => ['inbox_items']                           as const,

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: (userId: string) => ['projects', userId] as const,

  // ── Books ──────────────────────────────────────────────────────────────────
  books:        (userId: string)                        => ['books', userId]               as const,
  book:         (id: string, userId: string)            => ['book', id, userId]            as const,
  quotes:       (userId: string, bookId?: string | null)=> ['quotes', userId, bookId ?? 'all'] as const,
  readingGoals: (userId: string)                        => ['reading_goals', userId]       as const,

  // ── Agenda ─────────────────────────────────────────────────────────────────
  agenda:    (date: string, userId: string) => ['agenda_blocks', date, userId]  as const,
  agendaAll: ()                             => ['agenda_blocks']                 as const,

  // ── Daily Log ──────────────────────────────────────────────────────────────
  dailyRecord:       (date: string, userId: string)                     => ['daily_records', date, userId]              as const,
  dailyRecordsAll:   ()                                                 => ['daily_records']                             as const,
  dailyRecordsRange: (from: string, to: string, userId: string)         => ['daily_records_range', from, to, userId]    as const,

  // ── Settings ───────────────────────────────────────────────────────────────
  userSettings: (userId: string) => ['user_settings', userId] as const,
}
