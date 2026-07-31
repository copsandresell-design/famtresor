import { supabase } from './supabase'

// GODCLAUDE phase 5 : catalogue de packs cosmétiques (emoji + palette), entièrement piloté
// par données (table theme_packs — voir supabase/migrations/20260731030000_phase5_theme_packs.sql).
// Ajouter un nouveau pack ne demande aucun changement ici, juste une ligne SQL.

export interface ThemePack {
  id: string
  name: string
  emojis: string[]
  palette: string[]
  isDefault: boolean
  purchasable: boolean
  sortOrder: number
}

export async function fetchThemePacks(): Promise<ThemePack[]> {
  const { data, error } = await supabase
    .from('theme_packs')
    .select('id, name, emojis, palette, is_default, stripe_price_id, sort_order')
    .order('sort_order')
  if (error) {
    console.error('❌ theme_packs : lecture échouée', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    emojis: row.emojis as string[],
    palette: row.palette as string[],
    isDefault: row.is_default as boolean,
    purchasable: !!row.stripe_price_id,
    sortOrder: row.sort_order as number,
  }))
}

export async function fetchOwnedPackIds(familyId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('family_theme_packs').select('pack_id').eq('family_id', familyId)
  if (error) {
    console.error('❌ family_theme_packs : lecture échouée', error.message)
    return new Set()
  }
  return new Set((data ?? []).map((row) => row.pack_id as string))
}

export async function fetchActivePackId(familyId: string): Promise<string> {
  const { data } = await supabase.from('families').select('active_theme_pack_id').eq('id', familyId).maybeSingle()
  return (data?.active_theme_pack_id as string | undefined) ?? 'espace'
}

/** Change le pack actif de la famille courante — le serveur (RPC) vérifie lui-même que la
 *  famille a bien accès à ce pack, jamais fait confiance au client. */
export async function setActiveThemePack(packId: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_active_theme_pack', { p_pack_id: packId })
  return error?.message ?? null
}

/** Miroir synchrone (affichage) de has_theme_pack() côté SQL — doit rester en phase avec
 *  la fonction du même nom dans supabase/migrations/20260731030000_phase5_theme_packs.sql. */
export function isPackUnlocked(
  pack: ThemePack,
  isFounder: boolean,
  plan: 'free' | 'premium',
  ownedPackIds: Set<string>,
): boolean {
  return isFounder || plan === 'premium' || pack.isDefault || ownedPackIds.has(pack.id)
}
