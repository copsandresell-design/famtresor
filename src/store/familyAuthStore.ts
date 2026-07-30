import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Statut Supabase Auth (parent), global à l'app — voir src/lib/familyAuth.ts.
//   loading      : statut pas encore connu (restauration de session en cours).
//   signed-out   : pas de session Supabase Auth du tout.
//   needs-family : session Supabase Auth valide, mais ce compte n'est encore rattaché à
//                  AUCUNE famille (juste après un signUp — le nouveau parent doit choisir
//                  "nouvelle famille" ou "rejoindre la famille fondatrice" via un code).
//   ready        : session valide ET rattachée à une famille (family_members) — l'app
//                  normale (picker PIN existant, etc.) peut s'initialiser.
export type FamilyAuthStatus = 'loading' | 'signed-out' | 'needs-family' | 'ready'

interface FamilyAuthState {
  status: FamilyAuthStatus
  supabaseUserId: string | null
  familyId: string | null
}

export const useFamilyAuthStore = create<FamilyAuthState>(() => ({
  status: 'loading',
  supabaseUserId: null,
  familyId: null,
}))

/** Relit family_members pour le compte courant — à rappeler juste après
 *  create_family_for_current_user()/claim_founder_family() pour faire passer le statut de
 *  'needs-family' à 'ready' sans attendre un futur événement onAuthStateChange (qui ne se
 *  redéclenche pas juste parce que la famille a changé, la session Supabase Auth elle-même
 *  n'ayant pas bougé). */
export async function refreshFamilyMembership(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) {
    useFamilyAuthStore.setState({ status: 'signed-out', supabaseUserId: null, familyId: null })
    return
  }
  const { data } = await supabase.from('family_members').select('family_id').eq('user_id', userId).maybeSingle()
  useFamilyAuthStore.setState({
    status: data ? 'ready' : 'needs-family',
    supabaseUserId: userId,
    familyId: data?.family_id ?? null,
  })
}

// Abonnement au niveau module (une seule fois, jamais démonté) : supabase-js notifie aussi
// bien la restauration de session au démarrage (événement 'INITIAL_SESSION') que les
// connexions/déconnexions ultérieures via ce même canal, donc un seul point d'écoute suffit.
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    useFamilyAuthStore.setState({ status: 'signed-out', supabaseUserId: null, familyId: null })
    return
  }
  void refreshFamilyMembership()
})
