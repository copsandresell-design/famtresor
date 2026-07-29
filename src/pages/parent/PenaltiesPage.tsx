import { AlertTriangle, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Amount } from '../../components/ui/Amount'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { centsToEuroInput, euroToCents, formatDateTime, formatEuro } from '../../lib/format'
import { PENALTY_CANCEL_WINDOW, useCurrentUser, useStore } from '../../store/useStore'
import type { Transaction } from '../../types'

function EditPenaltyModal({
  tx,
  onClose,
}: {
  tx: Transaction
  onClose: () => void
}) {
  const user = useCurrentUser()
  const editPenaltyTransaction = useStore((s) => s.editPenaltyTransaction)
  const toast = useStore((s) => s.toast)
  const parts = tx.description.replace('⚠️ ', '').split(' — ')
  const [title, setTitle] = useState(parts[0] ?? '')
  const [motif, setMotif] = useState(parts.slice(1).join(' — '))
  const [amount, setAmount] = useState(centsToEuroInput(Math.abs(tx.amount)))

  if (!user) return null
  const cents = euroToCents(amount)
  const valid = title.trim() && cents > 0

  return (
    <Modal open onClose={onClose} title="Modifier la pénalité">
      <div className="space-y-4">
        <Field label="Titre *">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Motif (optionnel)">
          <input className={inputCls} value={motif} onChange={(e) => setMotif(e.target.value)} />
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
        <div className="flex justify-end gap-2">
          <Button variant="soft" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const ok = editPenaltyTransaction(
                tx.id,
                { title: title.trim(), motif: motif.trim() || undefined, amount: cents },
                user.id,
              )
              toast(ok ? 'Pénalité modifiée.' : 'Impossible de modifier cette pénalité.', ok ? 'success' : 'error')
              onClose()
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function PenaltiesPage() {
  const user = useCurrentUser()
  const children = useStore((s) => s.users).filter((u) => u.role === 'child' && u.isActive)
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const applyPenalty = useStore((s) => s.applyPenalty)
  const cancelPenalty = useStore((s) => s.cancelPenalty)
  const deletePenaltyTransaction = useStore((s) => s.deletePenaltyTransaction)
  const toast = useStore((s) => s.toast)

  const [childId, setChildId] = useState(children[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [motif, setMotif] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

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
                {!tx.cancelled && cancellable && (
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
                {!tx.cancelled && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(tx)} aria-label="Modifier">
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(tx)}
                      aria-label="Supprimer"
                      className="text-rose-500"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </>
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

      {editing && <EditPenaltyModal tx={editing} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer la pénalité"
        message={`« ${deleting?.description.replace('⚠️ ', '')} » sera annulée et le montant remboursé, sans limite de temps. Continuer ?`}
        confirmLabel="Oui, supprimer"
        danger
        onConfirm={() => {
          if (deleting && user) {
            deletePenaltyTransaction(deleting.id, user.id)
            toast('Pénalité supprimée.')
          }
        }}
      />
    </div>
  )
}
