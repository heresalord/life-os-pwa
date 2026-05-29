
import { useNavigate } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { YearProgressBar } from '../../components/dashboard/YearProgressBar'
import { FocusTasksPanel } from '../../components/dashboard/FocusTasksPanel'
import { FinancePanel } from '../../components/dashboard/FinancePanel'
import { NotesInboxPanel } from '../../components/dashboard/NotesInboxPanel'
import { MoodGoalsBooksPanel } from '../../components/dashboard/MoodGoalsBooksPanel'
import { QuotesWidget } from '../../components/dashboard/QuotesWidget'
import { useAuth } from '../../hooks/useAuth'

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', icon: <Sun size={16} className="text-warning" /> }
  if (h < 18) return { text: 'Good afternoon', icon: <Sun size={16} className="text-accent" /> }
  return { text: 'Good evening', icon: <Moon size={16} className="text-info" /> }
}

export function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { text: greeting, icon } = getGreeting()

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-text-secondary text-sm mb-0.5">
            {icon}
            <span>{greeting}</span>
          </div>
          <h2 className="text-2xl font-display text-text">
            {profile?.display_name ?? 'Welcome'}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            id="dashboard-morning-btn"
            onClick={() => navigate('/morning')}
            className="text-xs px-3 py-1.5 bg-warning/15 text-warning rounded-full hover:bg-warning/25 transition-colors"
          >
            Morning
          </button>
          <button
            id="dashboard-review-btn"
            onClick={() => navigate('/review')}
            className="text-xs px-3 py-1.5 bg-info/15 text-info rounded-full hover:bg-info/25 transition-colors"
          >
            Review
          </button>
        </div>
      </div>

      {/* Year progress */}
      <YearProgressBar />

      {/* Panels grid — 1 col mobile, 2 col tablet+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Focus & Tasks</p>
          <FocusTasksPanel />
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Finance</p>
          <FinancePanel />
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Notes & Inbox</p>
          <NotesInboxPanel />
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Mood · Goals · Books</p>
          <MoodGoalsBooksPanel />
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Quote</p>
          <QuotesWidget />
        </div>
      </div>
    </div>
  )
}
