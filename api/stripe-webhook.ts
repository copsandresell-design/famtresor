// Fonction serverless Vercel : reçoit les événements webhook Stripe et met à jour
// families.plan/stripe_customer_id/stripe_subscription_id/premium_interval en conséquence.
// C'est la SEULE source de vérité qui fait passer une famille en premium — jamais le
// frontend, jamais api/create-checkout-session.ts (qui ne fait que démarrer le paiement).
//
// GODCLAUDE phase 4 — mode TEST Stripe uniquement (garde-fou ci-dessous). Utilise la clé
// service_role (aucune session utilisateur ici, l'appelant est Stripe) — voir le même
// raisonnement que api/check-inactivity.ts pour pourquoi ces scripts serveur doivent
// tamponner family_id/écrire directement plutôt que compter sur la RLS.
//
// Body brut requis pour la vérification de signature Stripe (constructEvent) : bodyParser
// désactivé ci-dessous (voir `config`), donc le corps est lu manuellement en buffer.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const config = {
  api: { bodyParser: false },
}

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

async function readRawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error('stripe-webhook: STRIPE_SECRET_KEY doit être une clé de TEST (sk_test_...)')
    res.status(500).json({ error: 'Configuration Stripe invalide côté serveur' })
    return
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: configuration Supabase/Stripe manquante')
    res.status(500).json({ error: 'Configuration manquante côté serveur' })
    return
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const signature = req.headers['stripe-signature']
  const rawBody = await readRawBody(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('stripe-webhook: signature invalide', err?.message)
    res.status(400).json({ error: 'Signature invalide' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const familyId = session.client_reference_id || (session.metadata?.family_id as string | undefined)
        if (!familyId) {
          console.error('stripe-webhook: checkout.session.completed sans family_id')
          break
        }
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        let interval: string | null = null
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          interval = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly'
        }
        await supabase
          .from('families')
          .update({
            plan: 'premium',
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            premium_interval: interval,
          })
          .eq('id', familyId)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const active = subscription.status === 'active' || subscription.status === 'trialing'
        const interval = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly'
        await supabase
          .from('families')
          .update({
            plan: active ? 'premium' : 'free',
            stripe_subscription_id: active ? subscription.id : null,
            premium_interval: active ? interval : null,
          })
          .eq('stripe_customer_id', customerId)
          // Ne rétrograde jamais la famille fondatrice, même si un abonnement Stripe test
          // lié par erreur à son stripe_customer_id venait à expirer/être annulé.
          .eq('is_founder', false)
        break
      }

      default:
        break
    }
  } catch (err: any) {
    console.error(`stripe-webhook: échec traitement ${event.type}`, err?.message)
    res.status(500).json({ error: 'Échec du traitement' })
    return
  }

  res.status(200).json({ received: true })
}
