import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Hourglass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PhotoPicker, type PickedPhoto } from '../../components/photos/PhotoPicker'
import { Amount } from '../../components/ui/Amount'
import { AnimatedBalance } from '../../components/ui/AnimatedBalance'
import { AvatarEditorModal } from '../../components/ui/AvatarEditorModal'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { db } from '../../db/storage'
import { computeBadges, type BadgeState } from '../../lib/badges'
import { computeBalance } from '../../lib/balance'
import { DIFFICULTIES } from '../../lib/categories'
import { celebrate } from '../../lib/confetti'
import { childGradient, gradientEnd } from '../../lib/colors'
import { formatEuro, formatRelative } from '../../lib/format'
import { isTaskAvailable } from '../../lib/recurrence'
import { computeStreak } from '../../lib/streak'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { Task } from '../../types'

function DifficultyDots({ level }: { level: keyof typeof DIFFICULTIES }) {
  const { label, dots } = DIFFICULTIES[level]
  return (
    <span className="flex items-center gap-0.5" title={label} aria-label={`Difficulté : ${label}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= dots ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </span>
  )
}

function BadgeUnlockModal({ badge, onClose }: { badge: BadgeState; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Badge débloqué !">
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <motion.span
          className="text-7xl"
          aria-hidden
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 200 }}
        >
          {badge.emoji}
        </motion.span>
        <p className="font-display text-xl font-bold">{badge.label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{badge.description}</p>
        <Button className="mt-2 w-full" onClick={onClose}>
          Trop fort ! 🎉
        </Button>
      </div>
    </Modal>
  )
}

export function ChildHomePage() {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const tasks = useStore((s) => s.tasks)
  const submissions = useStore((s) => s.submissions)
  const transactions = useStore((s) => s.transactions)
  const messages = useStore((s) => s.messages)
  const settings = useStore((s) => s.settings)
  const submitTask = useStore((s) => s.submitTask)
  const toast = useStore((s) => s.toast)

  const [confirming, setConfirming] = useState<Task | null>(null)
  const [isInitiative, setIsInitiative] = useState(false)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [comment, setComment] = useState('')
  const [unlockedBadge, setUnlockedBadge] = useState<BadgeState | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)

  const childId = user?.id

  // Confettis si des tâches ont été validées depuis la dernière visite.
  useEffect(() => {
    if (!childId) return
    const key = `lastSeenApproval:${childId}`
    void (async () => {
      const lastSeen = (await db.getItem<number>(key)) ?? 0
      const fresh = submissions.filter(
        (s) => s.childId === childId && s.status === 'approved' && (s.reviewedAt ?? 0) > lastSeen,
      )
      if (fresh.length > 0) {
        celebrate([user!.color, gradientEnd(user!.color)])
        toast(`${fresh.length > 1 ? `${fresh.length} tâches validées` : 'Tâche validée'} pendant ton absence ! 🎉`)
      }
      await db.setItem(key, Date.now())
    })()
  }, [childId, submissions, toast])

  // Toast si un parent a envoyé un message depuis la dernière visite.
  useEffect(() => {
    if (!childId) return
    const key = `lastSeenMessages:${childId}`
    void (async () => {
      const lastSeen = (await db.getItem<number>(key)) ?? Date.now()
      const fresh = messages.filter((m) => m.toChildId === childId && m.createdAt > lastSeen)
      if (fresh.length > 0) {
        const from = users.find((u) => u.id === fresh[0].fromId)
        toast(`💌 Nouveau message de ${from?.name ?? 'tes parents'} — regarde ton profil !`)
      }
      await db.setItem(key, Date.now())
    })()
  }, [childId, messages, users, toast])

  // Détection des badges fraîchement débloqués.
  useEffect(() => {
    if (!childId) return
    const key = `seenBadges:${childId}`
    const children = users.filter((u) => u.role === 'child' && u.isActive)
    const unlocked = computeBadges({ childId, submissions, transactions, children })
      .filter((b) => b.unlocked)
    void (async () => {
      const seen = await db.getItem<string[]>(key)
      if (seen !== null) {
        const fresh = unlocked.find((b) => !seen.includes(b.id))
        if (fresh) {
          celebrate([user!.color, gradientEnd(user!.color)])
          setUnlockedBadge(fresh)
        }
      }
      await db.setItem(key, unlocked.map((b) => b.id))
    })()
  }, [childId, submissions, transactions, users])

  const available = useMemo(
    () => (childId ? tasks.filter((t) => isTaskAvailable(t, childId, submissions)) : []),
    [tasks, childId, submissions],
  )

  const streak = useMemo(
    () => (childId ? computeStreak(childId, submissions) : null),
    [childId, submissions],
  )

  if (!user || !childId || !streak) return null

  const balance = computeBalance(transactions, childId)
  const pending = submissions.filter((s) => s.childId === childId && s.status === 'pending')
  const recent = transactions.filter((t) => t.childId === childId).slice(0, 5)

  function closeSubmitModal() {
    setConfirming(null)
    setIsInitiative(false)
    setPhotos([])
    setComment('')
  }

  function confirmSubmit() {
    if (!confirming) return
    const ok = submitTask(confirming.id, childId!, {
      isInitiative,
      photoIds: photos.map((p) => p.id),
      comment,
    })
    toast(ok ? 'Envoyé ! Un parent va vérifier. 💪' : 'Cette tâche a déjà été signalée.', ok ? 'success' : 'error')
    closeSubmitModal()
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 rounded-3xl p-7 text-center text-white shadow-lg"
        style={{ background: childGradient(user.color) }}
      >
        <ChildAvatar user={user} size="lg" onClick={() => setEditingAvatar(true)} />
        <p className="font-display text-lg font-bold">{user.name}</p>
        <AnimatedBalance cents={balance} className="font-display text-6xl font-bold drop-shadow-sm" />
        {streak.count > 0 && (
          <p className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            <Flame size={16} aria-hidden />
            Série : {streak.count} jour{streak.count > 1 ? 's' : ''}
          </p>
        )}
      </motion.section>

      {streak.count > 0 && !streak.doneToday && (
        <Card className="flex items-center gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <Flame className="shrink-0 text-amber-500" size={20} aria-hidden />
          <p className="text-sm font-semibold">
            Ta série de {streak.count} jour{streak.count > 1 ? 's' : ''} se joue aujourd'hui — fais une
            tâche pour la garder ! 🔥
          </p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Tâches pour toi</h2>
        <div className="space-y-3">
          {available.map((task, i) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
                <span className="text-3xl" aria-hidden>
                  {task.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{task.title}</p>
                  {task.description && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatEuro(task.amount)}
                    </span>
                    <DifficultyDots level={task.difficulty} />
                  </div>
                </div>
                <Button variant="success" onClick={() => setConfirming(task)}>
                  Je l'ai fait !
                </Button>
              </Card>
            </motion.div>
          ))}
          {available.length === 0 && (
            <EmptyState emoji="🏖️" text="Aucune tâche disponible pour le moment. Reviens plus tard !" />
          )}
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Hourglass size={18} className="text-amber-500" />
            En attente de validation
          </h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((sub) => {
              const task = tasks.find((t) => t.id === sub.taskId)
              return (
                <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl" aria-hidden>
                    {task?.icon ?? '❓'}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{task?.title}</p>
                  {sub.photoIds && <span className="text-xs text-slate-400">📷 {sub.photoIds.length}</span>}
                  <span className="text-xs text-slate-400">{formatRelative(sub.submittedAt)} ⏳</span>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Derniers gains</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm">{tx.description}</p>
                <Amount cents={tx.amount} className="text-sm" />
              </div>
            ))}
          </Card>
        </section>
      )}

      <Modal
        open={confirming !== null}
        onClose={closeSubmitModal}
        title={confirming ? `${confirming.icon} ${confirming.title}` : ''}
      >
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Tu vas gagner <strong>+{formatEuro(confirming?.amount ?? 0)}</strong> dès qu'un parent aura vérifié.
        </p>

        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold">Ajoute des photos de preuve (optionnel)</p>
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </div>

        <input
          className={`${inputCls} mb-4`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Un commentaire ? Ex : j'ai aussi rangé les chaises"
          aria-label="Commentaire"
        />

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
          <input
            type="checkbox"
            checked={isInitiative}
            onChange={(e) => setIsInitiative(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-500"
          />
          <span className="text-sm">
            ⭐ Je l'ai fait <strong>sans qu'on me le demande</strong>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Bonus initiative : +{formatEuro(settings.initiativeBonus)}
            </span>
          </span>
        </label>
        <Button variant="success" size="lg" className="w-full" onClick={confirmSubmit}>
          C'est fait, envoyer ! 🚀
        </Button>
      </Modal>

      <AnimatePresence>
        {unlockedBadge && (
          <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        )}
      </AnimatePresence>

      {editingAvatar && (
        <AvatarEditorModal user={user} actorId={user.id} onClose={() => setEditingAvatar(false)} />
      )}
    </div>
  )
}
