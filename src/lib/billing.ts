import { supabase } from './supabase'

// GODCLAUDE phase 4 : appelle les fonctions serverless Vercel qui parlent à Stripe (mode
// TEST uniquement — voir api/create-checkout-session.ts). Le frontend ne connaît AUCUN
// secret Stripe ni ne fait AUCUN appel direct à l'API Stripe : il ne fait que rediriger vers
// l'URL renvoyée par ces endpoints (page Stripe Checkout / portail de facturation hébergés).

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Redirige vers Stripe Checkout pour démarrer un abonnement Premium. */
export async function startCheckout(interval: 'monthly' | 'annual'): Promise<string | null> {
  const headers = await authHeader()
  if (!headers.Authorization) return 'Vous devez être connecté.'
  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ interval }),
    })
    const json = await res.json()
    if (!res.ok || !json.url) return json.error || 'Impossible de démarrer le paiement.'
    window.location.href = json.url
    return null
  } catch {
    return 'Impossible de contacter le serveur de paiement.'
  }
}

/** Redirige vers le portail de facturation Stripe (gérer/annuler l'abonnement). */
export async function openBillingPortal(): Promise<string | null> {
  const headers = await authHeader()
  if (!headers.Authorization) return 'Vous devez être connecté.'
  try {
    const res = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
    })
    const json = await res.json()
    if (!res.ok || !json.url) return json.error || "Impossible d'ouvrir le portail de facturation."
    window.location.href = json.url
    return null
  } catch {
    return 'Impossible de contacter le serveur de paiement.'
  }
}
