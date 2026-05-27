import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'

export type Theme = 'dark' | 'light'

export interface AppState {
  selectedDate: string
  timezone: string
  theme: Theme
  setSelectedDate: (date: string) => void
  setDate: (date: string) => void
  setTimezone: (tz: string) => void
  setTheme: (theme: Theme) => void
  resetToToday: () => void
}

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

// Apply theme to <html> and persist
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('lifeos-theme', theme)
}

const savedTheme = (localStorage.getItem('lifeos-theme') as Theme) || 'dark'
applyTheme(savedTheme)

export const useAppStore = create<AppState>((set, get) => ({
  timezone: defaultTimezone,
  selectedDate: getUserLocalDate(defaultTimezone),
  theme: savedTheme,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => set({ timezone: tz }),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  resetToToday: () => set({ selectedDate: getUserLocalDate(get().timezone) })
}))
