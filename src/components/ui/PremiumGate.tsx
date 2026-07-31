import type { ReactNode } from 'react'
import type { FeatureKey } from '../../lib/access'
import { computeAccess } from '../../lib/access'
import { useDemoMode } from '../../store/demoStore'
import { useFamilyAuthStore } from '../../store/familyAuthStore'
import { usePremiumUpsellStore } from '../../store/premiumUpsellStore'
import { Button } from './Button'
import { Card } from './Card'

// GODCLAUDE phase 3/4 : verrou UI unique pour les fonctionnalités premium, TOUJOURS côté
// parent (jamais montré aux enfants — voir usages). Le bouton ouvre le vrai modal de
// paiement Stripe (voir PremiumUpsellModal.tsx).
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
  const showUpsell = usePremiumUpsellStore((s) => s.show)

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
      <Button onClick={showUpsell}>Découvrir Premium</Button>
    </Card>
  )
}
