import { isSameMonth, isSameWeek, startOfWeek, subWeeks } from 'date-fns'
import { LogOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { PhotoLightbox } from '../../components/photos/PhotoLightbox'
import { PhotoThumb } from '../../components/photos/PhotoThumb'
import { AnimatedBalance } from '../../components/ui/AnimatedBalance'
import { AvatarEditorModal } from '../../components/ui/AvatarEditorModal'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { cn } from '../../lib/cn'
import { computeBadges } from '../../lib/badges'
import { computeBalance } from '../../lib/balance'
import { formatEuro, formatRelative } from '../../lib/format'
import { useCurrentUser, useStore } from '../../store/useStore'

const WEEK = { weekStartsOn: 1 as const }

export function ChildProfilePage() {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const submissions = useStore((s) => s.submissions)
  const messages = useStore((s) => s.messages)
  const logout = useStore((s) => s.logout)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [lightbox, setLightbox] = useState<{ ids: string[]; index: number } | null>(null)

  const children = users.filter((u) => u.role === 'child' && u.isActive)

  const stats = useMemo(() => {
    if (!user) return null
    const mine = submissions.filter((s) => s.childId === user.id)
    const approved = mine.filter((s) => s.status === 'approved').length
    const rejected = mine.filter((s) => s.status === 'rejected').length
    const reviewed = approved + rejected
    const gains = transactions.filter((t) => t.childId === user.id && t.type === 'task_approval')
    let bestWeek = 0
    for (let i = 0; i < 12; i++) {
      const weekStart = startOfWeek(subWeeks(Date.now(), i), WEEK)
      const total = gains
        .filter((t) => isSameWeek(t.createdAt, weekStart, WEEK))
        .reduce((sum, t) => sum + t.amount, 0)
      bestWeek = Math.max(bestWeek, total)
    }
    return {
      approved,
      approvalRate: reviewed > 0 ? Math.round((approved / reviewed) * 100) : null,
      bestWeek,
    }
  }, [user, submissions, transactions])

  const badges = useMemo(
    () =>
      user
        ? computeBadges({ childId: user.id, submissions, transactions, children })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, submissions, transactions, users],
  )

  const rank = useMemo(() => {
    if (!user) return null
    const monthGains = (id: string) =>
      transactions
        .filter((t) => t.childId === id && t.type === 'task_approval' && isSameMonth(t.createdAt, Date.now()))
        .reduce((sum, t) => sum + t.amount, 0)
    if (monthGains(user.id) === 0) return null
    const sorted = [...children].sort((a, b) => monthGains(b.id) - monthGains(a.id))
    return sorted.findIndex((c) => c.id === user.id) + 1
  }, [user, children, transactions])

  const galleryPhotos = useMemo(() => {
    if (!user) return []
    return submissions
      .filter((s) => s.childId === user.id && s.status === 'approved' && s.photoIds?.length)
      .flatMap((s) => s.photoIds!)
  }, [user, submissions])

  const myMessages = useMemo(
    () => (user ? messages.filter((m) => m.toChildId === user.id).slice(0, 20) : []),
    [user, messages],
  )

  if (!user || !stats) return null

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Mon profil</h1>

      <Card className="flex flex-col items-center gap-3 p-6">
        <ChildAvatar user={user} size="xl" onClick={() => setEditingAvatar(true)} />
        <p className="font-display text-xl font-bold">{user.name}</p>
        <AnimatedBalance
          cents={computeBalance(transactions, user.id)}
          className="font-display text-3xl font-bold"
        />
        {rank !== null && (
          <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
            {medals[rank - 1] ?? '🏅'} {rank === 1 ? 'MVP du mois !' : `${rank}ᵉ ce mois-ci`}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold">{stats.approved}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tâches validées</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold">
            {stats.approvalRate !== null ? `${stats.approvalRate} %` : '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Taux de réussite</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold">{formatEuro(stats.bestWeek)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Meilleure semaine</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Mes badges</h2>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={cn('flex flex-col items-center gap-1 p-4 text-center', !badge.unlocked && 'opacity-45')}
              title={badge.description}
            >
              <span className={cn('text-3xl', !badge.unlocked && 'grayscale')} aria-hidden>
                {badge.emoji}
              </span>
              <p className="text-xs font-bold leading-tight">{badge.label}</p>
              {!badge.unlocked && badge.progress && (
                <>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={badge.progress.current}
                    aria-valuemax={badge.progress.target}
                    aria-label={`Progression ${badge.label}`}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{ width: `${(badge.progress.current / badge.progress.target) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {badge.progress.current}/{badge.progress.target}
                    {badge.progress.unit ? ` ${badge.progress.unit}` : ''}
                  </p>
                </>
              )}
              {badge.unlocked && <p className="text-[10px] text-emerald-500">Débloqué ✓</p>}
            </Card>
          ))}
        </div>
      </section>

      {myMessages.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Messages de mes parents 💌</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {myMessages.map((message) => {
              const from = users.find((u) => u.id === message.fromId)
              return (
                <div key={message.id} className="flex items-start gap-3 px-4 py-3">
                  {from ? (
                    <ChildAvatar user={from} size="sm" />
                  ) : (
                    <span className="text-xl" aria-hidden>
                      💬
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{message.text}</p>
                    <p className="text-xs text-slate-400">
                      {from?.name} · {formatRelative(message.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {galleryPhotos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Ma galerie 📸</h2>
          <div className="grid grid-cols-4 gap-2">
            {galleryPhotos.map((photoId, i) => (
              <PhotoThumb
                key={photoId}
                photoId={photoId}
                className="h-full w-full aspect-square"
                onClick={() => setLightbox({ ids: galleryPhotos, index: i })}
              />
            ))}
          </div>
        </section>
      )}

      <Button variant="soft" className="w-full" onClick={logout}>
        <LogOut size={18} />
        Déconnexion
      </Button>

      <AnimatePresence>
        {lightbox && (
          <PhotoLightbox
            photoIds={lightbox.ids}
            startIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {editingAvatar && (
        <AvatarEditorModal user={user} actorId={user.id} onClose={() => setEditingAvatar(false)} />
      )}
    </div>
  )
}
