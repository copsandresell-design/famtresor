import { MotionConfig } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ChildLayout } from './components/layout/ChildLayout'
import { ParentLayout } from './components/layout/ParentLayout'
import { Toaster } from './components/Toaster'
import { LoginPage } from './pages/LoginPage'
import { ChildHistoryPage } from './pages/child/ChildHistoryPage'
import { ChildHomePage } from './pages/child/ChildHomePage'
import { ChildProfilePage } from './pages/child/ChildProfilePage'
import { ApprovalsPage } from './pages/parent/ApprovalsPage'
import { CalendarPage } from './pages/parent/CalendarPage'
import { ChildrenPage } from './pages/parent/ChildrenPage'
import { LogsPage } from './pages/parent/LogsPage'
import { OverviewPage } from './pages/parent/OverviewPage'
import { PenaltiesPage } from './pages/parent/PenaltiesPage'
import { SettingsPage } from './pages/parent/SettingsPage'
import { TasksPage } from './pages/parent/TasksPage'
import { useStore } from './store/useStore'

// Recharts ne sert qu'ici : chargé à la demande pour alléger le bundle initial.
const StatsPage = lazy(() =>
  import('./pages/parent/StatsPage').then((m) => ({ default: m.StatsPage })),
)

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && media.matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

function useSessionExpiry() {
  const logout = useStore((s) => s.logout)
  useEffect(() => {
    const interval = setInterval(() => {
      const session = useStore.getState().session
      if (session && session.expiresAt < Date.now()) logout()
    }, 30_000)
    return () => clearInterval(interval)
  }, [logout])
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const session = useStore((s) => s.session)
  const init = useStore((s) => s.init)
  useTheme()
  useSessionExpiry()

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="animate-pulse text-4xl" aria-label="Chargement">
          💰
        </p>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          {!session && <Route path="*" element={<LoginPage />} />}
          {session?.role === 'parent' && (
            <>
              <Route path="/parent" element={<ParentLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="taches" element={<TasksPage />} />
                <Route path="validations" element={<ApprovalsPage />} />
                <Route path="penalites" element={<PenaltiesPage />} />
                <Route
                  path="stats"
                  element={
                    <Suspense fallback={<p className="animate-pulse text-center text-2xl">📊</p>}>
                      <StatsPage />
                    </Suspense>
                  }
                />
                <Route path="calendrier" element={<CalendarPage />} />
                <Route path="enfants" element={<ChildrenPage />} />
                <Route path="journal" element={<LogsPage />} />
                <Route path="reglages" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/parent" replace />} />
            </>
          )}
          {session?.role === 'child' && (
            <>
              <Route path="/enfant" element={<ChildLayout />}>
                <Route index element={<ChildHomePage />} />
                <Route path="historique" element={<ChildHistoryPage />} />
                <Route path="profil" element={<ChildProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/enfant" replace />} />
            </>
          )}
        </Routes>
        <Toaster />
      </BrowserRouter>
    </MotionConfig>
  )
}
