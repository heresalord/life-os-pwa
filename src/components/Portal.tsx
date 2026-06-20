import { createPortal } from 'react-dom'

/**
 * Portal
 *
 * Renders children into document.body, escaping any ancestor CSS transforms
 * (e.g. page-enter animation) that would otherwise break `position: fixed`
 * children by making them relative to the animated container instead of
 * the viewport.
 *
 * React portals still maintain the full component tree for context/state,
 * so all hooks and providers work as normal inside a Portal.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}
