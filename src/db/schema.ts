import type { Database } from '../types/database'

export interface SyncQueueItem {
  id: string; // uuid
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  created_at: number;
  retries: number;
  synced: boolean;
}

export type Task = Database['public']['Tables']['tasks']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalEvent = Database['public']['Tables']['goal_events']['Row']
export type HabitLog = Database['public']['Tables']['habit_logs']['Row']
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type Book = Database['public']['Tables']['books']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type ReadingGoal = Database['public']['Tables']['reading_goals']['Row']
export type AgendaBlock = Database['public']['Tables']['agenda_blocks']['Row']
export type InboxItem = Database['public']['Tables']['inbox_items']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type DailyRecord = Database['public']['Tables']['daily_records']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type Wallet = Database['public']['Tables']['wallets']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']
export type Debt = Database['public']['Tables']['debts']['Row']
export type Project = Database['public']['Tables']['projects']['Row']

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  read_at?: string | null
  action_url: string | null
  payload?: Record<string, any> | null
  created_at: string
}

export interface NotificationPreference {
  user_id: string
  event_type: string
  in_app: boolean
  email: boolean
  push: boolean
  created_at?: string
  updated_at?: string
}

export type Device = Database['public']['Tables']['devices']['Row']
export type NoteVersion = Database['public']['Tables']['note_versions']['Row']
export type FriendRequest = Database['public']['Tables']['friend_requests']['Row']
export type Friendship = Database['public']['Tables']['friendships']['Row']
export type Block = Database['public']['Tables']['blocks']['Row']

export interface OutboxRow {
  seq?: number
  id: string
  row_key: string // e.g. "notes:c3e6..."
  table: string
  op: 'insert' | 'update' | 'delete'
  row_id: string
  patch: Record<string, unknown>
  base_updated_at?: string | null
  attempts: number
  last_error?: string | null
  status: 'pending' | 'inflight' | 'failed' | 'blocked'
  created_at: string
  next_retry_at?: number
}

export interface SyncStateRow {
  table: string
  cursor: string
  last_pull_at?: string
}


