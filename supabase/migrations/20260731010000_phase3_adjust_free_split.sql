-- ============================================================
-- KidsUp — Ajustement du split gratuit/premium (31/07, retour produit après la phase 3)
--
-- Contexte : la phase 3 (has_family_access, voir 20260731000000_phase3_freemium_plan.sql)
-- gatait 'task_suggestions' en premium. Retour d'expérience produit (voir
-- docs/godclaude-multi-family.md) : c'est la seule fonctionnalité premium qui touche
-- directement l'expérience de l'ENFANT (agence/engagement), donc la seule où une restriction
-- risquait de casser l'habitude quotidienne avant même qu'un parent n'envisage de payer.
--
-- Changement : 'task_suggestions' retiré de la liste verrouillée — désormais gratuit pour
-- toutes les familles, sans condition. Les autres verrous (custom_shop_catalog,
-- custom_avatar_photos, stats_calendar, automatic_penalties, custom_gamification_defs)
-- restent inchangés — la limite "1 élément personnalisé gratuit" sur
-- custom_shop_catalog/custom_gamification_defs est gérée côté frontend (comptage réel, voir
-- src/lib/access.ts canCreateCustom), pas ici : has_family_access() garde son sens de
-- "illimité oui/non", inchangé.
-- ============================================================

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
      WHEN p_feature IN (
        'custom_shop_catalog',
        'custom_avatar_photos',
        'stats_calendar',
        'automatic_penalties',
        'custom_gamification_defs'
      ) THEN false
      ELSE true
    END
$$;

-- Vérification : task_suggestions doit maintenant renvoyer true même pour une famille free.
DO $$
DECLARE
  v_test_result BOOLEAN;
BEGIN
  SELECT has_family_access(id, 'task_suggestions') INTO v_test_result FROM families LIMIT 1;
  RAISE NOTICE 'has_family_access(..., task_suggestions) = %', v_test_result;
END $$;
