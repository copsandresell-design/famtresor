import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Switch } from '../../components/ui/Switch'
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/categories'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { BadgeDef, BadgeDefParams, BadgeKind, Category } from '../../types'

const KIND_LABELS: Record<BadgeKind, string> = {
  lifetime_tasks: 'Volume de tâches validées (à vie)',
  category_specialist: 'Spécialiste d’une catégorie',
  streak_tier: 'Lié à un palier de série',
  fast_approval: 'Validation rapide',
  initiative: 'Tâches faites en initiative',
  best_week: 'Meilleure semaine (points)',
  perfectionist: 'Sans-faute du mois',
  family_points: 'Points cumulés de la fratrie (mois)',
  month_mvp: 'Meilleur du mois',
  lifetime_points: 'Points cumulés à vie',
  savings_goal: 'Objectif d’épargne atteint',
  shop_first_exchange: 'Premier échange boutique',
  zero_penalty: 'Zéro pénalité (N jours)',
  family_complete: 'Famille complète (jour commun)',
}

type ParamField = 'threshold' | 'category' | 'streakDefId' | 'days' | 'hours'

const KIND_FIELDS: Record<BadgeKind, ParamField[]> = {
  lifetime_tasks: ['threshold'],
  category_specialist: ['category', 'threshold'],
  streak_tier: ['streakDefId', 'days'],
  fast_approval: ['hours'],
  initiative: ['threshold'],
  best_week: ['threshold'],
  perfectionist: ['threshold'],
  family_points: ['threshold'],
  month_mvp: [],
  lifetime_points: ['threshold'],
  savings_goal: ['threshold'],
  shop_first_exchange: [],
  zero_penalty: ['days'],
  family_complete: [],
}

function BadgeDefModal({ def, onClose }: { def: BadgeDef | null; onClose: () => void }) {
  const user = useCurrentUser()
  const streakDefs = useStore((s) => s.streakDefs)
  const saveBadgeDef = useStore((s) => s.saveBadgeDef)
  const toast = useStore((s) => s.toast)

  const [kind, setKind] = useState<BadgeKind>(def?.kind ?? 'lifetime_tasks')
  const [label, setLabel] = useState(def?.label ?? '')
  const [emoji, setEmoji] = useState(def?.emoji ?? '🏅')
  const [description, setDescription] = useState(def?.description ?? '')
  const [points, setPoints] = useState(String(def?.points ?? 50))
  const [threshold, setThreshold] = useState(String(def?.params.threshold ?? 10))
  const [category, setCategory] = useState<Category>(def?.params.category ?? 'cuisine')
  const [streakDefId, setStreakDefId] = useState(def?.params.streakDefId ?? streakDefs[0]?.id ?? '')
  const [days, setDays] = useState(String(def?.params.days ?? 30))
  const [hours, setHours] = useState(String(def?.params.hours ?? 1))
  const [isActive, setIsActive] = useState(def?.isActive ?? true)

  if (!user) return null
  const fields = KIND_FIELDS[kind]
  const valid = label.trim() && description.trim() && Number(points) > 0

  function buildParams(): BadgeDefParams {
    const params: BadgeDefParams = {}
    if (fields.includes('threshold')) params.threshold = Math.max(1, parseInt(threshold, 10) || 1)
    if (fields.includes('category')) params.category = category
    if (fields.includes('streakDefId')) params.streakDefId = streakDefId
    if (fields.includes('days')) params.days = Math.max(1, parseInt(days, 10) || 1)
    if (fields.includes('hours')) params.hours = Math.max(1, parseInt(hours, 10) || 1)
    return params
  }

  function submit() {
    saveBadgeDef(
      {
        id: def?.id,
        kind,
        label: label.trim(),
        emoji,
        description: description.trim(),
        points: Math.max(1, parseInt(points, 10) || 1),
        params: buildParams(),
        isActive,
      },
      user!.id,
    )
    toast(def ? 'Badge modifié.' : 'Badge créé.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={def ? 'Modifier le badge' : 'Nouveau badge'}>
      <div className="space-y-4">
        <Field label="Genre (mécanisme de calcul)">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as BadgeKind)}>
            {(Object.keys(KIND_LABELS) as BadgeKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[1fr,auto] gap-3">
          <Field label="Nom *">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex : Marathonien" autoFocus />
          </Field>
          <Field label="Emoji">
            <input className={`${inputCls} w-16 text-center text-lg`} value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          </Field>
        </div>

        <Field label="Description *">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ce qui débloque ce badge, en une phrase"
          />
        </Field>

        {fields.includes('category') && (
          <Field label="Catégorie">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].emoji} {CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {fields.includes('streakDefId') && (
          <Field label="Série liée">
            <select className={inputCls} value={streakDefId} onChange={(e) => setStreakDefId(e.target.value)}>
              {streakDefs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {fields.includes('threshold') && (
          <Field label="Seuil">
            <input
              className={inputCls}
              type="number"
              min="1"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
        )}
        {fields.includes('days') && (
          <Field label={kind === 'streak_tier' ? 'Palier (jours)' : 'Jours'}>
            <input className={inputCls} type="number" min="1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
        {fields.includes('hours') && (
          <Field label="Délai (heures)">
            <input className={inputCls} type="number" min="1" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        )}

        <Field label="Points offerts au déblocage">
          <input
            className={inputCls}
            type="number"
            min="1"
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <span className="text-sm font-semibold">Actif</span>
          <Switch checked={isActive} onChange={setIsActive} label="Badge actif" />
        </div>

        <Button className="w-full" disabled={!valid} onClick={submit}>
          {def ? 'Enregistrer' : 'Créer le badge'}
        </Button>
      </div>
    </Modal>
  )
}

export function BadgeDefsPage() {
  const user = useCurrentUser()
  const badgeDefs = useStore((s) => s.badgeDefs)
  const saveBadgeDef = useStore((s) => s.saveBadgeDef)
  const deleteBadgeDef = useStore((s) => s.deleteBadgeDef)
  const toast = useStore((s) => s.toast)

  const [editing, setEditing] = useState<BadgeDef | 'new' | null>(null)
  const [deleting, setDeleting] = useState<BadgeDef | null>(null)

  if (!user) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Badges</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{badgeDefs.length} badges dans le catalogue.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={18} />
          Nouveau badge
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {badgeDefs.map((def) => (
          <Card key={def.id} className={`flex items-center gap-3 p-4 ${!def.isActive ? 'opacity-60' : ''}`}>
            <span className="text-2xl" aria-hidden>
              {def.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{def.label}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{def.description}</p>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400">+{def.points} pts</p>
            </div>
            <Switch
              checked={def.isActive}
              onChange={(isActive) => saveBadgeDef({ ...def, isActive }, user.id)}
              label={def.isActive ? 'Désactiver' : 'Activer'}
            />
            <button
              onClick={() => setEditing(def)}
              aria-label="Modifier le badge"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setDeleting(def)}
              aria-label="Supprimer le badge"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
        {badgeDefs.length === 0 && <EmptyState emoji="🏅" text="Aucun badge défini." />}
      </div>

      {editing && <BadgeDefModal def={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer le badge"
        message={`« ${deleting?.label} » sera retiré du catalogue (les points déjà gagnés restent acquis).`}
        confirmLabel="Oui, supprimer"
        danger
        onConfirm={() => {
          if (deleting) {
            deleteBadgeDef(deleting.id, user.id)
            toast('Badge supprimé.')
          }
        }}
      />
    </div>
  )
}
