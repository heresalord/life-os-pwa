import { useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { hapticLight } from '../../lib/haptics'
import { ROUTES_WITH_ADD_ACTION } from '../../lib/constants'

export function ContextualFAB() {
  const location = useLocation()

  // Only show floating add button on pages with an actionable add workflow
  const shouldShow = ROUTES_WITH_ADD_ACTION.has(location.pathname)

  if (!shouldShow) return null

  const handleClick = () => {
    hapticLight()
    useAppStore.getState().triggerHeaderAdd()
  }

  return (
    <button
      id="contextual-fab"
      onClick={handleClick}
      aria-label="Add item"
      className="fixed bottom-[5.5rem] right-4 z-40 w-14 h-14 rounded-full bg-accent text-bg shadow-lg shadow-accent/30 flex items-center justify-center hover:bg-accent-dim active:scale-95 transition-all"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  )
}
