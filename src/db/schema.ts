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
