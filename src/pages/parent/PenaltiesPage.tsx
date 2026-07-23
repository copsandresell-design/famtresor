import { AlertTriangle, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Amount } from '../../components/ui/Amount'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { euroToCents, formatDateTime, formatEuro } from '../../lib/format'
import { PENALTY_CANCEL_WINDOW, useCurrentUser, useStore } from '../../store/useStore'

export function PenaltiesPage() {
  const user = useCurrentUser()
  const children = useStore((s) => s.users).filter((u) => u.role === 'child' && u.isActive)
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const applyPenalty = useStore((s) => s.applyPenalty)
  const cancelPenalty = useStore((s) => s.cancelPenalty)
  const toast = useStore((s) => s.toast)

  const [childId, setChildId] = useState(children[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [motif, setMotif] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [confirming, setConfirming] = useState(false)

  if (!user) return null

  const penalties = transactions.filter((t) => t.type === 'penalty')
  const child = children.find((c) => c.id === childId)
  const cents = euroToCents(amount)
  const valid = child && title.trim() && cents > 0

  function confirmApply() {
    if (!valid || !child) return
    const ok = applyPenalty({ childId: child.id, title: title.trim(), motif: motif.trim() || undefined, amount: cents }, user!.id)
    if (ok) {
      toast(`Pénalité de ${formatEuro(cents)} appliquée à ${child.name}.`)
      setTitle('')
      setMotif('')
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Pénalités</h1>

      <Card className="space-y-4 p-5">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} className="text-rose-500" />
          Appliquer une pénalité
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Enfant">
            <select className={inputCls} value={childId} onChange={(e) => setChildId(e.target.value)}>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.avatar} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Montant retiré (€)">
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
        </div>
        <Field label="Titre *">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex : Chambre pas rangée"
          />
        </Field>
        <Field label="Motif (optionnel)">
          <input
            className={inputCls}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="ex : malgré deux rappels"
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="danger" disabled={!valid} onClick={() => setConfirming(true)}>
            Appliquer la pénalité
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold">Historique des pénalités</h2>
        <div className="space-y-3">
          {penalties.map((tx) => {
            const penalizedChild = users.find((u) => u.id === tx.childId)
            const cancellable = !tx.cancelled && Date.now() - tx.createdAt <= PENALTY_CANCEL_WINDOW
            return (
              <Card
                key={tx.id}
                className={`flex items-center gap-3 border-l-4 p-4 ${
                  tx.cancelled ? 'border-l-slate-300 opacity-60' : 'border-l-rose-500'
                }`}
              >
                {penalizedChild && <ChildAvatar user={penalizedChild} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${tx.cancelled ? 'line-through' : ''}`}>
                    {tx.description.replace('⚠️ ', '')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(tx.createdAt)}</p>
                </div>
                {tx.cancelled && <Badge>Annulée</Badge>}
                <Amount cents={tx.amount} className="text-sm" />
                {cancellable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cancelPenalty(tx.id, user.id)
                      toast('Pénalité annulée.')
                    }}
                  >
                    <Undo2 size={16} />
                    Annuler
                  </Button>
                )}
              </Card>
            )
          })}
          {penalties.length === 0 && <EmptyState emoji="😇" text="Aucune pénalité. Que des sages !" />}
        </div>
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmer la pénalité"
        message={`Retirer ${formatEuro(cents)} à ${child?.name} pour « ${title.trim()} » ?`}
        confirmLabel="Oui, appliquer"
        danger
        onConfirm={confirmApply}
      />
    </div>
  )
}
