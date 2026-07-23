import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Field, inputCls } from '../../components/ui/Field'
import { centsToEuroInput, euroToCents } from '../../lib/format'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { Theme } from '../../types'

export function SettingsPage() {
  const user = useCurrentUser()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const changeSecret = useStore((s) => s.changeSecret)
  const resetAllBalances = useStore((s) => s.resetAllBalances)
  const toast = useStore((s) => s.toast)

  const [familyName, setFamilyName] = useState(settings.familyName)
  const [bonus, setBonus] = useState(centsToEuroInput(settings.initiativeBonus))
  const [minBalance, setMinBalance] = useState(centsToEuroInput(settings.minBalance))
  const [password, setPassword] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  if (!user) return null

  function saveRules() {
    updateSettings(
      {
        familyName: familyName.trim() || 'FamTrésor',
        initiativeBonus: Math.max(0, euroToCents(bonus)),
        minBalance: Math.min(0, euroToCents(minBalance)),
      },
      user!.id,
    )
    toast('Réglages enregistrés.')
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
          <Field label="Bonus initiative (€)">
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
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
