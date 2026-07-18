import { useNavigate } from 'react-router-dom'
import { Inbox, ChevronRight } from 'lucide-react'
import { useInboxQuery } from '../../../hooks/useInboxQuery'

export function InboxWidget() {
  const navigate = useNavigate()
  const { data: inboxItems = [], isLoading } = useInboxQuery(false)

  // Take the 3 most recent unprocessed items
  const recentInbox = inboxItems.slice(0, 3)

  return (
    <div
      onClick={() => navigate('/inbox')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Inbox size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Inbox Quick View</span>
        </div>
        <span className="text-[10px] text-text-muted">{inboxItems.length} unprocessed</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : inboxItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <p className="text-xs italic">Inbox is clear! ✨</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to capture a thought or task</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentInbox.map(item => {
              // Try to format date
              let formattedDate = ''
              try {
                if (item.captured_at) {
                  formattedDate = new Date(item.captured_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              } catch { /* date formatting failed — formattedDate stays empty */ }

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-surface-2/60 border border-border/40 hover:bg-surface-2 rounded-xl transition-colors group/item"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-xs text-text-secondary font-medium truncate group-hover/item:text-text transition-colors">
                      {item.text}
                    </p>
                    <p className="text-[10px] text-text-muted capitalize">
                      {item.type} {formattedDate ? `· ${formattedDate}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={12} className="text-text-muted opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
