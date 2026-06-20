import { useAppStore } from '../store/useAppStore'
import en from './locales/en.json'
import fr from './locales/fr.json'

const locales: Record<string, any> = { en, fr }

export function useTranslation() {
  const locale = useAppStore(state => state.locale)
  const setLocale = useAppStore(state => state.setLocale)

  const t = (key: string, defaultValue?: string): string => {
    const keys = key.split('.')
    let current = locales[locale] || locales['en']
    
    for (const k of keys) {
      if (current && typeof current === 'object') {
        current = current[k]
      } else {
        return defaultValue || key
      }
    }
    
    if (typeof current !== 'string') {
      return defaultValue || key
    }
    
    return current
  }

  return { t, locale, setLocale }
}
