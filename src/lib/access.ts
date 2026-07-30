import { supabase } from './supabase'

// GODCLAUDE phase 2 : point d'entrée unique côté frontend pour la question "cette famille
// a-t-elle accès à telle fonctionnalité/pack ?" — reflète simplement la fonction SQL
// has_family_access() (voir supabase/migrations/20260730020000_phase2_founder_access.sql),
// qui renvoie toujours true pour la famille fondatrice. Les phases 3 (limites freemium) et 5
// (packs cosmétiques) devront passer par cette fonction plutôt que de vérifier is_founder ou
// un plan quelconque directement — tant qu'elles n'existent pas, tout le monde a accès à tout
// (rien à restreindre encore).
export async function hasAccess(familyId: string, feature: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_family_access', { p_family_id: familyId, p_feature: feature })
  if (error) {
    console.error('❌ hasAccess : vérification échouée, accès refusé par défaut', error.message)
    return false
  }
  return data === true
}
