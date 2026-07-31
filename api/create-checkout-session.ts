// Fonction serverless Vercel : crée une session Stripe Checkout (abonnement Premium,
// mensuel ou annuel) pour la famille du parent Supabase Auth authentifié courant.
//
// GODCLAUDE phase 4 — mode TEST Stripe UNIQUEMENT (voir garde-fou ci-dessous : la clé
// live est une décision explicitement séparée et future de Julien, jamais prise ici).
//
// N'écrit RIEN dans families ici (pas de plan/stripe_customer_id) : c'est le webhook
// (api/stripe-webhook.ts), déclenché par Stripe une fois le paiement confirmé, qui fait
// foi et applique le changement — évite de marquer une famille "premium" avant que Stripe
// n'ait réellement confirmé quoi que ce soit.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Même clé anon PUBLIQUE que src/lib/supabase.ts (pas un secret — juste dupliquée ici pour
// que ce fichier serveur puisse vérifier le JWT du parent et lire family_members/families
// avec la RLS scopée par famille, sans avoir besoin de la clé service_role).
const SUPABASE_URL = 'https://zqflavaesgcohiwvvnmw.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZmxhdmFlc2djb2hpd3Z2bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTk3NjEsImV4cCI6MjEwMDM3NTc2MX0.UJaM9FKw4WRmnCKtZrtXM2k0XYmgR5eYNVA0EK9zErk'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || ''
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || ''

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Garde-fou non-négociable (voir docs/godclaude-multi-family.md) : refuse de démarrer avec
  // autre chose qu'une clé TEST, même si une clé live était par erreur configurée sur Vercel.
  if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error('create-checkout-session: STRIPE_SECRET_KEY doit être une clé de TEST (sk_test_...)')
    res.status(500).json({ error: 'Configuration Stripe invalide côté serveur' })
    return
  }
  if (!STRIPE_PRICE_MONTHLY || !STRIPE_PRICE_ANNUAL) {
    console.error('create-checkout-session: STRIPE_PRICE_MONTHLY/STRIPE_PRICE_ANNUAL manquants')
    res.status(500).json({ error: 'Configuration Stripe incomplète côté serveur' })
    return
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization || ''
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : ''
  if (!token) {
    res.status(401).json({ error: 'Authentification requise' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Session invalide' })
    return
  }

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!membership) {
    res.status(403).json({ error: "Ce compte n'appartient à aucune famille" })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const interval = body.interval === 'annual' ? 'annual' : 'monthly'
  const priceId = interval === 'annual' ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: membership.family_id,
      subscription_data: { metadata: { family_id: membership.family_id } },
      success_url: `${base}/parent/reglages?premium=success`,
      cancel_url: `${base}/parent/reglages?premium=cancel`,
    })
    res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('create-checkout-session: échec Stripe', err?.message)
    res.status(500).json({ error: 'Impossible de créer la session de paiement' })
  }
}
