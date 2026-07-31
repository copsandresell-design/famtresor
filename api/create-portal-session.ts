// Fonction serverless Vercel : ouvre le portail de facturation Stripe (gérer/annuler
// l'abonnement, changer de moyen de paiement) pour la famille du parent authentifié
// courant — nécessite qu'un stripe_customer_id existe déjà (posé par le webhook après un
// premier paiement réussi, voir api/stripe-webhook.ts).
//
// GODCLAUDE phase 4 — mode TEST Stripe uniquement (même garde-fou que
// api/create-checkout-session.ts).
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
    console.error('create-portal-session: STRIPE_SECRET_KEY doit être une clé de TEST (sk_test_...)')
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

  const { data: family } = await supabase
    .from('families')
    .select('stripe_customer_id')
    .eq('id', membership.family_id)
    .maybeSingle()
  if (!family?.stripe_customer_id) {
    res.status(400).json({ error: "Aucun abonnement Stripe pour l'instant" })
    return
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: family.stripe_customer_id,
      return_url: `${base}/parent/reglages`,
    })
    res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('create-portal-session: échec Stripe', err?.message)
    res.status(500).json({ error: "Impossible d'ouvrir le portail de facturation" })
  }
}
