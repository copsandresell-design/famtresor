import { useState } from 'react'
import { startCheckout } from '../../lib/billing'
import { usePremiumUpsellStore } from '../../store/premiumUpsellStore'
import { Button } from './Button'
import { Modal } from './Modal'

// GODCLAUDE phase 4 : monté une fois dans App.tsx, déclenché depuis n'importe quel écran via
// usePremiumUpsellStore.getState().show() (voir PremiumGate.tsx et les gates inline de
// ChildrenPage/ShopPage/BadgeDefsPage/StreakDefsPage/RankDefsPage/SettingsPage). Pas de prix
// affiché ici volontairement : le vrai prix (configuré dans Stripe, voir
// docs/godclaude-multi-family.md) s'affiche sur la page Stripe Checkout elle-même — l'afficher
// aussi ici risquerait de désynchroniser avec ce qui est réellement configuré côté Stripe.
export function PremiumUpsellModal() {
  const open = usePremiumUpsellStore((s) => s.open)
  const hide = usePremiumUpsellStore((s) => s.hide)
  const [pending, setPending] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(interval: 'monthly' | 'annual') {
    setPending(interval)
    setError(null)
    const err = await startCheckout(interval)
    if (err) setError(err)
    setPending(null)
  }

  return (
    <Modal open={open} onClose={hide} title="Passer à Premium">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-3xl" aria-hidden>
          ✨
        </span>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enfants illimités, photos de profil personnalisées, statistiques &amp; calendrier, séries/badges/rangs
          personnalisés, boutique sans limite, et pénalités automatiques.
        </p>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <Button onClick={() => void choose('monthly')} disabled={pending !== null}>
            {pending === 'monthly' ? 'Redirection…' : 'Mensuel'}
          </Button>
          <Button variant="soft" onClick={() => void choose('annual')} disabled={pending !== null}>
            {pending === 'annual' ? 'Redirection…' : 'Annuel'}
          </Button>
        </div>
        <p className="text-xs text-slate-400">Paiement sécurisé par Stripe. Résiliable à tout moment.</p>
      </div>
    </Modal>
  )
}
