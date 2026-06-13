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
          accent_color: string | null
          morning_reminder_time: string | null
          night_reminder_time: string | null
          notifications_enabled: boolean
          dashboard_widgets: Json
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
          accent_color?: string | null
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          notifications_enabled?: boolean
          dashboard_widgets?: Json
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
          accent_color?: string | null
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          notifications_enabled?: boolean
          dashboard_widgets?: Json
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
          energy_am: number | null
          energy_pm: number | null
          gratitude: Json
          win_of_day: string | null
          went_well: string | null
          do_differently: string | null
          tomorrow_focus: string | null
          morning_complete: boolean
          evening_complete: boolean
          day_score: number | null
          journal: string | null
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
          energy_am?: number | null
          energy_pm?: number | null
          gratitude?: Json
          win_of_day?: string | null
          went_well?: string | null
          do_differently?: string | null
          tomorrow_focus?: string | null
          morning_complete?: boolean
          evening_complete?: boolean
          day_score?: number | null
          journal?: string | null
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
          energy_am?: number | null
          energy_pm?: number | null
          gratitude?: Json
          win_of_day?: string | null
          went_well?: string | null
          do_differently?: string | null
          tomorrow_focus?: string | null
          morning_complete?: boolean
          evening_complete?: boolean
          day_score?: number | null
          journal?: string | null
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
          due_date: string | null
          description: string | null
          tags: Json
          subtasks: Json
          kanban_status: 'backlog' | 'todo' | 'in_progress' | 'done'
          project_id: string | null
          time_block_start: string | null
          time_block_end: string | null
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
          due_date?: string | null
          description?: string | null
          tags?: Json
          subtasks?: Json
          kanban_status?: 'backlog' | 'todo' | 'in_progress' | 'done'
          project_id?: string | null
          time_block_start?: string | null
          time_block_end?: string | null
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
          due_date?: string | null
          description?: string | null
          tags?: Json
          subtasks?: Json
          kanban_status?: 'backlog' | 'todo' | 'in_progress' | 'done'
          project_id?: string | null
          time_block_start?: string | null
          time_block_end?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          date: string
          type: 'expense' | 'income' | 'adjustment'
          amount: number
          category: string
          method: string
          description: string | null
          wallet_id: string | null
          transfer_to_wallet_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          type: 'expense' | 'income' | 'adjustment'
          amount: number
          category: string
          method: string
          description?: string | null
          wallet_id?: string | null
          transfer_to_wallet_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          type?: 'expense' | 'income' | 'adjustment'
          amount?: number
          category?: string
          method?: string
          description?: string | null
          wallet_id?: string | null
          transfer_to_wallet_id?: string | null
          notes?: string | null
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
          tracker_type: 'target' | 'habit' | 'average' | 'project'
          category: string | null
          habit_schedule: Json
          habit_streak: number
          last_checkin: string | null
          project_id: string | null
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
          tracker_type?: 'target' | 'habit' | 'average' | 'project'
          category?: string | null
          habit_schedule?: Json
          habit_streak?: number
          last_checkin?: string | null
          project_id?: string | null
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
          tracker_type?: 'target' | 'habit' | 'average' | 'project'
          category?: string | null
          habit_schedule?: Json
          habit_streak?: number
          last_checkin?: string | null
          project_id?: string | null
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
      habit_logs: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          date: string
          value: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id: string
          date: string
          value?: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string
          date?: string
          value?: number
          note?: string | null
          created_at?: string
        }
      }
      milestones: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          title: string
          completed: boolean
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id: string
          title: string
          completed?: boolean
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string
          title?: string
          completed?: boolean
          due_date?: string | null
          created_at?: string
          updated_at?: string
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
          rating: number | null
          tags: string[]
          reflection: string | null
          abandon_reason: string | null
          genre: string | null
          isbn: string | null
          language: string | null
          source: 'physical' | 'ebook' | 'audiobook' | 'library' | null
          reading_sessions: Json | null
          shelves: Json | null
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
          rating?: number | null
          tags?: string[]
          reflection?: string | null
          abandon_reason?: string | null
          genre?: string | null
          isbn?: string | null
          language?: string | null
          source?: 'physical' | 'ebook' | 'audiobook' | 'library' | null
          reading_sessions?: Json | null
          shelves?: Json | null
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
          rating?: number | null
          tags?: string[]
          reflection?: string | null
          abandon_reason?: string | null
          genre?: string | null
          isbn?: string | null
          language?: string | null
          source?: 'physical' | 'ebook' | 'audiobook' | 'library' | null
          reading_sessions?: Json | null
          shelves?: Json | null
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
      reading_goals: {
        Row: {
          id: string
          user_id: string
          year: number
          target_books: number
          target_pages: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          year: number
          target_books: number
          target_pages?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          year?: number
          target_books?: number
          target_pages?: number | null
          created_at?: string
          updated_at?: string
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
          all_day: boolean
          recurrence: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          start_time: string
          end_time: string
          description: string
          all_day?: boolean
          recurrence?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: string
          end_time?: string
          description?: string
          all_day?: boolean
          recurrence?: Json | null
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
          template: 'morning' | 'evening' | 'weekly-review' | 'gratitude' | 'book-notes' | 'meeting-notes' | null
          pinned: boolean
          folder: string
          word_count: number
          is_template: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          title: string
          content?: string
          template?: 'morning' | 'evening' | 'weekly-review' | 'gratitude' | 'book-notes' | 'meeting-notes' | null
          pinned?: boolean
          folder?: string
          word_count?: number
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          title?: string
          content?: string
          template?: 'morning' | 'evening' | 'weekly-review' | 'gratitude' | 'book-notes' | 'meeting-notes' | null
          pinned?: boolean
          folder?: string
          word_count?: number
          is_template?: boolean
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
      wallets: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'cash' | 'bank' | 'credit' | 'savings'
          currency: string
          balance: number
          color: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'cash' | 'bank' | 'credit' | 'savings'
          currency: string
          balance?: number
          color?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'cash' | 'bank' | 'credit' | 'savings'
          currency?: string
          balance?: number
          color?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category: string
          period: 'daily' | 'monthly' | 'yearly'
          limit_amount: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          period: 'daily' | 'monthly' | 'yearly'
          limit_amount: number
          currency: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          period?: 'daily' | 'monthly' | 'yearly'
          limit_amount?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target: number
          current: number
          currency: string
          deadline: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target: number
          current?: number
          currency: string
          deadline?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target?: number
          current?: number
          currency?: string
          deadline?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      debts: {
        Row: {
          id: string
          user_id: string
          name: string
          amount: number
          type: 'i_owe' | 'owe_me'
          due_date: string | null
          paid: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          amount: number
          type: 'i_owe' | 'owe_me'
          due_date?: string | null
          paid?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          amount?: number
          type?: 'i_owe' | 'owe_me'
          due_date?: string | null
          paid?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          description: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          description?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          description?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
