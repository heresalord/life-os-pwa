import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignInPage } from './pages/auth/SignInPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { OnboardingFlow } from './pages/onboarding/OnboardingFlow'
import { AuthGuard } from './components/auth/AuthGuard'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { TasksPage } from './pages/tasks/TasksPage'
import { FinancePage } from './pages/finance/FinancePage'
import { GoalsPage } from './pages/goals/GoalsPage'
import { BooksPage } from './pages/books/BooksPage'
import { AgendaPage } from './pages/agenda/AgendaPage'
import { InboxPage } from './pages/inbox/InboxPage'
import { NotesPage } from './pages/notes/NotesPage'
import { SearchPage } from './pages/search/SearchPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { MorningPage } from './pages/routines/MorningPage'
import { ReviewPage } from './pages/routines/ReviewPage'
import { useOnlineStatus } from './hooks/useOnlineStatus'

function App() {
  const isOnline = useOnlineStatus()

  return (
    <BrowserRouter>
      {/* Global offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-warning/20 border-b border-warning/40 text-warning text-xs text-center py-1.5 font-medium">
          ⚡ Offline — changes will sync when you reconnect
        </div>
      )}

      <Routes>
        {/* Public auth routes */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected routes — wrapped in AuthGuard then AppShell */}
        <Route element={<AuthGuard />}>
          <Route path="/onboarding" element={<OnboardingFlow />} />

          {/* All app routes use the AppShell */}
          <Route
            path="/*"
            element={
              <AppShell>
                <Routes>
                  <Route path="/"         element={<DashboardPage />} />
                  <Route path="/morning"  element={<MorningPage />} />
                  <Route path="/review"   element={<ReviewPage />} />
                  <Route path="/tasks"    element={<TasksPage />} />
                  <Route path="/finance"  element={<FinancePage />} />
                  <Route path="/goals"    element={<GoalsPage />} />
                  <Route path="/books"    element={<BooksPage />} />
                  <Route path="/agenda"   element={<AgendaPage />} />
                  <Route path="/inbox"    element={<InboxPage />} />
                  <Route path="/notes"    element={<NotesPage />} />
                  <Route path="/search"   element={<SearchPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*"         element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
