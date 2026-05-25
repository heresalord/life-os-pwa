import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'

interface AppState {
  selectedDate: string
  timezone: string
  setSelectedDate: (date: string) => void
  setTimezone: (tz: string) => void
  resetToToday: () => void
}

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export const useAppStore = create<AppState>((set, get) => ({
  timezone: defaultTimezone,
  selectedDate: getUserLocalDate(defaultTimezone),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => {
    set({ timezone: tz })
    // Only update date if it was originally matching today in the old timezone
    // For simplicity, we just keep the currently selected string date.
  },
  resetToToday: () => set({ selectedDate: getUserLocalDate(get().timezone) })
}))
