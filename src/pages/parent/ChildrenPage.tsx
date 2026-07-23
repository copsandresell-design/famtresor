import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { KeyRound, RotateCcw, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedBalance } from '../../components/ui/AnimatedBalance'
import { AvatarEditorModal } from '../../components/ui/AvatarEditorModal'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { computeBalance } from '../../lib/balance'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { User } from '../../types'

const COLOR_PRESETS = ['#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#F97316', '#06B6D4']

function EditChildModal({ child, onClose }: { child: User; onClose: () => void }) {
  const user = useCurrentUser()
  const updateChild = useStore((s) => s.updateChild)
  const changeSecret = useStore((s) => s.changeSecret)
  const toast = useStore((s) => s.toast)
  // Référence toujours à jour (l'avatar/photo peut changer via le modal imbriqué ci-dessous).
  const liveChild = useStore((s) => s.users.find((u) => u.id === child.id)) ?? child

  const [name, setName] = useState(child.name)
  const [color, setColor] = useState(child.color)
  const [pin, setPin] = useState('')
  const [editingAvatar, setEditingAvatar] = useState(false)

  if (!user) return null

  async function submit() {
    if (!name.trim()) return
    updateChild(child.id, { name: name.trim(), color }, user!.id)
    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        toast('Le PIN doit faire exactement 4 chiffres.', 'error')
        return
      }
      await changeSecret(child.id, pin, user!.id)
    }
    toast('Profil mis à jour.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Profil de ${child.name}`}>
      <div className="space-y-4">
        <Field label="Prénom">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Avatar">
          <ChildAvatar user={liveChild} size="lg" onClick={() => setEditingAvatar(true)} />
        </Field>
        <Field label="Couleur">
          <div className="flex gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                aria-label={`Couleur ${preset}`}
                aria-pressed={color === preset}
                className={cn(
                  'h-9 w-9 rounded-full cursor-pointer',
                  color === preset && 'ring-2 ring-offset-2 ring-slate-500 dark:ring-offset-slate-900',
                )}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>
        </Field>
        <Field label="Nouveau PIN (4 chiffres, vide = inchangé)">
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="soft" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void submit()}>Sauvegarder</Button>
        </div>
      </div>

      {editingAvatar && (
        <AvatarEditorModal user={liveChild} actorId={user.id} onClose={() => setEditingAvatar(false)} />
      )}
    </Modal>
  )
}

export function ChildrenPage() {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const updateChild = useStore((s) => s.updateChild)
  const resetBalance = useStore((s) => s.resetBalance)
  const toast = useStore((s) => s.toast)

  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)

  if (!user) return null

  const children = users.filter((u) => u.role === 'child')

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Enfants</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id} className={cn('p-5', !child.isActive && 'opacity-60')}>
            <div className="flex items-center gap-4">
              <ChildAvatar user={child} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  {child.name}
                  {!child.isActive && <Badge>Inactif</Badge>}
                </p>
                <AnimatedBalance cents={computeBalance(transactions, child.id)} className="text-xl font-black" />
                <p className="text-xs text-slate-400">
                  Compte créé le {format(child.createdAt, 'd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="soft" size="sm" onClick={() => setEditing(child)}>
                <KeyRound size={15} />
                Modifier
              </Button>
              <Button variant="soft" size="sm" onClick={() => setResetting(child)}>
                <RotateCcw size={15} />
                Réinitialiser solde
              </Button>
              <Link to="/parent/journal">
                <Button variant="soft" size="sm">
                  <ScrollText size={15} />
                  Journal
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateChild(child.id, { isActive: !child.isActive }, user.id)
                  toast(child.isActive ? `${child.name} est désactivé(e).` : `${child.name} est réactivé(e).`)
                }}
              >
                {child.isActive ? 'Désactiver' : 'Réactiver'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && <EditChildModal child={editing} onClose={() => setEditing(null)} />}
      <ConfirmModal
        open={resetting !== null}
        onClose={() => setResetting(null)}
        title="Réinitialiser le solde"
        message={`Remettre le solde de ${resetting?.name} à zéro ? Un ajustement sera tracé dans le journal.`}
        confirmLabel="Remettre à zéro"
        danger
        onConfirm={() => {
          if (resetting) {
            resetBalance(resetting.id, user.id)
            toast(`Solde de ${resetting.name} remis à zéro.`)
          }
        }}
      />
    </div>
  )
}
