import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './components/auth/AuthGuard'
import { AppShell } from './components/layout/AppShell'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useAuth } from './hooks/useAuth'
import { useCapacitorPush } from './hooks/useCapacitorPush'
import { NotificationProvider } from './contexts/NotificationContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { WifiOff } from 'lucide-react'

const SignInPage = React.lazy(() => import('./pages/auth/SignInPage').then(m => ({ default: m.SignInPage })))
const SignUpPage = React.lazy(() => import('./pages/auth/SignUpPage').then(m => ({ default: m.SignUpPage })))
const OnboardingFlow = React.lazy(() => import('./pages/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const TasksPage = React.lazy(() => import('./pages/tasks/TasksPage').then(m => ({ default: m.TasksPage })))
const FinancePage = React.lazy(() => import('./pages/finance/FinancePage').then(m => ({ default: m.FinancePage })))
const GoalsPage = React.lazy(() => import('./pages/goals/GoalsPage').then(m => ({ default: m.GoalsPage })))
const GoalDetailPage = React.lazy(() => import('./pages/goals/GoalDetailPage').then(m => ({ default: m.GoalDetailPage })))
const BooksPage = React.lazy(() => import('./pages/books/BooksPage').then(m => ({ default: m.BooksPage })))
const BookDetailPage = React.lazy(() => import('./pages/books/BookDetailPage').then(m => ({ default: m.BookDetailPage })))
const AgendaPage = React.lazy(() => import('./pages/agenda/AgendaPage').then(m => ({ default: m.AgendaPage })))
const InboxPage = React.lazy(() => import('./pages/inbox/InboxPage').then(m => ({ default: m.InboxPage })))
const NotesPage = React.lazy(() => import('./pages/notes/NotesPage').then(m => ({ default: m.NotesPage })))
const SearchPage = React.lazy(() => import('./pages/search/SearchPage').then(m => ({ default: m.SearchPage })))
const SettingsPage = React.lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const DailyLogPage = React.lazy(() => import('./pages/day/DailyLogPage').then(m => ({ default: m.DailyLogPage })))
const DailyLogHistoryPage = React.lazy(() => import('./pages/day/DailyLogHistoryPage').then(m => ({ default: m.DailyLogHistoryPage })))
const ProjectsPage = React.lazy(() => import('./pages/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectDetailPage = React.lazy(() => import('./pages/projects/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const MorePage = React.lazy(() => import('./pages/more/MorePage').then(m => ({ default: m.MorePage })))

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg">
    <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
  </div>
)

function PushNotificationManager() {
  const { user } = useAuth()
  useCapacitorPush(user?.id)
  return null
}

function App() {
  const isOnline = useOnlineStatus()

  return (
    <ErrorBoundary>
      <AuthProvider>
        <PushNotificationManager />
        <BrowserRouter>
          {/* Global offline banner */}
          {!isOnline && (
            <div
              id="offline-banner"
              className="fixed top-0 left-0 right-0 z-[100] bg-warning/20 border-b border-warning/40 text-warning text-xs text-center py-2 font-medium flex items-center justify-center gap-2"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
              <WifiOff size={12} /> Offline — changes will sync when you reconnect
            </div>
          )}

          <Suspense fallback={<LoadingFallback />}>
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
                    <NotificationProvider>
                      <AppShell>
                        <Routes>
                          <Route path="/"         element={<DashboardPage />} />
                          <Route path="/day"      element={<DailyLogPage />} />
                          <Route path="/day/history" element={<DailyLogHistoryPage />} />
                          <Route path="/day/:date" element={<DailyLogPage />} />
                          <Route path="/tasks"    element={<TasksPage />} />
                          <Route path="/finance"  element={<FinancePage />} />
                          <Route path="/goals"    element={<GoalsPage />} />
                          <Route path="/goals/:id" element={<GoalDetailPage />} />
                          <Route path="/projects" element={<ProjectsPage />} />
                          <Route path="/projects/:id" element={<ProjectDetailPage />} />
                          <Route path="/books"    element={<BooksPage />} />
                          <Route path="/books/:id" element={<BookDetailPage />} />
                          <Route path="/agenda"   element={<AgendaPage />} />
                          <Route path="/inbox"    element={<InboxPage />} />
                          <Route path="/notes"    element={<NotesPage />} />
                          <Route path="/search"   element={<SearchPage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/profile"  element={<ProfilePage />} />
                          <Route path="/more"     element={<MorePage />} />
                          <Route path="*"         element={<Navigate to="/" replace />} />
                        </Routes>
                      </AppShell>
                    </NotificationProvider>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
