import { ChevronRight, Medal, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Field, inputCls } from '../../components/ui/Field'
import { PushNotificationsCard } from '../../components/ui/PushNotificationsCard'
import { Switch } from '../../components/ui/Switch'
import { centsToEuroInput, euroToCents } from '../../lib/format'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { FeatureFlags, Theme } from '../../types'

const GAMIFICATION_LINKS = [
  { to: '/parent/reglages/badges', icon: Medal, label: 'Badges', description: 'Catalogue, seuils et points de chaque badge.' },
  { to: '/parent/reglages/series', icon: Sparkles, label: 'Séries', description: 'Séries globale, sans pénalité, ou liées à une tâche.' },
  { to: '/parent/reglages/rangs', icon: Trophy, label: 'Rangs', description: 'Échelle de progression à vie et ses seuils.' },
]

const FEATURE_LABELS: { key: keyof FeatureFlags; emoji: string; label: string; description: string }[] = [
  {
    key: 'savingsGoals',
    emoji: '🎯',
    label: "Objectifs d'épargne",
    description: 'Chaque enfant peut se fixer un objectif (ex: un jeu) avec une barre de progression.',
  },
  {
    key: 'streaks',
    emoji: '🔥',
    label: 'Séries (streaks)',
    description: 'Suivi des jours consécutifs avec au moins une tâche faite, affiché sur leur accueil.',
  },
  {
    key: 'leaderboard',
    emoji: '🏆',
    label: 'Classement',
    description: "Classement des enfants par gains du mois, visible sur ta vue d'ensemble.",
  },
  {
    key: 'shop',
    emoji: '🎁',
    label: 'Boutique à points',
    description:
      'Les enfants gagnent des points (badges, séries) et les échangent contre des lots que tu définis, ou les convertissent en argent.',
  },
]

