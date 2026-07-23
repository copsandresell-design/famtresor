import { isSameMonth, isSameWeek, startOfWeek, subDays, subWeeks } from 'date-fns'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { computeBalance } from '../../lib/balance'
import { CATEGORIES } from '../../lib/categories'
import { childGradient } from '../../lib/colors'
import { formatDateShort, formatEuro } from '../../lib/format'
import { useStore } from '../../store/useStore'

const WEEK = { weekStartsOn: 1 as const }

const euroTick = (v: number) => `${(v / 100).toFixed(0)}€`
const euroTooltip = (v: number) => formatEuro(v)

export function StatsPage() {
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const submissions = useStore((s) => s.submissions)
  const tasks = useStore((s) => s.tasks)

  const children = users.filter((u) => u.role === 'child' && u.isActive)
  const now = Date.now()

  const perChild = useMemo(
    () =>
      children.map((child) => {
        const mine = submissions.filter((s) => s.childId === child.id)
        const approved = mine.filter((s) => s.status === 'approved')
        const rejected = mine.filter((s) => s.status === 'rejected')
        const reviewed = approved.length + rejected.length
        const gains = transactions.filter(
          (t) => t.childId === child.id && t.type === 'task_approval',
        )
        const monthGains = gains
          .filter((t) => isSameMonth(t.createdAt, now))
          .reduce((sum, t) => sum + t.amount, 0)
        const weekGains = gains
          .filter((t) => isSameWeek(t.createdAt, now, WEEK))
          .reduce((sum, t) => sum + t.amount, 0)

        const taskCounts = new Map<string, number>()
        for (const sub of approved) {
          taskCounts.set(sub.taskId, (taskCounts.get(sub.taskId) ?? 0) + 1)
        }
        const favoriteId = [...taskCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        const favorite = tasks.find((t) => t.id === favoriteId)

        return {
          child,
          balance: computeBalance(transactions, child.id),
          weekGains,
          monthGains,
          completed: approved.length,
          approvalRate: reviewed > 0 ? Math.round((approved.length / reviewed) * 100) : null,
          favorite: favorite ? `${favorite.icon} ${favorite.title}` : '—',
        }
      }),
    [children, submissions, transactions, tasks, now],
  )

  const ranking = [...perChild].sort((a, b) => b.monthGains - a.monthGains)
  const medals = ['🥇', '🥈', '🥉']

  const weeklyData = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(now, 3 - i), WEEK)
        const row: Record<string, number | string> = {
          label: i === 3 ? 'Cette sem.' : `S. du ${formatDateShort(weekStart.getTime())}`,
        }
        for (const child of children) {
          row[child.id] = transactions
            .filter(
              (t) =>
                t.childId === child.id &&
                t.type === 'task_approval' &&
                isSameWeek(t.createdAt, weekStart, WEEK),
            )
            .reduce((sum, t) => sum + t.amount, 0)
        }
        return row
      }),
    [children, transactions, now],
  )

  const trendData = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const cutoff = subDays(now, 29 - i).setHours(23, 59, 59, 999)
        const row: Record<string, number | string> = { label: formatDateShort(cutoff) }
        for (const child of children) {
          row[child.id] = transactions
            .filter((t) => t.childId === child.id && t.createdAt <= cutoff)
            .reduce((sum, t) => sum + t.amount, 0)
        }
        return row
      }),
    [children, transactions, now],
  )

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sub of submissions.filter((s) => s.status === 'approved')) {
      const task = tasks.find((t) => t.id === sub.taskId)
      if (task) counts.set(task.category, (counts.get(task.category) ?? 0) + 1)
    }
    return [...counts.entries()].map(([category, count]) => ({
      name: CATEGORIES[category as keyof typeof CATEGORIES].label,
      value: count,
      color: CATEGORIES[category as keyof typeof CATEGORIES].color,
    }))
  }, [submissions, tasks])

  const hasData = transactions.length > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Statistiques</h1>

      <div>
        <h2 className="mb-3 text-lg font-bold">Classement du mois</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ranking.map((entry, i) => {
            const winner = i === 0 && entry.monthGains > 0
            return (
              <Card
                key={entry.child.id}
                className={
                  winner
                    ? 'flex items-center gap-4 border-0 p-5 text-white shadow-md'
                    : 'flex items-center gap-4 p-5'
                }
                style={winner ? { background: childGradient(entry.child.color) } : undefined}
              >
                <span className="text-3xl" aria-hidden>
                  {medals[i] ?? '🏅'}
                </span>
                <ChildAvatar user={entry.child} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">
                    {entry.child.name}
                    {winner && ' — MVP du mois 👑'}
                  </p>
                  <p className={winner ? 'text-sm text-white/85' : 'text-sm text-slate-500 dark:text-slate-400'}>
                    {formatEuro(entry.monthGains)} ce mois-ci
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {perChild.map((entry) => (
          <Card key={entry.child.id} className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <ChildAvatar user={entry.child} size="md" />
              <p className="font-bold">{entry.child.name}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">Solde actuel</dt>
              <dd className="text-right font-bold tabular-nums">{formatEuro(entry.balance)}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Gains semaine</dt>
              <dd className="text-right font-bold tabular-nums">{formatEuro(entry.weekGains)}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Gains mois</dt>
              <dd className="text-right font-bold tabular-nums">{formatEuro(entry.monthGains)}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Tâches validées</dt>
              <dd className="text-right font-bold">{entry.completed}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Taux d'approbation</dt>
              <dd className="text-right font-bold">
                {entry.approvalRate !== null ? `${entry.approvalRate} %` : '—'}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">Tâche préférée</dt>
              <dd className="truncate text-right font-bold">{entry.favorite}</dd>
            </dl>
          </Card>
        ))}
      </div>

      {hasData ? (
        <>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">Gains par semaine</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis tickFormatter={euroTick} fontSize={12} width={44} />
                  <Tooltip formatter={euroTooltip} />
                  <Legend />
                  {children.map((child) => (
                    <Bar
                      key={child.id}
                      dataKey={child.id}
                      name={child.name}
                      fill={child.color}
                      radius={[6, 6, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">Évolution des soldes (30 jours)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} minTickGap={32} />
                  <YAxis tickFormatter={euroTick} fontSize={12} width={44} />
                  <Tooltip formatter={euroTooltip} />
                  <Legend />
                  {children.map((child) => (
                    <Line
                      key={child.id}
                      type="monotone"
                      dataKey={child.id}
                      name={child.name}
                      stroke={child.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {categoryData.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-bold">Répartition par catégorie</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} label>
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      ) : (
        <EmptyState emoji="📊" text="Les graphiques apparaîtront dès les premières tâches validées." />
      )}
    </div>
  )
}
