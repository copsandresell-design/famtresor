import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Switch } from '../../components/ui/Switch'
import { canCreateCustom, MAX_FREE_CUSTOM } from '../../lib/access'
import { useDemoMode } from '../../store/demoStore'
import { useFamilyAuthStore } from '../../store/familyAuthStore'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { StreakDef, StreakKind, StreakTier } from '../../types'

const KIND_LABELS: Record<StreakKind, string> = {
  global: 'Globale (une tâche par jour, toutes tâches confondues)',
  no_penalty: 'Sans pénalité (jours consécutifs sans pénalité)',
  task: 'Liée à une tâche précise',
}

function StreakDefModal({ def, onClose }: { def: StreakDef | null; onClose: () => void }) {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const saveStreakDef = useStore((s) => s.saveStreakDef)
  const toast = useStore((s) => s.toast)

  const [kind, setKind] = useState<StreakKind>(def?.kind ?? 'task')
  const [label, setLabel] = useState(def?.label ?? '')
  const [emoji, setEmoji] = useState(def?.emoji ?? '🔥')
  const [taskId, setTaskId] = useState(def?.taskId ?? tasks[0]?.id ?? '')
  const [tiers, setTiers] = useState<StreakTier[]>(def?.tiers.length ? def.tiers : [{ days: 5, points: 25 }])
  const [isActive, setIsActive] = useState(def?.isActive ?? true)

  if (!user) return null
  const valid = label.trim() && (kind !== 'task' || taskId) && tiers.every((t) => t.days > 0 && t.points > 0)

  function updateTier(i: number, patch: Partial<StreakTier>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }

  function submit() {
    saveStreakDef(
      {
        id: def?.id,
        kind,
        label: label.trim(),
        emoji,
        taskId: kind === 'task' ? taskId : undefined,
        tiers: [...tiers].sort((a, b) => a.days - b.days),
        isActive,
      },
      user!.id,
    )
    toast(def ? 'Série modifiée.' : 'Série créée.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={def ? 'Modifier la série' : 'Nouvelle série'}>
      <div className="space-y-4">
        <Field label="Genre">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StreakKind)}>
            {(Object.keys(KIND_LABELS) as StreakKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        {kind === 'task' && (
          <Field label="Tâche liée">
            <select className={inputCls} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-[1fr,auto] gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex : Chambre rangée" autoFocus />
          </Field>
          <Field label="Emoji">
            <input className={`${inputCls} w-16 text-center text-lg`} value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Paliers (jours consécutifs → bonus en points)</p>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={tier.days}
                  onChange={(e) => updateTier(i, { days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  placeholder="jours"
                  aria-label={`Palier ${i + 1} — jours`}
                />
                <span className="shrink-0 text-xs text-slate-400">j →</span>
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={tier.points}
                  onChange={(e) => updateTier(i, { points: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  placeholder="points"
                  aria-label={`Palier ${i + 1} — points`}
                />
                <span className="shrink-0 text-xs text-slate-400">pts</span>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={tiers.length === 1}
                  aria-label="Supprimer ce palier"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-950/40"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="soft"
            size="sm"
            className="mt-2"
            onClick={() => setTiers((prev) => [...prev, { days: (prev.at(-1)?.days ?? 0) + 7, points: 50 }])}
          >
            <Plus size={14} />
            Ajouter un palier
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <span className="text-sm font-semibold">Active</span>
          <Switch checked={isActive} onChange={setIsActive} label="Série active" />
        </div>

        <Button className="w-full" disabled={!valid} onClick={submit}>
          {def ? 'Enregistrer' : 'Créer la série'}
        </Button>
      </div>
    </Modal>
  )
}

export function StreakDefsPage() {
  const user = useCurrentUser()
  const streakDefs = useStore((s) => s.streakDefs)
  const tasks = useStore((s) => s.tasks)
  const saveStreakDef = useStore((s) => s.saveStreakDef)
  const deleteStreakDef = useStore((s) => s.deleteStreakDef)
  const toast = useStore((s) => s.toast)
  const demoActive = useDemoMode((s) => s.active)
  const isFounder = useFamilyAuthStore((s) => s.isFounder)
  const plan = useFamilyAuthStore((s) => s.plan)

  const [editing, setEditing] = useState<StreakDef | 'new' | null>(null)
  const [deleting, setDeleting] = useState<StreakDef | null>(null)

  if (!user) return null

  // Voir BadgeDefsPage.tsx / lib/access.ts pour le raisonnement complet (ajustement du 31/07).
  const customCount = streakDefs.filter((d) => d.createdBy !== 'system').length
  const canCreateOrEditCustom = demoActive || canCreateCustom(isFounder, plan, customCount)

  function requestNew() {
    if (canCreateOrEditCustom) setEditing('new')
    else toast(`Passez à Premium pour créer plus de ${MAX_FREE_CUSTOM} série personnalisée.`, 'error')
  }

  function requestEdit(def: StreakDef) {
    if (def.createdBy !== 'system' || canCreateOrEditCustom) setEditing(def)
    else toast('Passez à Premium pour modifier les séries du catalogue par défaut.', 'error')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Séries</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Globale, sans pénalité, ou liée à une tâche précise — avec leurs paliers de bonus.
          </p>
        </div>
        <Button onClick={requestNew}>
          <Plus size={18} />
          Nouvelle série
        </Button>
      </div>

      {!canCreateOrEditCustom && (
        <Card className="flex flex-col items-center gap-2 p-5 text-center">
          <span className="text-2xl" aria-hidden>
            ✨
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            La formule gratuite inclut {MAX_FREE_CUSTOM} série personnalisée. Passez à Premium pour créer ou modifier
            les séries du catalogue.
          </p>
          <Button size="sm" onClick={() => toast('Le paiement Premium arrive bientôt !')}>
            Découvrir Premium
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {streakDefs.map((def) => {
          const task = def.taskId ? tasks.find((t) => t.id === def.taskId) : undefined
          return (
            <Card key={def.id} className={`p-4 ${!def.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {def.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{def.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {KIND_LABELS[def.kind]}
                    {task && ` · ${task.title}`}
                  </p>
                </div>
                <Switch
                  checked={def.isActive}
                  onChange={(isActive) => saveStreakDef({ ...def, isActive }, user.id)}
                  label={def.isActive ? 'Désactiver' : 'Activer'}
                />
                <button
                  onClick={() => requestEdit(def)}
                  aria-label="Modifier la série"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeleting(def)}
                  aria-label="Supprimer la série"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                {def.tiers.map((t) => (
                  <span
                    key={t.days}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {t.days} j → +{t.points} pts
                  </span>
                ))}
              </div>
            </Card>
          )
        })}
        {streakDefs.length === 0 && <EmptyState emoji="🔥" text="Aucune série définie." />}
      </div>

      {editing && <StreakDefModal def={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer la série"
        message={`« ${deleting?.label} » et ses paliers seront supprimés (les points déjà gagnés restent acquis).`}
        confirmLabel="Oui, supprimer"
        danger
        onConfirm={() => {
          if (deleting) {
            deleteStreakDef(deleting.id, user.id)
            toast('Série supprimée.')
          }
        }}
      />
    </div>
  )
}
