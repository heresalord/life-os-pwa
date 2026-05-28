export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          timezone: string
          onboarded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          timezone?: string
          onboarded?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          timezone?: string
          onboarded?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          currency: string
          daily_budget: number
          expense_categories: string[]
          income_categories: string[]
          category_budgets: Json
          theme: string
          morning_reminder_time: string | null
          night_reminder_time: string | null
          notifications_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          currency?: string
          daily_budget?: number
          expense_categories?: string[]
          income_categories?: string[]
          category_budgets?: Json
          theme?: string
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          notifications_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          currency?: string
          daily_budget?: number
          expense_categories?: string[]
          income_categories?: string[]
          category_budgets?: Json
          theme?: string
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          notifications_enabled?: boolean
          updated_at?: string
        }
      }
      daily_records: {
        Row: {
          id: string
          user_id: string
          date: string
          mood: number | null
          intent: string | null
          reflections: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          mood?: number | null
          intent?: string | null
          reflections?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          mood?: number | null
          intent?: string | null
          reflections?: Json
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          date: string
          title: string
          completed: boolean
          skipped: boolean
          priority: number | null
          completed_at: string | null
          skipped_at: string | null
          carried_from: string | null
          from_inbox_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          title: string
          completed?: boolean
          skipped?: boolean
          priority?: number | null
          completed_at?: string | null
          skipped_at?: string | null
          carried_from?: string | null
          from_inbox_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          title?: string
          completed?: boolean
          skipped?: boolean
          priority?: number | null
          completed_at?: string | null
          skipped_at?: string | null
          carried_from?: string | null
          from_inbox_id?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          date: string
          type: 'expense' | 'income'
          amount: number
          category: string
          method: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          type: 'expense' | 'income'
          amount: number
          category: string
          method: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          type?: 'expense' | 'income'
          amount?: number
          category?: string
          method?: string
          description?: string | null
          created_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          goal_type: 'year' | 'general' | 'binary'
          measurement_type: 'count' | 'currency' | 'time' | 'percentage' | 'binary'
          target: number | null
          currency: string | null
          start_date: string | null
          end_date: string | null
          state: 'active' | 'paused' | 'completed' | 'abandoned'
          is_completed: boolean
          sub_goals: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          goal_type: 'year' | 'general' | 'binary'
          measurement_type: 'count' | 'currency' | 'time' | 'percentage' | 'binary'
          target?: number | null
          currency?: string | null
          start_date?: string | null
          end_date?: string | null
          state?: 'active' | 'paused' | 'completed' | 'abandoned'
          is_completed?: boolean
          sub_goals?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          goal_type?: 'year' | 'general' | 'binary'
          measurement_type?: 'count' | 'currency' | 'time' | 'percentage' | 'binary'
          target?: number | null
          currency?: string | null
          start_date?: string | null
          end_date?: string | null
          state?: 'active' | 'paused' | 'completed' | 'abandoned'
          is_completed?: boolean
          sub_goals?: Json
          created_at?: string
          updated_at?: string
        }
      }
      goal_events: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          sub_goal_id: string | null
          event_type: 'add' | 'subtract' | 'state_change' | 'target_change' | 'complete'
          value: number
          date: string
          note: string | null
          new_state: string | null
          old_target: number | null
          new_target: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id: string
          sub_goal_id?: string | null
          event_type: 'add' | 'subtract' | 'state_change' | 'target_change' | 'complete'
          value?: number
          date: string
          note?: string | null
          new_state?: string | null
          old_target?: number | null
          new_target?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string
          sub_goal_id?: string | null
          event_type?: 'add' | 'subtract' | 'state_change' | 'target_change' | 'complete'
          value?: number
          date?: string
          note?: string | null
          new_state?: string | null
          old_target?: number | null
          new_target?: number | null
          created_at?: string
        }
      }
      books: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string | null
          status: 'to-read' | 'reading' | 'finished' | 'abandoned'
          started_at: string | null
          finished_at: string | null
          current_page: number
          total_pages: number | null
          cover_url: string | null
          tags: string[]
          reflection: string | null
          abandon_reason: string | null
          added_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          author?: string | null
          status?: 'to-read' | 'reading' | 'finished' | 'abandoned'
          started_at?: string | null
          finished_at?: string | null
          current_page?: number
          total_pages?: number | null
          cover_url?: string | null
          tags?: string[]
          reflection?: string | null
          abandon_reason?: string | null
          added_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          author?: string | null
          status?: 'to-read' | 'reading' | 'finished' | 'abandoned'
          started_at?: string | null
          finished_at?: string | null
          current_page?: number
          total_pages?: number | null
          cover_url?: string | null
          tags?: string[]
          reflection?: string | null
          abandon_reason?: string | null
          added_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          book_id: string
          text: string
          page: number | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          text: string
          page?: number | null
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          book_id?: string
          text?: string
          page?: number | null
          date?: string
          created_at?: string
        }
      }
      agenda_blocks: {
        Row: {
          id: string
          user_id: string
          date: string
          start_time: string
          end_time: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          start_time: string
          end_time: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: string
          end_time?: string
          description?: string
          created_at?: string
        }
      }
      inbox_items: {
        Row: {
          id: string
          user_id: string
          text: string
          type: 'thought' | 'idea' | 'worry' | 'todo' | 'other'
          processed: boolean
          processed_at: string | null
          processed_to: 'task' | 'note' | 'handled' | null
          archived_at: string | null
          captured_at: string
        }
        Insert: {
          id?: string
          user_id: string
          text: string
          type?: 'thought' | 'idea' | 'worry' | 'todo' | 'other'
          processed?: boolean
          processed_at?: string | null
          processed_to?: 'task' | 'note' | 'handled' | null
          archived_at?: string | null
          captured_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          text?: string
          type?: 'thought' | 'idea' | 'worry' | 'todo' | 'other'
          processed?: boolean
          processed_at?: string | null
          processed_to?: 'task' | 'note' | 'handled' | null
          archived_at?: string | null
          captured_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          date: string
          title: string
          content: string
          template: 'morning' | 'night' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          title: string
          content?: string
          template?: 'morning' | 'night' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          title?: string
          content?: string
          template?: 'morning' | 'night' | null
          created_at?: string
          updated_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: Json
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          keys: Json
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          keys?: Json
          user_agent?: string | null
          created_at?: string
        }
      }
    }
  }
}
