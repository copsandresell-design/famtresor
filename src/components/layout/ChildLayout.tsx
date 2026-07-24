import { History, Home, UserRound } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useCurrentUser, useStore } from '../../store/useStore'
import { NotificationCenter } from '../NotificationCenter'
import { ChildAvatar } from '../ui/ChildAvatar'

const links = [
  { to: '/enfant', label: 'Accueil', icon: Home, end: true },
  { to: '/enfant/historique', label: 'Historique', icon: History },
  { to: '/enfant/profil', label: 'Profil', icon: UserRound },
]

export function ChildLayout() {
  const user = useCurrentUser()
  const touchSession = useStore((s) => s.touchSession)
  const location = useLocation()

  useEffect(() => {
    touchSession()
  }, [location.pathname, touchSession])

  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
        style={{ borderTopColor: user.color, borderTopWidth: 4 }}
      >
        <ChildAvatar user={user} size="sm" />
        <p className="min-w-0 flex-1 truncate text-base font-black">{user.name}</p>
        <NotificationCenter />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-1 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors',
                isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400',
              )
            }
            style={({ isActive }) => (isActive ? { color: user.color } : undefined)}
          >
            <link.icon size={22} />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
