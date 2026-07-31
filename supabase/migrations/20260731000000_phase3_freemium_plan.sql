-- ============================================================
-- KidsUp — GODCLAUDE Phase 3 : plan freemium (free / premium)
--
-- Ajoute families.plan et enrichit has_family_access() (posée en phase 2) avec la vraie
-- liste des fonctionnalités verrouillées en gratuit. Toujours vrai pour la famille
-- fondatrice, quel que soit `plan` (non-négociable — voir phase 1/2).
--
-- Choix produit faits sans réponse de l'utilisateur (question posée puis refusée — voir
-- session) : tâches restent librement personnalisables en gratuit (cœur de l'usage
-- quotidien) ; catalogue boutique, avatars photo, stats/calendrier, pénalités
-- automatiques, personnalisation séries/badges/rangs, et propositions de tâches par les
-- enfants passent premium. Limite gratuite : 2 enfants max (vérifiée côté frontend, pas
-- ici — voir plus bas pourquoi).
--
-- Pas de Stripe (phase 4 non commencée) : `plan` est modifiable à la main en SQL en
-- attendant :
--   UPDATE families SET plan = 'premium' WHERE id = '<family_id>';
-- ============================================================

ALTER TABLE families ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'families_plan_check'
  ) THEN
    ALTER TABLE families ADD CONSTRAINT families_plan_check CHECK (plan IN ('free', 'premium'));
  END IF;
END $$;

-- La famille fondatrice a toujours accès à tout via is_founder (voir has_family_access) —
-- plan = 'premium' posé ici aussi par cohérence d'affichage (pas fonctionnellement requis).
UPDATE families SET plan = 'premium' WHERE is_founder = true;

CREATE OR REPLACE FUNCTION has_family_access(p_family_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN (SELECT is_founder FROM families WHERE id = p_family_id) THEN true
      WHEN (SELECT plan FROM families WHERE id = p_family_id) = 'premium' THEN true
      -- Fonctionnalités verrouillées en gratuit (voir src/lib/access.ts pour le miroir
      -- côté frontend, qui DOIT rester synchronisé avec cette liste) :
      WHEN p_feature IN (
        'custom_shop_catalog',
        'custom_avatar_photos',
        'stats_calendar',
        'automatic_penalties',
        'custom_gamification_defs',
        'task_suggestions'
      ) THEN false
      -- Tout le reste (y compris 'unlimited_children', vérifié côté frontend avec le
      -- compte réel d'enfants plutôt qu'ici — un simple booléen ne suffit pas à exprimer
      -- "2 max") et toute clé future non encore listée : pas verrouillé par défaut, pour
      -- ne jamais bloquer silencieusement une fonctionnalité qu'on aurait oublié d'ajouter
      -- ici.
      ELSE true
    END
$$;

-- Vérification : la famille fondatrice garde accès à tout ; une famille gratuite de test
-- n'a PAS accès aux fonctionnalités premium listées ci-dessus.
SELECT id, name, is_founder, plan FROM families;
