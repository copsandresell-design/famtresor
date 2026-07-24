import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { cn } from '../lib/cn'
import { formatRelative } from '../lib/format'
import type { AppNotification } from '../types'

const TYPE_TINTS: Record<AppNotification['type'], string> = {
  task_assigned: 'bg-blue-100 dark:bg-blue-900/40',
  task_submitted: 'bg-amber-100 dark:bg-amber-900/40',
  task_approved: 'bg-emerald-100 dark:bg-emerald-900/40',
  task_rejected: 'bg-rose-100 dark:bg-rose-900/40',
  message: 'bg-pink-100 dark:bg-pink-900/40',
  penalty: 'bg-orange-100 dark:bg-orange-900/40',
}

export function NotificationCenter({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openNotification(notif: AppNotification) {
    markRead(notif.id)
    setOpen(false)
    if (notif.link) navigate(notif.link)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
        aria-expanded={open}
        className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 400 }}
            className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 400 }}
              className={cn(
                'z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900',
                'fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-88',
                align === 'right' ? 'sm:right-0' : 'sm:left-0',
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="font-display font-bold">Notifications</p>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      title="Tout marquer comme lu"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      title="Tout effacer"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <span className="text-3xl" aria-hidden>🔔</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Rien pour l'instant. Les nouveautés arriveront ici !
                    </p>
                  </div>
                )}
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => openNotification(notif)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer',
                      !notif.read && 'bg-amber-50/60 dark:bg-amber-950/20',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg',
                        TYPE_TINTS[notif.type],
                      )}
                      aria-hidden
                    >
                      {notif.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{notif.title}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {notif.message}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelative(notif.createdAt)}
                      </span>
                    </span>
                    {!notif.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Non lue" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
