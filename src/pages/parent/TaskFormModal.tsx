import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { CATEGORIES, CATEGORY_KEYS, DIFFICULTIES, TASK_EMOJIS } from '../../lib/categories'
import { centsToEuroInput, euroToCents } from '../../lib/format'
import { DAYS_FR } from '../../lib/recurrence'
import { useCurrentUser, useStore, type TaskInput } from '../../store/useStore'
import type { Category, Difficulty, Frequency, Task } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  task?: Task
}

export function TaskFormModal({ open, onClose, task }: Props) {
  const user = useCurrentUser()
  const saveTask = useStore((s) => s.saveTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const toast = useStore((s) => s.toast)
  const children = useStore((s) => s.users).filter((u) => u.role === 'child' && u.isActive)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [amount, setAmount] = useState(task ? centsToEuroInput(task.amount) : '1.50')
  const [category, setCategory] = useState<Category>(task?.category ?? 'menage')
  const [icon, setIcon] = useState(task?.icon ?? '🧹')
  const [type, setType] = useState<Task['type']>(task?.type ?? 'recurrente')
  const [frequency, setFrequency] = useState<Frequency>(task?.recurrence?.frequency ?? 'daily')
  const [dayOfWeek, setDayOfWeek] = useState(task?.recurrence?.dayOfWeek ?? 0)
  const [dayOfMonth, setDayOfMonth] = useState(task?.recurrence?.dayOfMonth ?? 1)
  const [assignedTo, setAssignedTo] = useState<string[]>(task?.assignedTo ?? children.map((c) => c.id))
  const [difficulty, setDifficulty] = useState<Difficulty>(task?.difficulty ?? 'easy')
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
  )

  if (!user) return null

  function toggleChild(id: string) {
    setAssignedTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function submit() {
    const cents = euroToCents(amount)
    if (!title.trim() || cents <= 0 || assignedTo.length === 0) {
      toast('Titre, montant positif et au moins un enfant sont requis.', 'error')
      return
    }
    const input: TaskInput = {
      id: task?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      amount: cents,
      category,
      icon,
      type,
      recurrence:
        type === 'recurrente'
          ? {
              frequency,
              dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
              dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
            }
          : undefined,
      assignedTo,
      difficulty,
      dueDate: type === 'ponctuelle' && dueDate ? new Date(dueDate).getTime() : undefined,
    }
    saveTask(input, user!.id)
    toast(task ? 'Tâche modifiée.' : 'Tâche créée.')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Modifier la tâche' : 'Nouvelle tâche'} wide>
      <div className="space-y-4">
        <Field label="Titre *">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>

        <Field label="Description (optionnel)">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex : avec l'aspirateur, tapis compris"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Montant (€) *">
            <input
              className={inputCls}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Catégorie">
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
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
                  icon === emoji
                    ? 'bg-amber-200 dark:bg-amber-400/30'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as Task['type'])}>
              <option value="recurrente">Récurrente</option>
              <option value="ponctuelle">Ponctuelle (une fois)</option>
            </select>
          </Field>
          {type === 'recurrente' ? (
            <Field label="Fréquence">
              <select
                className={inputCls}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
              >
                <option value="daily">Quotidienne</option>
                <option value="twice-weekly">2× par semaine</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </Field>
          ) : (
            <Field label="Date limite (optionnel)">
              <input
                className={inputCls}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          )}
        </div>

        {type === 'recurrente' && frequency === 'weekly' && (
          <Field label="Quel jour ?">
            <select className={inputCls} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS_FR.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
        )}
        {type === 'recurrente' && frequency === 'monthly' && (
          <Field label="Quel jour du mois ? (1–28)">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value))))}
            />
          </Field>
        )}

        <Field label="Assignée à *">
          <div className="flex gap-2">
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

        <Field label="Difficulté">
          <div className="flex gap-2">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDifficulty(key)}
                aria-pressed={difficulty === key}
                className={cn(
                  'flex-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer',
                  difficulty === key
                    ? 'border-amber-400 bg-amber-100 dark:bg-amber-400/20'
                    : 'border-slate-300 text-slate-500 dark:border-slate-700',
                )}
              >
                {DIFFICULTIES[key].label}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex justify-between gap-2 pt-2">
          {task ? (
            <Button
              variant="danger"
              onClick={() => {
                deleteTask(task.id, user!.id)
                toast('Tâche supprimée.')
                onClose()
              }}
            >
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="soft" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={submit}>Sauvegarder</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
