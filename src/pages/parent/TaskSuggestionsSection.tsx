import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { CATEGORIES, CATEGORY_KEYS, TASK_EMOJIS } from '../../lib/categories'
import { formatRelative } from '../../lib/format'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { Category, TaskSuggestion } from '../../types'

/** Le parent peut tout ajuster avant d'approuver — la proposition n'est qu'un point de départ. */
function ApproveSuggestionModal({ suggestion, onClose }: { suggestion: TaskSuggestion; onClose: () => void }) {
  const user = useCurrentUser()
  const children = useStore((s) => s.users).filter((u) => u.role === 'child' && u.isActive)
  const approveTaskSuggestion = useStore((s) => s.approveTaskSuggestion)
  const toast = useStore((s) => s.toast)
  const [title, setTitle] = useState(suggestion.title)
  const [description, setDescription] = useState(suggestion.description ?? '')
  const [points, setPoints] = useState(String(suggestion.suggestedPoints))
  const [category, setCategory] = useState<Category>(suggestion.category)
  const [icon, setIcon] = useState(suggestion.icon)
  const [assignedTo, setAssignedTo] = useState<string[]>([suggestion.childId])

  if (!user) return null

  function toggleChild(id: string) {
    setAssignedTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function submit() {
    const pointsValue = parseInt(points, 10)
    if (!title.trim() || !Number.isFinite(pointsValue) || pointsValue <= 0 || assignedTo.length === 0) {
      toast('Titre, points positifs et au moins un enfant sont requis.', 'error')
      return
    }
    approveTaskSuggestion(
      suggestion.id,
      {
        title: title.trim(),
        description: description.trim() || undefined,
        icon,
        category,
        points: pointsValue,
        assignedTo,
      },
      user!.id,
    )
    toast('Proposition approuvée, la tâche est active !')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Approuver « ${suggestion.title} »`} wide>
      <div className="space-y-4">
        <Field label="Titre *">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Description (optionnel)">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Points *">
            <input
              className={inputCls}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </Field>
          <Field label="Catégorie">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].emoji} {CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Icône">
          <div className="flex flex-wrap gap-1.5">
            {TASK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                aria-pressed={icon === emoji}
                className={cn(
                  'rounded-lg p-1.5 text-xl cursor-pointer',
                  icon === emoji ? 'bg-amber-200 dark:bg-amber-400/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Assignée à *">
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => toggleChild(child.id)}
                aria-pressed={assignedTo.includes(child.id)}
                className={cn(
                  'rounded-xl border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer',
                  assignedTo.includes(child.id)
                    ? 'border-transparent text-white'
                    : 'border-slate-300 text-slate-500 dark:border-slate-700',
                )}
                style={assignedTo.includes(child.id) ? { backgroundColor: child.color } : undefined}
              >
                {child.avatar} {child.name}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Créée comme tâche ponctuelle — modifiable ensuite (fréquence, etc.) depuis la liste des tâches.
        </p>
        <Button className="w-full" onClick={submit}>
          Approuver et créer la tâche
        </Button>
      </div>
    </Modal>
  )
}

function RejectSuggestionModal({ suggestion, onClose }: { suggestion: TaskSuggestion; onClose: () => void }) {
  const user = useCurrentUser()
  const rejectTaskSuggestion = useStore((s) => s.rejectTaskSuggestion)
  const toast = useStore((s) => s.toast)
  const [reason, setReason] = useState('')

  if (!user) return null

  return (
    <Modal open onClose={onClose} title="Refuser la proposition">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Explique pourquoi (optionnel), pour que l'enfant comprenne.
      </p>
      <textarea
        className={inputCls}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="ex : déjà couvert par une tâche existante"
        autoFocus
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="soft" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            rejectTaskSuggestion(suggestion.id, user!.id, reason.trim() || undefined)
            toast('Proposition refusée.')
            onClose()
          }}
        >
          Refuser
        </Button>
      </div>
    </Modal>
  )
}

export function TaskSuggestionsSection() {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const taskSuggestions = useStore((s) => s.taskSuggestions)
  const [approving, setApproving] = useState<TaskSuggestion | null>(null)
  const [rejecting, setRejecting] = useState<TaskSuggestion | null>(null)

  if (!user) return null

  const pending = taskSuggestions.filter((s) => s.status === 'pending')
  const decided = taskSuggestions.filter((s) => s.status !== 'pending').slice(0, 20)
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '?'

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {pending.map((sug) => (
          <Card key={sug.id} className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {sug.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{sug.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proposé par {nameOf(sug.childId)} · {formatRelative(sug.createdAt)}
                </p>
                {sug.description && (
                  <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">« {sug.description} »</p>
                )}
              </div>
              <span className="font-bold text-violet-600 dark:text-violet-400">{sug.suggestedPoints} pts</span>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="soft" size="sm" onClick={() => setRejecting(sug)}>
                <X size={16} />
                Refuser
              </Button>
              <Button variant="success" size="sm" onClick={() => setApproving(sug)}>
                <Check size={16} />
                Approuver
              </Button>
            </div>
          </Card>
        ))}
        {pending.length === 0 && <EmptyState emoji="💡" text="Aucune proposition en attente." />}
      </div>

      {decided.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold">Historique</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {decided.map((sug) => (
              <div key={sug.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden>
                  {sug.icon}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {sug.title} · {nameOf(sug.childId)}
                </p>
                <Badge tone={sug.status === 'approved' ? 'green' : 'neutral'}>
                  {sug.status === 'approved' ? 'Approuvée' : 'Refusée'}
                </Badge>
              </div>
            ))}
          </Card>
        </div>
      )}

      {approving && <ApproveSuggestionModal suggestion={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectSuggestionModal suggestion={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
