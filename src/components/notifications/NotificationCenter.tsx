import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import {
  Bell, Sun, Moon, CheckSquare, Flame, AlertTriangle,
  Trophy, CalendarDays, Check, Circle, Sparkles
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

// Helper to map notification type to icon and colors
const getNotificationMeta = (type: string) => {
  switch (type) {
    case 'morning_reminder':
      return {
        icon: Sun,
        bgColor: 'bg-warning/10 border-warning/20',
        iconColor: 'text-warning'
      }
    case 'evening_reminder':
      return {
        icon: Moon,
        bgColor: 'bg-info/10 border-info/20',
        iconColor: 'text-info'
      }
    case 'task_due_today':
      return {
        icon: CheckSquare,
        bgColor: 'bg-accent/10 border-accent/20',
        iconColor: 'text-accent'
      }
    case 'task_overdue':
      return {
        icon: AlertTriangle,
        bgColor: 'bg-danger/10 border-danger/20',
        iconColor: 'text-danger'
      }
    case 'streak_alert':
      return {
        icon: Flame,
        bgColor: 'bg-orange-500/10 border-orange-500/20',
        iconColor: 'text-orange-500'
      }
    case 'budget_alert':
      return {
        icon: AlertTriangle,
        bgColor: 'bg-danger/15 border-danger/30',
        iconColor: 'text-danger'
      }
    case 'goal_milestone':
      return {
        icon: Trophy,
        bgColor: 'bg-success/10 border-success/20',
        iconColor: 'text-success'
      }
    case 'savings_goal_reached':
      return {
        icon: Sparkles,
        bgColor: 'bg-success/15 border-success/35',
        iconColor: 'text-success'
      }
    case 'weekly_review':
      return {
        icon: CalendarDays,
        bgColor: 'bg-primary/10 border-primary/20',
        iconColor: 'text-primary'
      }
    default:
      return {
        icon: Bell,
        bgColor: 'bg-surface-2 border-border',
        iconColor: 'text-text-muted'
      }
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = async (id: string, actionUrl: string | null) => {
    setIsOpen(false)
    await markAsRead.mutateAsync(id)
    if (actionUrl) {
      navigate(actionUrl)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "relative w-9 h-9 flex items-center justify-center rounded-xl transition-all focus:outline-none",
          isOpen ? "bg-surface-2 text-text" : "text-text-secondary hover:text-text hover:bg-surface-2"
        )}
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={isOpen ? 2.25 : 1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger text-[10px] text-bg font-bold rounded-full animate-pulse border border-bg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <>
          {/* Mobile Overlay backdrop */}
          <div className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2.5 w-[calc(100vw-32px)] sm:w-96 max-w-md bg-surface/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-200 origin-top-right fixed md:absolute left-4 md:left-auto right-4 md:right-0">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-text">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent font-medium rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs font-medium text-accent hover:text-accent-dim flex items-center gap-1 transition-colors"
                >
                  <Check size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center mx-auto text-text-muted">
                    <Bell size={18} />
                  </div>
                  <p className="text-xs text-text-muted font-medium">All caught up!</p>
                  <p className="text-[10px] text-text-muted/65 max-w-[200px] mx-auto">No notifications right now. Keep up the good work!</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const meta = getNotificationMeta(notif.type)
                  const Icon = meta.icon
                  let distance = ''
                  try {
                    distance = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })
                  } catch {
                    distance = 'recently'
                  }

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif.id, notif.action_url)}
                      className={clsx(
                        "w-full px-4 py-3.5 flex items-start gap-3 text-left transition-all hover:bg-surface-2/65",
                        !notif.read ? "bg-accent/[0.02]" : "opacity-80"
                      )}
                    >
                      {/* Icon container */}
                      <div className={clsx("w-9 h-9 flex items-center justify-center rounded-xl border flex-shrink-0", meta.bgColor)}>
                        <Icon size={16} className={meta.iconColor} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className={clsx("text-xs font-semibold truncate", !notif.read ? "text-text" : "text-text-secondary")}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <Circle size={6} className="fill-accent text-accent mt-1.5 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-text-secondary leading-normal line-clamp-2">
                          {notif.body}
                        </p>
                        <p className="text-[10px] text-text-muted pt-0.5">
                          {distance}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
