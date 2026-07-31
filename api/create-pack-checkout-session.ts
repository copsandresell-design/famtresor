// Fonction serverless Vercel : crée une session Stripe Checkout en paiement UNIQUE (pas un
// abonnement) pour débloquer un pack cosmétique (theme_packs) à l'unité.
//
// GODCLAUDE phase 5 — mode TEST Stripe uniquement (même garde-fou que
// api/create-checkout-session.ts). Le prix vient de theme_packs.stripe_price_id (en base,
// pas d'un env var) : ajouter un nouveau pack achetable ne demande aucun redéploiement, juste
// une ligne SQL (voir supabase/migrations/20260731030000_phase5_theme_packs.sql).
//
// N'écrit RIEN dans family_theme_packs ici : c'est le webhook (api/stripe-webhook.ts) qui
// fait foi une fois le paiement confirmé par Stripe.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const SUPABASE_URL = 'https://zqflavaesgcohiwvvnmw.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZmxhdmFlc2djb2hpd3Z2bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTk3NjEsImV4cCI6MjEwMDM3NTc2MX0.UJaM9FKw4WRmnCKtZrtXM2k0XYmgR5eYNVA0EK9zErk'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error('create-pack-checkout-session: STRIPE_SECRET_KEY doit être une clé de TEST (sk_test_...)')
    res.status(500).json({ error: 'Configuration Stripe invalide côté serveur' })
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
  const packId = typeof body.packId === 'string' ? body.packId : ''
  if (!packId) {
    res.status(400).json({ error: 'packId requis' })
    return
  }

  const { data: pack } = await supabase
    .from('theme_packs')
    .select('id, name, stripe_price_id, is_default')
    .eq('id', packId)
    .maybeSingle()
  if (!pack || pack.is_default) {
    res.status(400).json({ error: 'Pack invalide' })
    return
  }
  if (!pack.stripe_price_id) {
    res.status(500).json({ error: "Ce pack n'est pas encore en vente" })
    return
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
      client_reference_id: membership.family_id,
      metadata: { family_id: membership.family_id, pack_id: pack.id, type: 'pack_purchase' },
      success_url: `${base}/parent/reglages?pack=success`,
      cancel_url: `${base}/parent/reglages?pack=cancel`,
    })
    res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('create-pack-checkout-session: échec Stripe', err?.message)
    res.status(500).json({ error: 'Impossible de créer la session de paiement' })
  }
}
