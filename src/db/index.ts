import Dexie, { type Table } from 'dexie'
import type {
  SyncQueueItem, Task, Transaction, Goal, GoalEvent,
  Book, Quote, AgendaBlock, InboxItem, Note,
  DailyRecord, UserProfile, UserSettings,
  Wallet, Budget, SavingsGoal, Debt, Project,
  HabitLog, Milestone, ReadingGoal, Notification
} from './schema'

export interface RecurringTask {
  id: string
  user_id: string
  title: string
  priority: number | null
  repeat: 'daily' | 'weekdays' | 'weekly' | 'weekends'
  day_of_week?: number    // 0=Sun … 6=Sat, used when repeat='weekly'
  active: boolean
  created_at: string
}

export class LifeOSDatabase extends Dexie {
  sync_queue!:      Table<SyncQueueItem,  string>
  tasks!:           Table<Task,           string>
  transactions!:    Table<Transaction,    string>
  goals!:           Table<Goal,           string>
  goal_events!:     Table<GoalEvent,      string>
  books!:           Table<Book,           string>
  quotes!:          Table<Quote,          string>
  agenda_blocks!:   Table<AgendaBlock,    string>
  inbox_items!:     Table<InboxItem,      string>
  notes!:           Table<Note,           string>
  daily_records!:   Table<DailyRecord,    string>
  user_profiles!:   Table<UserProfile,    string>
  user_settings!:   Table<UserSettings,   string>
  recurring_tasks!: Table<RecurringTask,  string>
  wallets!:         Table<Wallet,         string>
  budgets!:         Table<Budget,         string>
  savings_goals!:   Table<SavingsGoal,    string>
  debts!:           Table<Debt,           string>
  projects!:        Table<Project,        string>
  habit_logs!:      Table<HabitLog,       string>
  milestones!:      Table<Milestone,      string>
  reading_goals!:   Table<ReadingGoal,    string>
  notifications!:   Table<Notification,   string>

  constructor() {
    super('LifeOSDB')
    this.version(1).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, created_at',
      transactions:  'id, user_id, date, type, category',
      goals:         'id, user_id, state',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
    })
    this.version(2).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, created_at',
      transactions:  'id, user_id, date, type, category',
      goals:         'id, user_id, state',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
    })
    this.version(3).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
    })
    this.version(4).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
    })
    this.version(5).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
    })
    this.version(6).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state, tracker_type, category',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
      habit_logs:    'id, user_id, goal_id, date',
      milestones:    'id, user_id, goal_id, completed, due_date',
    })
    this.version(7).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state, tracker_type, category',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
      habit_logs:    'id, user_id, goal_id, date',
      milestones:    'id, user_id, goal_id, completed, due_date',
    })
    this.version(8).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state, tracker_type, category',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
      habit_logs:    'id, user_id, goal_id, date',
      milestones:    'id, user_id, goal_id, completed, due_date',
      reading_goals: 'id, user_id, year',
    })
    this.version(9).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state, tracker_type, category',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date, pinned, folder',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
      habit_logs:    'id, user_id, goal_id, date',
      milestones:    'id, user_id, goal_id, completed, due_date',
      reading_goals: 'id, user_id, year',
    })
    this.version(10).stores({
      sync_queue:    'id, table, operation, created_at, synced',
      tasks:         'id, user_id, date, completed, skipped, priority, kanban_status, project_id, created_at',
      transactions:  'id, user_id, date, type, category, wallet_id',
      goals:         'id, user_id, state, tracker_type, category',
      goal_events:   'id, user_id, goal_id, date',
      books:         'id, user_id, status',
      quotes:        'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items:   'id, user_id, processed',
      notes:         'id, user_id, date, pinned, folder',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id',
      recurring_tasks: 'id, user_id, active, repeat',
      wallets:       'id, user_id, type, archived',
      budgets:       'id, user_id, category, period',
      savings_goals: 'id, user_id, deadline',
      debts:         'id, user_id, type, due_date',
      projects:      'id, user_id, archived',
      habit_logs:    'id, user_id, goal_id, date',
      milestones:    'id, user_id, goal_id, completed, due_date',
      reading_goals: 'id, user_id, year',
      notifications: 'id, user_id, read, created_at',
    })
  }
}

export const db = new LifeOSDatabase()
