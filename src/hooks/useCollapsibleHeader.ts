import { useEffect, useRef, useState } from 'react'

/**
 * useCollapsibleHeader - IntersectionObserver-based hook to collapse page headers.
 * Place the returned `sentinelRef` on a zero-height element immediately after
 * the large page header. When the user scrolls past the header and the sentinel
 * goes out of view, `isCollapsed` becomes true.
 */
export function useCollapsibleHeader() {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // sentinel is out of view (scrolled above top of viewport)
        setIsCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      {
        root: null, // viewport
        threshold: 0,
      }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [])

  return { sentinelRef, isCollapsed }
}
