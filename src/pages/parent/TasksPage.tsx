import { ArrowUpDown, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { inputCls } from '../../components/ui/Field'
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/categories'
import { formatEuro } from '../../lib/format'
import { describeRecurrence } from '../../lib/recurrence'
import { useStore } from '../../store/useStore'
import type { Category, Task } from '../../types'
import { TaskFormModal } from './TaskFormModal'

type Sort = 'recent' | 'amount-desc' | 'amount-asc' | 'title'

const SORTS: Record<Sort, { label: string; compare: (a: Task, b: Task) => number }> = {
  recent: { label: 'Plus récentes', compare: (a, b) => b.createdAt - a.createdAt },
  'amount-desc': { label: 'Montant ↓', compare: (a, b) => b.amount - a.amount },
  'amount-asc': { label: 'Montant ↑', compare: (a, b) => a.amount - b.amount },
  title: { label: 'Titre A→Z', compare: (a, b) => a.title.localeCompare(b.title, 'fr') },
}

export function TasksPage() {
  const tasks = useStore((s) => s.tasks)
  const children = useStore((s) => s.users).filter((u) => u.role === 'child')
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [childFilter, setChildFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | Task['type']>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (searchParams.has('nouveau')) {
      setCreating(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
          if (childFilter !== 'all' && !task.assignedTo.includes(childFilter)) return false
          if (categoryFilter !== 'all' && task.category !== categoryFilter) return false
          if (typeFilter !== 'all' && task.type !== typeFilter) return false
          return true
        })
        .sort(SORTS[sort].compare),
    [tasks, search, childFilter, categoryFilter, typeFilter, sort],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Tâches</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} sur {tasks.length}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} />
          Nouvelle tâche
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="relative col-span-2 sm:col-span-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une tâche"
          />
        </label>
        <select className={inputCls} value={childFilter} onChange={(e) => setChildFilter(e.target.value)} aria-label="Filtrer par enfant">
          <option value="all">Tous les enfants</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | Category)}
          aria-label="Filtrer par catégorie"
        >
          <option value="all">Toutes catégories</option>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key].label}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | Task['type'])}
          aria-label="Filtrer par type"
        >
          <option value="all">Tous types</option>
          <option value="recurrente">Récurrentes</option>
          <option value="ponctuelle">Ponctuelles</option>
        </select>
        <label className="relative col-span-2 sm:col-span-1">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className={`${inputCls} pl-8`}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Trier les tâches"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.map((task) => (
          <button
            key={task.id}
            onClick={() => setEditing(task)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${CATEGORIES[task.category].color}18` }}
              aria-hidden
            >
              {task.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{task.title}</p>
                <Badge className="hidden shrink-0 sm:inline-flex">
                  {CATEGORIES[task.category].emoji} {CATEGORIES[task.category].label}
                </Badge>
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {describeRecurrence(task)} ·{' '}
                {task.assignedTo
                  .map((id) => children.find((c) => c.id === id)?.name)
                  .filter(Boolean)
                  .join(' + ')}
              </p>
            </div>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{formatEuro(task.amount)}
            </span>
            <Pencil size={16} className="text-slate-400" />
          </button>
        ))}
        {filtered.length === 0 && <EmptyState emoji="🔍" text="Aucune tâche ne correspond." />}
      </Card>

      {creating && <TaskFormModal open onClose={() => setCreating(false)} />}
      {editing && <TaskFormModal open task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
