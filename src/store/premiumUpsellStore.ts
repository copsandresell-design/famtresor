import { create } from 'zustand'

// GODCLAUDE phase 4 : un seul modal Premium (voir components/ui/PremiumUpsellModal.tsx),
// monté une fois dans App.tsx, déclenché depuis n'importe quel écran via show() plutôt que
// de dupliquer un modal de paiement dans chaque page qui propose l'upsell.
interface PremiumUpsellState {
  open: boolean
  show: () => void
  hide: () => void
}

export const usePremiumUpsellStore = create<PremiumUpsellState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
