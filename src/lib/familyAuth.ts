import { supabase } from './supabase'

// Couche Supabase Auth (email + mot de passe), par PARENT/appareil — en plus du système
// PIN enfant existant (src/store/useStore.ts `session`), qui ne change pas. Une fois cette
// authentification établie sur un appareil, elle reste valide (supabase-js persiste la
// session dans le storage du navigateur et la rafraîchit automatiquement) : le picker PIN
// existant continue de gérer, par-dessus, le changement de profil entre les membres de la
// famille sur ce même appareil.

export async function signInFamily(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
}

/** Retourne `needsEmailConfirmation: true` si le projet Supabase exige une confirmation par email
 *  avant de délivrer une session (aucune session utilisable tant que ce n'est pas fait). */
export async function signUpFamily(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message, needsEmailConfirmation: false }
  return { error: null, needsEmailConfirmation: !data.session }
}

export async function signOutFamily() {
  await supabase.auth.signOut()
}

/** Signup "nouvelle famille" : crée une famille toute neuve pour le compte courant. */
export async function createNewFamily(familyName: string): Promise<{ familyId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_family_for_current_user', { p_family_name: familyName })
  if (error) return { familyId: null, error: error.message }
  return { familyId: data as string, error: null }
}

/** Signup "rejoindre la famille fondatrice" : rattache le compte courant via un code fourni
 *  hors bande (jamais commité — voir supabase/migrations/20260730010000_multi_family_phase1.sql). */
export async function claimFounderFamily(code: string): Promise<{ familyId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('claim_founder_family', { p_code: code })
  if (error) return { familyId: null, error: error.message }
  return { familyId: data as string, error: null }
}
