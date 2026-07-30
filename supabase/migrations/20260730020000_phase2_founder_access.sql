-- ============================================================
-- KidsUp — GODCLAUDE Phase 2 : statut fondateur + chokepoint hasAccess()
--
-- has_family_access(family_id, feature) : verrou central UNIQUE que les phases 3 (limites
-- freemium) et 5 (packs cosmétiques payants) devront appeler pour décider si une famille a
-- accès à une fonctionnalité/un pack donné — jamais de vérification ad-hoc dispersée
-- ailleurs. Non-négociable (voir prompt GODCLAUDE) : renvoie TOUJOURS true pour la famille
-- fondatrice (is_founder = true, celle de Julien — families.is_founder posé en phase 1),
-- quel que soit `p_feature`.
--
-- p_feature n'a aucun effet pour l'instant : aucune limite freemium (phase 3) ni pack
-- cosmétique (phase 5) n'existe encore dans ce repo. Tant que ces phases ne sont pas
-- implémentées, cette fonction renvoie true pour tout le monde (rien à restreindre) SAUF
-- qu'elle pose déjà, dès maintenant, le point d'entrée unique que ces phases futures devront
-- utiliser plutôt que de réinventer leur propre logique de vérification.
--
-- SECURITY DEFINER + STABLE : utilisable aussi bien depuis le frontend (RPC) que depuis de
-- futures policies RLS sur des tables encore à créer (phase 3/5), sans dépendre de la
-- session de l'appelant pour lire families.is_founder.
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
      -- Phase 3/5 pas encore implémentées : personne n'est encore restreint sur quoi que ce
      -- soit. À remplacer, quand ces phases existeront, par la vraie logique de limites/packs
      -- pour les familles non-fondatrices (p_feature indiquera quoi vérifier).
      ELSE true
    END
$$;

REVOKE ALL ON FUNCTION has_family_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_family_access(UUID, TEXT) TO authenticated;

-- Vérification : true pour la famille fondatrice, quel que soit le paramètre feature.
SELECT has_family_access(id, 'anything') AS founder_always_true
FROM families WHERE is_founder = true;
