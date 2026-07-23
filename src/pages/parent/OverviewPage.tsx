import { isSameWeek, isToday, subDays } from 'date-fns'
import { BellRing, Plus, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Amount } from '../../components/ui/Amount'
import { AnimatedBalance } from '../../components/ui/AnimatedBalance'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { computeBalance } from '../../lib/balance'
import { formatEuro } from '../../lib/format'
import { useStore } from '../../store/useStore'

const WEEK = { weekStartsOn: 1 as const }

function Sparkline({ childId, color }: { childId: string; color: string }) {
  const transactions = useStore((s) => s.transactions)
  const now = Date.now()
  const values = Array.from({ length: 7 }, (_, i) => {
    const cutoff = subDays(now, 6 - i).setHours(23, 59, 59, 999)
    return transactions
      .filter((t) => t.childId === childId && t.createdAt <= cutoff)
      .reduce((sum, t) => sum + t.amount, 0)
  })
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const points = values
    .map((v, i) => `${(i / 6) * 96},${36 - ((v - min) / range) * 32 + 2}`)
    .join(' ')
  return (
    <svg viewBox="0 0 96 40" className="h-10 w-24" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function OverviewPage() {
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const submissions = useStore((s) => s.submissions)
  const navigate = useNavigate()

  const children = users.filter((u) => u.role === 'child' && u.isActive)
  const familyTotal = children.reduce((sum, c) => sum + computeBalance(transactions, c.id), 0)
  const pending = submissions.filter((s) => s.status === 'pending')
  const approvedToday = submissions.filter((s) => s.status === 'approved' && s.reviewedAt && isToday(s.reviewedAt))
  const weekGains = transactions
    .filter((t) => t.amount > 0 && t.type === 'task_approval' && isSameWeek(t.createdAt, Date.now(), WEEK))
    .reduce((sum, t) => sum + t.amount, 0)
  const hasDefaultSecrets = users.some((u) => u.usesDefaultSecret)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Vue d'ensemble</h1>
        <Button onClick={() => navigate('/parent/taches?nouveau=1')}>
          <Plus size={18} />
          Ajouter une tâche
        </Button>
      </div>

      {hasDefaultSecrets && (
        <Card className="flex items-center gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <ShieldAlert className="shrink-0 text-amber-600" size={20} />
          <p className="text-sm">
            Des codes d'accès par défaut sont encore actifs.{' '}
            <Link to="/parent/reglages" className="font-semibold underline">
              Changez-les dans Réglages.
            </Link>
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white shadow-md shadow-amber-500/25">
          <p className="text-sm text-white/85">Solde famille</p>
          <AnimatedBalance cents={familyTotal} className="font-display text-2xl font-bold" />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Gains cette semaine</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatEuro(weekGains)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Validées aujourd'hui</p>
          <p className="text-2xl font-black">{approvedToday.length}</p>
        </Card>
        <Link to="/parent/validations">
          <Card className="h-full p-4 transition-shadow hover:shadow-md">
            <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <BellRing size={14} />
              En attente
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{pending.length}</p>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Les enfants</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => {
            const balance = computeBalance(transactions, child.id)
            const childPending = pending.filter((s) => s.childId === child.id).length
            return (
              <Card
                key={child.id}
                className="flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <ChildAvatar user={child} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{child.name}</p>
                  <AnimatedBalance cents={balance} className="text-xl font-black" />
                  {childPending > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {childPending} tâche{childPending > 1 ? 's' : ''} à valider
                    </p>
                  )}
                </div>
                <Sparkline childId={child.id} color={child.color} />
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Dernières transactions</h2>
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions.slice(0, 6).map((tx) => {
            const child = users.find((u) => u.id === tx.childId)
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                {child && <ChildAvatar user={child} size="sm" />}
                <p className="min-w-0 flex-1 truncate text-sm">{tx.description}</p>
                <Amount cents={tx.amount} className="text-sm" />
              </div>
            )
          })}
          {transactions.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune transaction pour l'instant.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
