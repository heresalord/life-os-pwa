import { useEffect } from 'react'

/**
 * Scrolls to and briefly highlights the element with
 * `data-item-id={highlightId}` once it's available in the DOM.
 *
 * Used by search result deep links: `/tasks?highlight=<id>`,
 * `/notes?highlight=<id>`, `/finance?highlight=<id>`, `/inbox?highlight=<id>`.
 */
export function useScrollToHighlight(highlightId: string | null | undefined, ready = true) {
  useEffect(() => {
    if (!highlightId || !ready) return

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${highlightId}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('search-highlight')
      const remove = setTimeout(() => el.classList.remove('search-highlight'), 2200)
      return () => clearTimeout(remove)
    }, 250)

    return () => clearTimeout(timer)
  }, [highlightId, ready])
}
