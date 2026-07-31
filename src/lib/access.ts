import { supabase } from './supabase'

// GODCLAUDE — point d'entrée unique côté frontend pour la question "cette famille a-t-elle
// accès à telle fonctionnalité/pack ?" — reflète la fonction SQL has_family_access() (voir
// supabase/migrations/20260730020000_phase2_founder_access.sql et
// 20260731000000_phase3_freemium_plan.sql), qui renvoie toujours true pour la famille
// fondatrice. Le futur pack cosmétique (phase 5, non commencée) devra aussi passer par ici.

/** Doit rester strictement synchronisée avec la liste CASE de has_family_access() côté SQL —
 *  voir le commentaire de cette fonction dans la migration phase 3 (et son ajustement du
 *  31/07 : 'task_suggestions' repassé gratuit — voir plus bas pourquoi). */
export type FeatureKey =
  | 'custom_shop_catalog'
  | 'custom_avatar_photos'
  | 'stats_calendar'
  | 'automatic_penalties'
  | 'custom_gamification_defs'

// Ajustement du 31/07 (retour d'expérience produit, voir docs/godclaude-multi-family.md) :
// 'task_suggestions' est repassé entièrement gratuit — c'est la seule fonctionnalité premium
// qui touchait directement l'expérience de l'ENFANT (agence/engagement des enfants), donc la
// seule où une restriction risquait de casser l'habitude quotidienne avant même qu'un parent
// n'envisage de payer. Retirée de FeatureKey/FREE_LOCKED_FEATURES : elle n'est plus jamais
// gatée, ni ici ni côté SQL.
const FREE_LOCKED_FEATURES = new Set<FeatureKey>([
  'custom_shop_catalog',
  'custom_avatar_photos',
  'stats_calendar',
  'automatic_penalties',
  'custom_gamification_defs',
])

/** Limite gratuite : pas un simple booléen (contrairement aux FeatureKey ci-dessus), donc pas
 *  géré par has_family_access() — vérifié directement côté frontend avec le nombre réel
 *  d'enfants actifs. Toujours illimité pour la famille fondatrice/premium (voir computeAccess). */
export const MAX_FREE_CHILDREN = 2

// Ajustement du 31/07 : plutôt qu'un mur total sur la personnalisation (badges/séries/rangs/
// boutique), une famille gratuite peut créer 1 élément personnalisé par catégorie avant de
// tomber sur l'upsell — donne un avant-goût réel (peut couvrir SON besoin précis, ex. une
// tâche non standard) sans jamais bloquer dès la première semaine d'usage. Même logique que
// MAX_FREE_CHILDREN : compté côté frontend, jamais par has_family_access() (qui garde son
// sens de "illimité oui/non"). Un élément est considéré "personnalisé" si créé par un parent
// (createdBy !== 'system') — les catalogues par défaut ne comptent jamais dans la limite.
export const MAX_FREE_CUSTOM = 1

/** Une famille peut créer/adopter un nouvel élément personnalisé (badge, série, rang, lot
 *  boutique) si : famille fondatrice, ou premium, ou encore sous la limite gratuite. */
export function canCreateCustom(isFounder: boolean, plan: 'free' | 'premium', customCount: number): boolean {
  return isFounder || plan === 'premium' || customCount < MAX_FREE_CUSTOM
}

/** Version synchrone (pas d'aller-retour réseau) de has_family_access(), pour l'affichage —
 *  à partir de l'état déjà mis en cache par familyAuthStore (isFounder/plan récupérés une
 *  fois à la connexion). Utiliser hasAccess() (RPC, ci-dessous) seulement quand une décision
 *  fraîche/faisant autorité est nécessaire (ex : juste avant une action serveur sensible). */
export function computeAccess(
  isFounder: boolean,
  plan: 'free' | 'premium',
  feature: FeatureKey,
): boolean {
  if (isFounder || plan === 'premium') return true
  return !FREE_LOCKED_FEATURES.has(feature)
}

/** Version RPC (faisant autorité, appelle has_family_access() côté Postgres). */
export async function hasAccess(familyId: string, feature: FeatureKey): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_family_access', { p_family_id: familyId, p_feature: feature })
  if (error) {
    console.error('❌ hasAccess : vérification échouée, accès refusé par défaut', error.message)
    return false
  }
  return data === true
}
