import Dexie, { type Table } from 'dexie'
import type { 
  SyncQueueItem, Task, Transaction, Goal, GoalEvent, 
  Book, Quote, AgendaBlock, InboxItem, Note, 
  DailyRecord, UserProfile, UserSettings 
} from './schema'

export class LifeOSDatabase extends Dexie {
  sync_queue!: Table<SyncQueueItem, string>
  tasks!: Table<Task, string>
  transactions!: Table<Transaction, string>
  goals!: Table<Goal, string>
  goal_events!: Table<GoalEvent, string>
  books!: Table<Book, string>
  quotes!: Table<Quote, string>
  agenda_blocks!: Table<AgendaBlock, string>
  inbox_items!: Table<InboxItem, string>
  notes!: Table<Note, string>
  daily_records!: Table<DailyRecord, string>
  user_profiles!: Table<UserProfile, string>
  user_settings!: Table<UserSettings, string>

  constructor() {
    super('LifeOSDB')
    this.version(1).stores({
      sync_queue: 'id, table, operation, created_at, synced',
      tasks: 'id, user_id, date, completed, skipped, priority, created_at',
      transactions: 'id, user_id, date, type, category',
      goals: 'id, user_id, state',
      goal_events: 'id, user_id, goal_id, date',
      books: 'id, user_id, status',
      quotes: 'id, user_id, book_id',
      agenda_blocks: 'id, user_id, date',
      inbox_items: 'id, user_id, processed',
      notes: 'id, user_id, date',
      daily_records: 'id, user_id, date',
      user_profiles: 'id',
      user_settings: 'user_id'
    })
  }
}

export const db = new LifeOSDatabase()
