import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { AVATAR_EMOJIS } from '../../lib/categories'
import { canCreateCustom, MAX_FREE_CUSTOM } from '../../lib/access'
import { useDemoMode } from '../../store/demoStore'
import { useFamilyAuthStore } from '../../store/familyAuthStore'
import { usePremiumUpsellStore } from '../../store/premiumUpsellStore'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { RankDef } from '../../types'

const COLOR_PRESETS = ['#94A3B8', '#22C55E', '#0EA5E9', '#8B5CF6', '#F59E0B', '#F97316', '#EAB308', '#EF4444', '#EC4899']

function RankDefModal({ def, onClose }: { def: RankDef | null; onClose: () => void }) {
  const user = useCurrentUser()
  const saveRankDef = useStore((s) => s.saveRankDef)
  const toast = useStore((s) => s.toast)

  const [label, setLabel] = useState(def?.label ?? '')
  const [emoji, setEmoji] = useState(def?.emoji ?? AVATAR_EMOJIS[0])
  const [color, setColor] = useState(def?.color ?? COLOR_PRESETS[0])
  const [threshold, setThreshold] = useState(String(def?.threshold ?? 0))

  if (!user) return null
  const valid = label.trim() && Number(threshold) >= 0

  function submit() {
    saveRankDef(
      { id: def?.id, label: label.trim(), emoji, color, threshold: Math.max(0, parseInt(threshold, 10) || 0) },
      user!.id,
    )
    toast(def ? 'Rang modifié.' : 'Rang créé.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={def ? 'Modifier le rang' : 'Nouveau rang'}>
      <div className="space-y-4">
        <Field label="Nom *">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex : Expert" autoFocus />
        </Field>
        <Field label="Seuil de points gagnés à vie">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
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
        <Field label="Emoji">
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={cn(
                  'rounded-lg p-1.5 text-2xl cursor-pointer',
                  emoji === e ? 'bg-amber-200 dark:bg-amber-400/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Button className="w-full" disabled={!valid} onClick={submit}>
          {def ? 'Enregistrer' : 'Créer le rang'}
        </Button>
      </div>
    </Modal>
  )
}

export function RankDefsPage() {
  const user = useCurrentUser()
  const rankDefs = useStore((s) => s.rankDefs)
  const deleteRankDef = useStore((s) => s.deleteRankDef)
  const toast = useStore((s) => s.toast)
  const demoActive = useDemoMode((s) => s.active)
  const isFounder = useFamilyAuthStore((s) => s.isFounder)
  const plan = useFamilyAuthStore((s) => s.plan)
  const showUpsell = usePremiumUpsellStore((s) => s.show)

  const [editing, setEditing] = useState<RankDef | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RankDef | null>(null)

  if (!user) return null

  const sorted = [...rankDefs].sort((a, b) => a.threshold - b.threshold)

  // Voir BadgeDefsPage.tsx / lib/access.ts pour le raisonnement complet (ajustement du 31/07).
  const customCount = rankDefs.filter((d) => d.createdBy !== 'system').length
  const canCreateOrEditCustom = demoActive || canCreateCustom(isFounder, plan, customCount)

  function requestNew() {
    if (canCreateOrEditCustom) setEditing('new')
    else showUpsell()
  }

  function requestEdit(def: RankDef) {
    if (def.createdBy !== 'system' || canCreateOrEditCustom) setEditing(def)
    else showUpsell()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Rangs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Progression basée sur les points gagnés à vie — jamais dégressive.
          </p>
        </div>
        <Button onClick={requestNew}>
          <Plus size={18} />
          Nouveau rang
        </Button>
      </div>

      {!canCreateOrEditCustom && (
        <Card className="flex flex-col items-center gap-2 p-5 text-center">
          <span className="text-2xl" aria-hidden>
            ✨
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            La formule gratuite inclut {MAX_FREE_CUSTOM} rang personnalisé. Passez à Premium pour créer ou modifier
            les rangs du catalogue.
          </p>
          <Button size="sm" onClick={showUpsell}>
            Découvrir Premium
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {sorted.map((def) => (
          <Card key={def.id} className="flex items-center gap-3 p-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${def.color}22` }}
            >
              {def.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold" style={{ color: def.color }}>
                {def.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">à partir de {def.threshold} pts à vie</p>
            </div>
            <button
              onClick={() => requestEdit(def)}
              aria-label="Modifier le rang"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setDeleting(def)}
              aria-label="Supprimer le rang"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
        {sorted.length === 0 && <EmptyState emoji="🏅" text="Aucun rang défini." />}
      </div>

      {editing && <RankDefModal def={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer le rang"
        message={`« ${deleting?.label} » sera retiré de l'échelle de progression.`}
        confirmLabel="Oui, supprimer"
        danger
        onConfirm={() => {
          if (deleting) {
            deleteRankDef(deleting.id, user.id)
            toast('Rang supprimé.')
          }
        }}
      />
    </div>
  )
}
