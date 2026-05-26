import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'

export interface AppState {
  selectedDate: string
  timezone: string
  setSelectedDate: (date: string) => void
  setDate: (date: string) => void  // alias used by some pages
  setTimezone: (tz: string) => void
  resetToToday: () => void
}

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export const useAppStore = create<AppState>((set, get) => ({
  timezone: defaultTimezone,
  selectedDate: getUserLocalDate(defaultTimezone),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => set({ timezone: tz }),
  resetToToday: () => set({ selectedDate: getUserLocalDate(get().timezone) })
}))
