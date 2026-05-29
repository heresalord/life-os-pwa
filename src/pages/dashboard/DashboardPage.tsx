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
    // ── Desktop: 2-column asymmetric grid [main | sticky right panel] ──
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">

      {/* ── Left / main column ── */}
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
          {/* Morning / Review buttons — hidden on desktop (live in the topbar there) */}
          <div className="flex gap-2 lg:hidden">
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

        {/* Finance + NotesInbox — shown here on mobile/tablet, moved to right panel on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Finance</p>
            <FinancePanel />
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Notes & Inbox</p>
            <NotesInboxPanel />
          </div>
        </div>

        {/* Focus & Tasks */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Focus & Tasks</p>
          <FocusTasksPanel />
        </div>

        {/* Mood · Goals · Books */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Mood · Goals · Books</p>
          <MoodGoalsBooksPanel />
        </div>

        {/* Quote */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Quote</p>
          <QuotesWidget />
        </div>
      </div>

      {/* ── Right / sticky panel — desktop only ── */}
      <div className="hidden lg:flex flex-col gap-4 sticky top-20">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Finance</p>
          <FinancePanel />
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">Notes & Inbox</p>
          <NotesInboxPanel />
        </div>
      </div>
    </div>
  )
}
