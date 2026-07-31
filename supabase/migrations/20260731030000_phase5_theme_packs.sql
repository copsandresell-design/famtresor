-- ============================================================
-- KidsUp — GODCLAUDE Phase 5 : packs cosmétiques (thèmes)
--
-- Catalogue de thèmes "emoji + palette" pour les avatars enfant, entièrement piloté par
-- données (voir consigne "config extensible") : ajouter un nouveau pack = une ligne SQL
-- dans theme_packs, aucun déploiement frontend requis (le frontend lit la liste des packs
-- et leurs emojis/couleurs directement depuis cette table).
--
-- theme_packs      : catalogue public (tout le monde peut lire — ce n'est pas une donnée
--                    par famille), un seul pack "par défaut" (Espace), les autres payants
--                    (stripe_price_id à renseigner par Julien une fois créés dans Stripe,
--                    NULL en attendant = pack pas encore achetable).
-- family_theme_packs : lesquels une famille a débloqués (achat à l'unité). Comme pour tout
--                    depuis la phase 1, la famille fondatrice n'a besoin d'aucune ligne ici
--                    (has_theme_pack() court-circuite sur is_founder) et une famille premium
--                    a TOUS les packs inclus (court-circuite sur plan = 'premium') — vendre
--                    "à l'unité OU avec le premium" comme demandé.
-- families.active_theme_pack_id : quel pack s'applique actuellement à cette famille (les
--                    emojis/couleurs proposés aux avatars) — 'espace' par défaut pour tous.
-- ============================================================

CREATE TABLE IF NOT EXISTS theme_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emojis JSONB NOT NULL,
  palette JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  stripe_price_id TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE theme_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "theme_packs_select_all" ON theme_packs;
-- Catalogue public : lisible par n'importe quel compte authentifié (pas de notion de
-- famille ici, juste "quels packs existent et combien ils coûtent").
CREATE POLICY "theme_packs_select_all" ON theme_packs FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS family_theme_packs (
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, pack_id)
);

ALTER TABLE family_theme_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_theme_packs_select" ON family_theme_packs;
CREATE POLICY "family_theme_packs_select" ON family_theme_packs
  FOR SELECT USING (family_id = current_family_id());
-- Pas d'INSERT/UPDATE/DELETE pour authenticated : uniquement le webhook Stripe (service_role,
-- voir api/stripe-webhook.ts), même logique que families depuis la phase 1.

ALTER TABLE families ADD COLUMN IF NOT EXISTS active_theme_pack_id TEXT REFERENCES theme_packs(id);

INSERT INTO theme_packs (id, name, emojis, palette, is_default, sort_order) VALUES
  ('espace', 'Espace', '["⚡","🌈","🦁","🦄","🐯","🐼","🦊","🐸","🚀","⚽","🎮","🎸","🎨","🌸","🔥","🐬","😎","🤖","👑","🍕"]', '["#3B82F6","#EC4899","#8B5CF6","#10B981","#F97316","#06B6D4"]', true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO theme_packs (id, name, emojis, palette, sort_order) VALUES
  ('dinosaures', 'Dinosaures', '["🦖","🦕","🐊","🥚","🌋","🦴","🌿","🍃","🐢","🦎","🌴","☄️"]', '["#4D7C0F","#15803D","#92400E","#78350F","#A16207","#365314"]', 1),
  ('pirates', 'Pirates', '["🏴‍☠️","⚓","🗺️","💰","🦜","⚔️","🛳️","🔱","💎","🏝️","🧭","🔑"]', '["#1E3A8A","#B45309","#7C2D12","#1C1917","#DC2626","#78716C"]', 2),
  ('fees-licornes', 'Fées & licornes', '["🦄","🧚","✨","🌸","🎀","💫","🌺","👸","🍬","🌷","🦋","💖"]', '["#F0ABFC","#F9A8D4","#C4B5FD","#FDE68A","#A5F3FC","#FBCFE8"]', 3),
  ('robots', 'Robots', '["🤖","⚙️","🔧","💡","🛠️","📡","🔋","🕹️","💻","🔌","📟","🛰️"]', '["#64748B","#0EA5E9","#3B82F6","#94A3B8","#22D3EE","#6366F1"]', 4)
ON CONFLICT (id) DO NOTHING;

UPDATE families SET active_theme_pack_id = 'espace' WHERE active_theme_pack_id IS NULL;

-- ------------------------------------------------------------
-- has_theme_pack(family_id, pack_id) : même esprit que has_family_access() (phase 2) —
-- fondatrice ou premium = tout débloqué ; pack par défaut = toujours débloqué ; sinon
-- vérifie un achat individuel dans family_theme_packs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_theme_pack(p_family_id UUID, p_pack_id TEXT)
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
      WHEN (SELECT is_default FROM theme_packs WHERE id = p_pack_id) THEN true
      ELSE EXISTS (
        SELECT 1 FROM family_theme_packs
        WHERE family_id = p_family_id AND pack_id = p_pack_id
      )
    END
$$;

REVOKE ALL ON FUNCTION has_theme_pack(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_theme_pack(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- set_active_theme_pack(pack_id) : change le pack actif de la famille du compte courant —
-- refuse si la famille n'a pas accès à ce pack (vérifié via has_theme_pack, pas de confiance
-- envers le client).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_active_theme_pack(p_pack_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  v_family_id := current_family_id();
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF NOT has_theme_pack(v_family_id, p_pack_id) THEN
    RAISE EXCEPTION 'Ce pack n''est pas débloqué pour cette famille';
  END IF;
  UPDATE families SET active_theme_pack_id = p_pack_id WHERE id = v_family_id;
END;
$$;

REVOKE ALL ON FUNCTION set_active_theme_pack(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_active_theme_pack(TEXT) TO authenticated;

-- Vérification.
SELECT id, name, is_default, stripe_price_id, sort_order FROM theme_packs ORDER BY sort_order;
