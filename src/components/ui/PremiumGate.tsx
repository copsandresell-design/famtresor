import type { ReactNode } from 'react'
import type { FeatureKey } from '../../lib/access'
import { computeAccess } from '../../lib/access'
import { useDemoMode } from '../../store/demoStore'
import { useFamilyAuthStore } from '../../store/familyAuthStore'
import { useStore } from '../../store/useStore'
import { Button } from './Button'
import { Card } from './Card'

// GODCLAUDE phase 3 : verrou UI unique pour les fonctionnalités premium, TOUJOURS côté
// parent (jamais montré aux enfants — voir usages). Pas de vrai paiement tant que la phase 4
// (Stripe, non commencée) n'existe pas : le bouton affiche juste un message d'attente.
export function PremiumGate({
  feature,
  title,
  description,
  children,
}: {
  feature: FeatureKey
  title: string
  description: string
  children: ReactNode
}) {
  const demoActive = useDemoMode((s) => s.active)
  const isFounder = useFamilyAuthStore((s) => s.isFounder)
  const plan = useFamilyAuthStore((s) => s.plan)
  const toast = useStore((s) => s.toast)

  // Mode démo : toujours tout montrer (démo = vitrine complète), indépendamment du statut
  // Supabase Auth réel de l'appareil (useFamilyAuthStore n'est jamais démo-consciente).
  if (demoActive || computeAccess(isFounder, plan, feature)) return <>{children}</>

  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <span className="text-3xl" aria-hidden>
        ✨
      </span>
      <h2 className="font-bold">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <Button onClick={() => toast('Le paiement Premium arrive bientôt !', 'success')}>
        Découvrir Premium
      </Button>
    </Card>
  )
}