export function SettingsPage() {
  const user = useCurrentUser()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const changeSecret = useStore((s) => s.changeSecret)
  const resetAllBalances = useStore((s) => s.resetAllBalances)
  const toast = useStore((s) => s.toast)

  const [familyName, setFamilyName] = useState(settings.familyName)
  const [bonus, setBonus] = useState(String(settings.initiativeBonus))
  const [minBalance, setMinBalance] = useState(centsToEuroInput(settings.minBalance))
  const [password, setPassword] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [pointsPerEuro, setPointsPerEuro] = useState(String(settings.pointsPerEuro))
  const [thresholdDays, setThresholdDays] = useState(String(settings.inactivityPenalty.thresholdDays))
  const [baseAmount, setBaseAmount] = useState(centsToEuroInput(settings.inactivityPenalty.baseAmountCents))
  const [baseAmountPoints, setBaseAmountPoints] = useState(String(settings.inactivityPenalty.baseAmountPoints))
  const [severityMultiplier, setSeverityMultiplier] = useState(String(settings.inactivityPenalty.severityMultiplier))

  if (!user) return null

  function saveRules() {
    updateSettings(
      {
        familyName: familyName.trim() || 'FamTrésor',
        initiativeBonus: Math.max(0, parseInt(bonus, 10) || 0),
        minBalance: Math.min(0, euroToCents(minBalance)),
      },
      user!.id,
    )
    toast('Réglages enregistrés.')
  }

  function savePointsSettings() {
    updateSettings({ pointsPerEuro: Math.max(1, parseInt(pointsPerEuro, 10) || settings.pointsPerEuro) }, user!.id)
    toast('Taux de conversion enregistré.')
  }

  function saveInactivitySettings() {
    updateSettings(
      {
        inactivityPenalty: {
          ...settings.inactivityPenalty,
          thresholdDays: Math.max(1, parseInt(thresholdDays, 10) || 1),
          baseAmountCents: Math.max(0, euroToCents(baseAmount)),
          baseAmountPoints: Math.max(0, parseInt(baseAmountPoints, 10) || 0),
          severityMultiplier: Math.max(0.1, parseFloat(severityMultiplier.replace(',', '.')) || 1),
        },
      },
      user!.id,
    )
    toast('Réglages des pénalités automatiques enregistrés.')
  }

  async function savePassword() {
    if (password.length < 4) {
      toast('Le mot de passe doit faire au moins 4 caractères.', 'error')
      return
    }
    await changeSecret(user!.id, password, user!.id)
    setPassword('')
    toast('Mot de passe modifié.')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Réglages</h1>

      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Famille & règles de la maison</h2>
        <Field label="Nom de la famille">
          <input className={inputCls} value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bonus initiative (points)">
            <input
              className={inputCls}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
            />
          </Field>
          <Field label="Solde minimum toléré (€, négatif)">
            <input
              className={inputCls}
              type="number"
              max="0"
              step="0.01"
              inputMode="decimal"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveRules}>Enregistrer</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Apparence</h2>
        <Field label="Thème">
          <select
            className={inputCls}
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as Theme }, user.id)}
          >
            <option value="auto">Automatique (système)</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-bold">Fonctionnalités</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Active ou désactive des fonctionnalités pour toute la famille.
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {FEATURE_LABELS.map(({ key, emoji, label, description }) => (
            <div key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="text-xl" aria-hidden>
                {emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <Switch
                checked={settings.features[key]}
                onChange={(checked) =>
                  updateSettings({ features: { ...settings.features, [key]: checked } }, user.id)
                }
                label={label}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-bold">Points & pénalités automatiques</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Taux de conversion de la boutique, et pénalités appliquées automatiquement.
          </p>
        </div>

        <Field label="Taux de conversion (points pour 1 €)">
          <input
            className={inputCls}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={pointsPerEuro}
            onChange={(e) => setPointsPerEuro(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="soft" onClick={savePointsSettings}>
            Enregistrer le taux
          </Button>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <span className="text-xl" aria-hidden>
            🔁
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Pénalités récurrentes</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Autorise la création de règles de pénalité automatiques (page Pénalités), ex : chambre pas
              rangée le dimanche soir.
            </p>
          </div>
          <Switch
            checked={settings.features.recurringPenalties}
            onChange={(checked) =>
              updateSettings({ features: { ...settings.features, recurringPenalties: checked } }, user.id)
            }
            label="Pénalités récurrentes"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <span className="text-xl" aria-hidden>
            😴
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Pénalités d'inactivité</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pénalité automatique (une fois par jour, via une tâche planifiée) si un enfant n'a validé
              aucune tâche depuis trop longtemps. S'aggrave avec le temps.
            </p>
          </div>
          <Switch
            checked={settings.features.inactivityPenalties}
            onChange={(checked) =>
              updateSettings({ features: { ...settings.features, inactivityPenalties: checked } }, user.id)
            }
            label="Pénalités d'inactivité"
          />
        </div>

        {settings.features.inactivityPenalties && (
          <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <Field label="Déclencher après (jours sans tâche validée)">
              <input
                className={inputCls}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant de base (€)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                />
              </Field>
              <Field label="Montant de base (points)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={baseAmountPoints}
                  onChange={(e) => setBaseAmountPoints(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Multiplicateur d'aggravation (jour 1 = base × mult, jour 2 = 2 × base × mult…)">
              <input
                className={inputCls}
                type="number"
                min="0.1"
                step="0.1"
                inputMode="decimal"
                value={severityMultiplier}
                onChange={(e) => setSeverityMultiplier(e.target.value)}
              />
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.inactivityPenalty.applyMoney}
                  onChange={(e) =>
                    updateSettings(
                      { inactivityPenalty: { ...settings.inactivityPenalty, applyMoney: e.target.checked } },
                      user.id,
                    )
                  }
                  className="h-4 w-4 accent-amber-500"
                />
                En argent
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.inactivityPenalty.applyPoints}
                  onChange={(e) =>
                    updateSettings(
                      { inactivityPenalty: { ...settings.inactivityPenalty, applyPoints: e.target.checked } },
                      user.id,
                    )
                  }
                  className="h-4 w-4 accent-amber-500"
                />
                En points
              </label>
            </div>
            <div className="flex justify-end">
              <Button variant="soft" onClick={saveInactivitySettings}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-2 p-5">
        <div>
          <h2 className="font-bold">Gamification</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Catalogue de badges, séries et rangs — tout est modifiable ici, sans redéploiement.
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {GAMIFICATION_LINKS.map(({ to, icon: Icon, label, description }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </Link>
          ))}
        </div>
      </Card>

      <PushNotificationsCard userId={user.id} />

      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Sécurité</h2>
        <Field label={`Nouveau mot de passe pour ${user.name}`}>
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 4 caractères"
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="soft" onClick={() => void savePassword()} disabled={!password}>
            Changer le mot de passe
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Les PIN des enfants se changent depuis la page Enfants.
        </p>
      </Card>

      <Card className="space-y-3 border-rose-200 p-5 dark:border-rose-900">
        <h2 className="font-bold text-rose-600 dark:text-rose-400">Zone sensible</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Remet le solde de tous les enfants à zéro. Chaque ajustement reste tracé dans le journal.
        </p>
        <div className="flex justify-end">
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Réinitialiser tous les soldes
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Réinitialiser tous les soldes"
        message="Tous les soldes seront remis à zéro. Cette action est tracée mais irréversible. Continuer ?"
        confirmLabel="Oui, tout remettre à zéro"
        danger
        onConfirm={() => {
          resetAllBalances(user.id)
          toast('Tous les soldes ont été remis à zéro.')
        }}
      />
    </div>
  )
}
