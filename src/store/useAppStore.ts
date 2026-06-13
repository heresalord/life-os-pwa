import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'
import { getAccentShades } from '../lib/colorUtils'

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
  accentColor: string | null
  navItems: string[]
  quoteIntervalHours: number
  setSelectedDate: (date: string) => void
  setDate: (date: string) => void
  setTimezone: (tz: string) => void
  setTheme: (theme: Theme) => void
  setAccentColor: (color: string | null) => void
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

// Apply (or clear) a custom accent color by overriding the CSS variables
// that the theme normally sets in :root. Inline styles on <html> win over
// any stylesheet rule, so this works regardless of the active theme.
function applyAccentColor(color: string | null) {
  const root = document.documentElement
  if (!color) {
    root.style.removeProperty('--theme-accent')
    root.style.removeProperty('--theme-accent-dim')
    root.style.removeProperty('--theme-accent-glow')
    localStorage.removeItem('lifeos-accent')
    return
  }
  const { accent, accentDim, accentGlow } = getAccentShades(color)
  root.style.setProperty('--theme-accent', accent)
  root.style.setProperty('--theme-accent-dim', accentDim)
  root.style.setProperty('--theme-accent-glow', accentGlow)
  localStorage.setItem('lifeos-accent', color)
}

const savedAccent = localStorage.getItem('lifeos-accent')
if (savedAccent) applyAccentColor(savedAccent)

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export const useAppStore = create<AppState>((set, get) => ({
  timezone: defaultTimezone,
  selectedDate: getUserLocalDate(defaultTimezone),
  theme: savedTheme,
  accentColor: savedAccent,
  navItems: loadNavItems(),
  quoteIntervalHours: loadQuoteInterval(),

  setSelectedDate: (date) => set({ selectedDate: date }),
  setDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => set({ timezone: tz }),
  setTheme: (theme) => { applyTheme(theme); set({ theme }) },
  setAccentColor: (color) => { applyAccentColor(color); set({ accentColor: color }) },

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
