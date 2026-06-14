import { create } from 'zustand'
import { getUserLocalDate } from '../lib/dateUtils'
import { getAccentShades } from '../lib/colorUtils'

export type Theme = 'dark' | 'light'
export type AutoTheme = 'off' | 'time' | 'system'

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
  autoTheme: AutoTheme
  setAutoTheme: (mode: AutoTheme) => void
  setAccentColor: (color: string | null) => void
  setNavItems: (items: string[]) => void
  setQuoteIntervalHours: (h: number) => void
  resetToToday: () => void
}

// Apply theme visually to <html> and the PWA theme-color meta tag.
// Does NOT write to localStorage — callers that persist the choice do so explicitly.
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Keep the PWA status-bar theme-color in sync
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = theme === 'light' ? '#fcfbfa' : '#0a0a0a'
}

// ── Auto-theme helpers ────────────────────────────────────────────────────────
function getThemeForTime(): Theme {
  const h = new Date().getHours()
  return h >= 6 && h < 19 ? 'light' : 'dark'
}
function getThemeForSystem(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
const savedAutoTheme = (localStorage.getItem('lifeos-auto-theme') ?? 'off') as AutoTheme
function resolveTheme(auto: AutoTheme, manual: Theme): Theme {
  if (auto === 'time')   return getThemeForTime()
  if (auto === 'system') return getThemeForSystem()
  return manual
}
const savedManualTheme = (localStorage.getItem('lifeos-theme') ?? 'dark') as Theme
const initialTheme = resolveTheme(savedAutoTheme, savedManualTheme)
applyTheme(initialTheme)

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
  theme: initialTheme,
  autoTheme: savedAutoTheme,
  accentColor: savedAccent,
  navItems: loadNavItems(),
  quoteIntervalHours: loadQuoteInterval(),

  setSelectedDate: (date) => set({ selectedDate: date }),
  setDate: (date) => set({ selectedDate: date }),
  setTimezone: (tz) => set({ timezone: tz }),
  setTheme: (theme) => {
    // Switching manually cancels any active auto-theme
    clearInterval((window as any).__lifeos_theme_tick)
    const prevListener = (window as any).__lifeos_system_listener
    if (prevListener) {
      window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', prevListener)
      delete (window as any).__lifeos_system_listener
    }
    localStorage.setItem('lifeos-theme', theme)
    localStorage.setItem('lifeos-auto-theme', 'off')
    applyTheme(theme)
    set({ theme, autoTheme: 'off' })
  },
  setAutoTheme: (mode) => {
    localStorage.setItem('lifeos-auto-theme', mode)
    const resolved = resolveTheme(mode, get().theme)
    applyTheme(resolved)
    set({ autoTheme: mode, theme: resolved })
    // Clear any running time-tick or system-listener from a previous mode
    clearInterval((window as any).__lifeos_theme_tick)
    const prevListener = (window as any).__lifeos_system_listener
    if (prevListener) {
      window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', prevListener)
      delete (window as any).__lifeos_system_listener
    }
    if (mode === 'time') {
      ;(window as any).__lifeos_theme_tick = setInterval(() => {
        const t = getThemeForTime()
        if (useAppStore.getState().theme !== t) { applyTheme(t); useAppStore.setState({ theme: t }) }
      }, 60_000)
    } else if (mode === 'system') {
      const listener = (e: MediaQueryListEvent) => {
        const t: Theme = e.matches ? 'light' : 'dark'
        applyTheme(t)
        useAppStore.setState({ theme: t })
      }
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', listener)
      ;(window as any).__lifeos_system_listener = listener
    }
  },
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
