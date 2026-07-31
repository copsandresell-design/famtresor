import { MotionConfig } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ChildLayout } from './components/layout/ChildLayout'
import { ParentLayout } from './components/layout/ParentLayout'
import { AmbientBackground } from './components/ui/AmbientBackground'
import { PremiumUpsellModal } from './components/ui/PremiumUpsellModal'
import { Toaster } from './components/Toaster'
import { UpdateBanner } from './components/UpdateBanner'
import { useDataRealtime } from './hooks/useDataSync'
import { useNotificationRealtime } from './hooks/useNotifications'
import { DemoLandingPage } from './pages/DemoLandingPage'
import { FamilyAuthScreen } from './pages/FamilyAuthScreen'
import { LoginPage } from './pages/LoginPage'
import { ChildHistoryPage } from './pages/child/ChildHistoryPage'
import { ChildHomePage } from './pages/child/ChildHomePage'
import { ChildProfilePage } from './pages/child/ChildProfilePage'
import { ApprovalsPage } from './pages/parent/ApprovalsPage'
import { BadgeDefsPage } from './pages/parent/BadgeDefsPage'
import { CalendarPage } from './pages/parent/CalendarPage'
import { ChildrenPage } from './pages/parent/ChildrenPage'
import { LogsPage } from './pages/parent/LogsPage'
import { OverviewPage } from './pages/parent/OverviewPage'
import { PenaltiesPage } from './pages/parent/PenaltiesPage'
import { RankDefsPage } from './pages/parent/RankDefsPage'
import { ShopPage } from './pages/parent/ShopPage'
import { ChildShopPage } from './pages/child/ChildShopPage'
import { SettingsPage } from './pages/parent/SettingsPage'
import { StreakDefsPage } from './pages/parent/StreakDefsPage'
import { TasksPage } from './pages/parent/TasksPage'
import { PremiumGate } from './components/ui/PremiumGate'
import { useDemoMode } from './store/demoStore'
import { useFamilyAuthStore } from './store/familyAuthStore'
import { refreshThemePacks } from './store/themePacksStore'
import { useStore } from './store/useStore'

// Recharts ne sert qu'ici : chargÃ© Ã  la demande pour allÃ©ger le bundle initial.
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
  const shopEnabled = useStore((s) => s.settings.features.shop)
  const demoActive = useDemoMode((s) => s.active)
  const familyAuthStatus = useFamilyAuthStore((s) => s.status)
  const familyId = useFamilyAuthStore((s) => s.familyId)
  useTheme()
  useSessionExpiry()
  useNotificationRealtime()
  useDataRealtime()

  // En mode démo, aucune donnée réelle ne doit transiter par Supabase (voir store/demoStore.ts) :
  // on initialise dans ce cas sans attendre l'auth Supabase (le store de démo n'y touche jamais).
  // Sinon, on n'appelle l'init réelle (fetch Supabase, family_id implicite via la session/RLS —
  // voir supabase/migrations/20260730010000_multi_family_phase1.sql) qu'une fois un parent
  // authentifié ET rattaché à une famille, pour ne jamais lancer un fetch voué à revenir vide.
  const shouldInitRealStore = demoActive || familyAuthStatus === 'ready'

  useEffect(() => {
    if (shouldInitRealStore) void init()
  }, [init, shouldInitRealStore])

  // GODCLAUDE phase 5 : catalogue de packs cosmétiques + ceux possédés par la famille — pas
  // en mode démo (démo = emojis/couleurs par défaut codés en dur, jamais de vraie famille).
  useEffect(() => {
    if (familyAuthStatus === 'ready' && familyId) void refreshThemePacks(familyId)
  }, [familyAuthStatus, familyId])

  // Statut Supabase Auth encore inconnu (restauration de session en cours) : on attend avant de
  // décider quoi afficher, sauf en mode démo qui ne dépend jamais de Supabase.
  if (!demoActive && familyAuthStatus === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <UpdateBanner />
        <p className="animate-pulse text-4xl" aria-label="Chargement">
          🚀
        </p>
      </div>
    )
  }

  if (shouldInitRealStore && !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <UpdateBanner />
        <p className="animate-pulse text-4xl" aria-label="Chargement">
          🚀
        </p>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <UpdateBanner />
        <AmbientBackground />
        <Routes>
          {/* Toujours accessible, session ou non : point d'entrée de la démo (voir store/demoStore.ts). */}
          <Route path="/demo" element={<DemoLandingPage />} />
          {/* Pas encore de session Supabase Auth (parent) : écran de connexion/inscription famille,
              avant même le picker PIN existant (voir pages/FamilyAuthScreen.tsx). */}
          {!demoActive && (familyAuthStatus === 'signed-out' || familyAuthStatus === 'needs-family') && (
            <Route path="*" element={<FamilyAuthScreen />} />
          )}
          {shouldInitRealStore && !session && <Route path="*" element={<LoginPage />} />}
          {session?.role === 'parent' && (
            <>
              <Route path="/parent" element={<ParentLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="taches" element={<TasksPage />} />
                <Route path="validations" element={<ApprovalsPage />} />
                <Route path="penalites" element={<PenaltiesPage />} />
                {shopEnabled && <Route path="boutique" element={<ShopPage />} />}
                <Route
                  path="stats"
                  element={
                    <PremiumGate
                      feature="stats_calendar"
                      title="Statistiques & calendrier"
                      description="Passez à Premium pour débloquer les graphiques de progression et le calendrier familial."
                    >
                      <Suspense fallback={<p className="animate-pulse text-center text-2xl">📊</p>}>
                        <StatsPage />
                      </Suspense>
                    </PremiumGate>
                  }
                />
                <Route
                  path="calendrier"
                  element={
                    <PremiumGate
                      feature="stats_calendar"
                      title="Statistiques & calendrier"
                      description="Passez à Premium pour débloquer les graphiques de progression et le calendrier familial."
                    >
                      <CalendarPage />
                    </PremiumGate>
                  }
                />
                <Route path="enfants" element={<ChildrenPage />} />
                <Route path="journal" element={<LogsPage />} />
                <Route path="reglages" element={<SettingsPage />} />
                {/* Ajustement du 31/07 : plus de verrou plein-page ici — une famille gratuite
                    accède à ces pages et peut créer jusqu'à MAX_FREE_CUSTOM élément(s)
                    personnalisé(s) (voir lib/access.ts canCreateCustom), chaque page gère son
                    propre dosage en interne (bouton "Nouveau ..." + bandeau d'upsell). */}
                <Route path="reglages/badges" element={<BadgeDefsPage />} />
                <Route path="reglages/series" element={<StreakDefsPage />} />
                <Route path="reglages/rangs" element={<RankDefsPage />} />
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
                {shopEnabled && <Route path="boutique" element={<ChildShopPage />} />}
              </Route>
              <Route path="*" element={<Navigate to="/enfant" replace />} />
            </>
          )}
        </Routes>
        <Toaster />
        <PremiumUpsellModal />
      </BrowserRouter>
    </MotionConfig>
  )
}
