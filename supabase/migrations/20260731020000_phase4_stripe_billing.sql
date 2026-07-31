-- ============================================================
-- KidsUp — GODCLAUDE Phase 4 : facturation Stripe (mode TEST uniquement)
--
-- Ajoute à families les colonnes nécessaires pour relier une famille à un client/abonnement
-- Stripe. Toutes les écritures sur ces colonnes se font côté serveur (webhook Stripe, clé
-- service_role — voir api/stripe-webhook.ts) : aucune policy RLS d'écriture n'est ajoutée
-- pour l'authenticated, cohérent avec le reste de families (déjà "lecture seule côté
-- client, mutations via RPC/serveur" depuis la phase 1).
--
-- ⚠️ Clés TEST UNIQUEMENT (sk_test_.../pk_test_...) — jamais les clés live. C'est une
-- décision explicitement séparée et future de Julien (voir docs/godclaude-multi-family.md).
-- Les fonctions serveur (api/create-checkout-session.ts, api/stripe-webhook.ts) refusent de
-- démarrer si STRIPE_SECRET_KEY ne commence pas par "sk_test_", en garde-fou.
-- ============================================================

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS premium_interval TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'families_premium_interval_check'
  ) THEN
    ALTER TABLE families ADD CONSTRAINT families_premium_interval_check
      CHECK (premium_interval IS NULL OR premium_interval IN ('monthly', 'annual'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_families_stripe_customer_id
  ON families (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Vérification.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'families'
ORDER BY ordinal_position;
