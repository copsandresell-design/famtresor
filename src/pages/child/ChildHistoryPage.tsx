import { isSameMonth, isSameWeek } from 'date-fns'
import { useMemo, useState } from 'react'
import { Amount } from '../../components/ui/Amount'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tabs } from '../../components/ui/Tabs'
import { formatDay, formatTime } from '../../lib/format'
import { useCurrentUser, useStore } from '../../store/useStore'

type Period = 'week' | 'month' | 'all'
const WEEK = { weekStartsOn: 1 as const }

interface Entry {
  id: string
  ts: number
  icon: string
  label: string
  amount?: number
  status: 'approved' | 'rejected' | 'pending' | 'transaction'
  note?: string
}

export function ChildHistoryPage() {
  const user = useCurrentUser()
  const transactions = useStore((s) => s.transactions)
  const submissions = useStore((s) => s.submissions)
  const tasks = useStore((s) => s.tasks)
  const [period, setPeriod] = useState<Period>('week')

  const entries = useMemo<Entry[]>(() => {
    if (!user) return []
    const txEntries: Entry[] = transactions
      .filter((t) => t.childId === user.id)
      .map((t) => ({
        id: t.id,
        ts: t.createdAt,
        icon: t.amount >= 0 ? '✅' : '⚠️',
        label: t.description,
        amount: t.amount,
        status: 'transaction',
      }))
    const subEntries: Entry[] = submissions
      .filter((s) => s.childId === user.id && s.status !== 'approved')
      .map((s) => {
        const task = tasks.find((t) => t.id === s.taskId)
        return {
          id: s.id,
          ts: s.submittedAt,
          icon: task?.icon ?? '❓',
          label: task?.title ?? 'Tâche',
          status: s.status as 'rejected' | 'pending',
          note: s.rejectionReason,
        }
      })
    return [...txEntries, ...subEntries].sort((a, b) => b.ts - a.ts)
  }, [user, transactions, submissions, tasks])

  const filtered = entries.filter((e) => {
    if (period === 'week') return isSameWeek(e.ts, Date.now(), WEEK)
    if (period === 'month') return isSameMonth(e.ts, Date.now())
    return true
  })

  const byDay = useMemo(() => {
    const groups = new Map<string, Entry[]>()
    for (const entry of filtered) {
      const key = formatDay(entry.ts)
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    return [...groups.entries()]
  }, [filtered])

  if (!user) return null

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Historique</h1>

      <Tabs
        tabs={[
          { id: 'week', label: 'Cette semaine' },
          { id: 'month', label: 'Ce mois' },
          { id: 'all', label: 'Tout' },
        ]}
        active={period}
        onChange={setPeriod}
      />

      <div className="space-y-5">
        {byDay.map(([day, dayEntries]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-bold capitalize text-slate-500 dark:text-slate-400">{day}</h2>
            <Card className="divide-y divide-slate-100 dark:divide-slate-800">
              {dayEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl" aria-hidden>
                    {entry.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{entry.label}</p>
                    <p className="text-xs text-slate-400">
                      {formatTime(entry.ts)}
                      {entry.status === 'pending' && ' · En attente ⏳'}
                      {entry.status === 'rejected' && ` · Refusée ❌${entry.note ? ` — ${entry.note}` : ''}`}
                    </p>
                  </div>
                  {entry.amount !== undefined && <Amount cents={entry.amount} className="text-sm" />}
                </div>
              ))}
            </Card>
          </section>
        ))}
        {filtered.length === 0 && <EmptyState emoji="📭" text="Rien sur cette période." />}
      </div>
    </div>
  )
}
