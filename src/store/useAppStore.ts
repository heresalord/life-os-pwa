import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'

export type Theme = 'dark' | 'light'

export const DEFAULT_NAV_ITEMS = ['tasks', 'finance', 'goals', 'books']

function loadNavItems(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem('lifeos-nav') || 'null')
    // Accept any non-empty array (was wrongly requiring exactly 4)
    if (Array.isArray(stored) && stored.length >= 1) return stored
  } catch {}
  return DEFAULT_NAV_ITEMS
}

function loadQuoteInterval(): number {
  return parseInt(localStorage.getItem('lifeos-quote-interval') || '1', 10) || 1
}

export interface AppState {
  selectedDate: string
  timezone: string
  theme: Theme
  navItems: string[]
  quoteIntervalHours: number
  setSelectedDate: (date: string) => void
  setDate: (date: string) => void
  setTimezone: (tz: string) => void
  setTheme: (theme: Theme) => void
  setNavItems: (items: string[]) => void
  setQuoteIntervalHours: (h: number) => void
  resetToToday: () => void
}

// Apply theme to <html>, localStorage, and the PWA theme-color meta tag
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('lifeos-theme', theme)
  // Keep the PWA status-bar theme-color in sync
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = theme === 'light' ? '#fcfbfa' : '#0a0a0a'
}

// Default is 'dark' — matches the index.html inline script and the :root CSS
const savedTheme = (localStorage.getItem('lifeos-theme') as Theme) || 'dark'
applyTheme(savedTheme)

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export const useAppStore = create<AppState>((set, get) => ({
  timezone: defaultTimezone,
  selectedDate: getUserLocalDate(defaultTimezone),
  theme: savedTheme,
  navItems: loadNavItems(),
  quoteIntervalHours: loadQuoteInterval(),

  setSelectedDate: (date) => set({ selectedDate: date }),
  setDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => set({ timezone: tz }),
  setTheme: (theme) => { applyTheme(theme); set({ theme }) },

  setNavItems: (items) => {
    localStorage.setItem('lifeos-nav', JSON.stringify(items))
    set({ navItems: items })
  },
  setQuoteIntervalHours: (h) => {
    localStorage.setItem('lifeos-quote-interval', String(h))
    set({ quoteIntervalHours: h })
  },

  resetToToday: () => set({ selectedDate: getUserLocalDate(get().timezone) }),
}))
