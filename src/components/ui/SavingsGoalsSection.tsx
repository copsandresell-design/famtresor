import { motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { centsToEuroInput, euroToCents, formatEuro } from '../../lib/format'
import { useStore } from '../../store/useStore'
import type { SavingsGoal } from '../../types'
import { Button } from './Button'
import { Card } from './Card'
import { ConfirmModal } from './ConfirmModal'
import { inputCls } from './Field'
import { Modal } from './Modal'

const GOAL_ICONS = ['🎮', '🎧', '📱', '🚲', '🎨', '🧸', '⚽', '🎁', '🍦', '🛹', '🎸', '📚']

function GoalCard({ goal, balance, canDelete, onDelete }: {
  goal: SavingsGoal
  balance: number
  canDelete: boolean
  onDelete: () => void
}) {
  const progress = Math.max(0, Math.min(1, balance / goal.targetAmount))
  const reached = balance >= goal.targetAmount
  return (
    <Card className={`space-y-2 p-4 ${reached ? 'border-emerald-300 dark:border-emerald-700' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {goal.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{goal.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {reached ? 'Objectif atteint ! 🎉' : `${formatEuro(Math.max(0, goal.targetAmount - balance))} restants`}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            aria-label="Supprimer l'objectif"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', damping: 20 }}
        />
      </div>
      <p className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
        {formatEuro(Math.min(balance, goal.targetAmount))} / {formatEuro(goal.targetAmount)}
      </p>
    </Card>
  )
}

/** Objectifs d'épargne d'un enfant : à placer dans le profil (enfant) et éventuellement côté parent. */
export function SavingsGoalsSection({
  childId,
  balance,
  actorId,
  canCreate = true,
  canDelete = true,
}: {
  childId: string
  balance: number
  actorId: string
  canCreate?: boolean
  canDelete?: boolean
}) {
  const savingsGoals = useStore((s) => s.savingsGoals)
  const addSavingsGoal = useStore((s) => s.addSavingsGoal)
  const deleteSavingsGoal = useStore((s) => s.deleteSavingsGoal)
  const toast = useStore((s) => s.toast)

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [icon, setIcon] = useState(GOAL_ICONS[0])
  const [toDelete, setToDelete] = useState<SavingsGoal | null>(null)

  const goals = savingsGoals
    .filter((g) => g.childId === childId)
    .sort((a, b) => a.targetAmount - balance - (b.targetAmount - balance))

  function closeCreate() {
    setCreating(false)
    setTitle('')
    setAmount('')
    setIcon(GOAL_ICONS[0])
  }

  function confirmCreate() {
    const cents = euroToCents(amount)
    if (!title.trim() || cents <= 0) {
      toast('Donne un nom et un montant valide.', 'error')
      return
    }
    addSavingsGoal(childId, title, icon, cents, actorId)
    toast('Objectif créé ! 🎯')
    closeCreate()
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Mes objectifs d'épargne 🎯</h2>
        {canCreate && (
          <Button size="sm" variant="soft" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Nouveau
          </Button>
        )}
      </div>

      {goals.length === 0 ? (
        <Card className="p-5 text-center text-sm text-slate-500 dark:text-slate-400">
          Aucun objectif pour l'instant. {canCreate && 'Crée-en un pour te motiver à épargner !'}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              balance={balance}
              canDelete={canDelete}
              onDelete={() => setToDelete(goal)}
            />
          ))}
        </div>
      )}

      <Modal open={creating} onClose={closeCreate} title="Nouvel objectif d'épargne">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Icône</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${
                    icon === emoji
                      ? 'bg-gradient-to-br from-blue-500 to-violet-500 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                  aria-label={`Choisir ${emoji}`}
                  aria-pressed={icon === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Nom de l'objectif</p>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Nouveau jeu vidéo"
              maxLength={40}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Montant visé (€)</p>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={centsToEuroInput(3000)}
            />
          </div>
          <Button className="w-full" onClick={confirmCreate}>
            Créer l'objectif
          </Button>
        </div>
      </Modal>

      {toDelete && (
        <ConfirmModal
          open
          onClose={() => setToDelete(null)}
          title="Supprimer l'objectif"
          message={`Supprimer « ${toDelete.title} » ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => deleteSavingsGoal(toDelete.id, actorId)}
        />
      )}
    </section>
  )
}
