-- ============================================================
-- KidsUp — GODCLAUDE Phase 1 : fondations multi-familles
--
-- Objectif : transformer KidsUp d'une app mono-famille en un produit
-- multi-familles, chaque famille strictement isolée des autres, SANS
-- rien casser pour la famille existante de Julien (Julien, Marion,
-- Kelly, Hugo, Lorenzo, Kenzo) qui devient la "famille fondatrice"
-- (is_founder = true), gratuite et illimitée à vie (voir phase 2 pour
-- le hasAccess() qui s'appuiera sur ce flag).
--
-- Ce que fait ce fichier :
--   1) families / family_members / family_claim_codes (auth Supabase
--      par parent, en PLUS du PIN enfant existant qui ne change pas).
--   2) current_family_id() : fonction SECURITY DEFINER (contourne la
--      RLS de family_members pour éviter une récursion — cf. sa propre
--      policy SELECT qui appelle cette fonction).
--   3) set_family_id() : trigger BEFORE INSERT qui tamponne family_id
--      automatiquement depuis la session authentifiée. Ne écrase QUE
--      si family_id est NULL — ça laisse les scripts serveur (cron
--      Vercel, clé service_role, sans session utilisateur) fournir
--      explicitement le family_id de la famille qu'ils traitent. La
--      policy WITH CHECK (family_id = current_family_id()) reste la
--      vraie garde-fou contre un client qui tenterait de forger un
--      family_id : impossible de la satisfaire avec autre chose que
--      SA PROPRE famille, peu importe ce que fait le trigger.
--   4) Ajoute family_id à TOUTES les tables de données partagées
--      (17 tables sync_* + profile_photos + push_subscriptions — ces
--      deux dernières ne suivent pas le pattern générique id/data/
--      updated_at mais contiennent des données réelles par famille
--      et doivent être isolées de la même façon), avec backfill vers
--      la famille fondatrice, puis NOT NULL.
--   5) Réécrit la RLS de chacune de ces tables : suppression de TOUTE
--      policy existante (quel que soit son nom — certaines tables
--      comme push_subscriptions n'ont jamais eu de migration, donc
--      leurs noms de policy actuels ne sont pas connus avec certitude)
--      puis policies scopées strictement par famille.
--   6) RPC create_family_for_current_user() : signup normal (nouvelle
--      famille).
--   7) RPC claim_founder_family(code) : permet à Julien (et Marion) de
--      lier leur futur compte Supabase Auth à la famille fondatrice
--      DÉJÀ existante (créée par backfill ci-dessous) plutôt que d'en
--      créer une nouvelle par erreur. Le code réel n'est JAMAIS écrit
--      dans ce fichier (donc jamais committé) : il est généré en SQL
--      au moment de l'exécution de cette migration. Pour le récupérer
--      après avoir exécuté ce fichier en prod :
--        SELECT label, code FROM family_claim_codes
--        JOIN families ON families.id = family_claim_codes.family_id
--        WHERE families.is_founder = true;
--      Chaque code est à usage unique (supprimé par claim_founder_family
--      une fois consommé).
--
-- Ce que ce fichier NE fait PAS (limite assumée, documentée dans
-- docs/mobile-app.md / suivi de session) : le bucket Storage
-- famtresor-photos reste avec des policies "public" au niveau chemin
-- (pas de préfixe family_id dans les clés d'objet). Risque jugé faible
-- (clés = UUID aléatoires non énumérables) mais PAS une isolation
-- stricte — à traiter dans une phase ultérieure si on veut fermer
-- complètement ce dernier vecteur.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables du modèle famille
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_founder BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- un compte Supabase Auth n'appartient qu'à une seule famille
);

CREATE TABLE IF NOT EXISTS family_claim_codes (
  code TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2) current_family_id() — SECURITY DEFINER pour éviter la récursion
--    avec la policy SELECT de family_members (voir plus bas).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_family_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- ------------------------------------------------------------
-- 3) set_family_id() — trigger BEFORE INSERT générique
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_family_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.family_id IS NULL THEN
    NEW.family_id := current_family_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 4) RLS sur families / family_members / family_claim_codes
-- ------------------------------------------------------------
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_select" ON families;
CREATE POLICY "family_select" ON families FOR SELECT USING (id = current_family_id());
-- Pas de policy INSERT/UPDATE/DELETE : toute mutation passe par les RPC
-- SECURITY DEFINER ci-dessous (create_family_for_current_user, claim_founder_family).

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_select" ON family_members;
CREATE POLICY "family_select" ON family_members FOR SELECT USING (family_id = current_family_id());
-- Idem : pas d'INSERT/UPDATE/DELETE direct, uniquement via les RPC.

ALTER TABLE family_claim_codes ENABLE ROW LEVEL SECURITY;
-- Aucune policy du tout : totalement inaccessible en direct (anon/authenticated),
-- y compris en lecture. Seule la RPC claim_founder_family() (SECURITY DEFINER,
-- exécutée avec les droits du propriétaire des tables) peut la lire/modifier.

-- ------------------------------------------------------------
-- 5) Famille fondatrice + codes de rattachement (idempotent : ne crée
--    rien si une famille fondatrice existe déjà).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_founder_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM families WHERE is_founder = true) THEN
    INSERT INTO families (name, is_founder) VALUES ('Famille fondatrice', true)
      RETURNING id INTO v_founder_id;

    INSERT INTO family_claim_codes (code, family_id, label) VALUES
      (substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), v_founder_id, 'parent 1'),
      (substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), v_founder_id, 'parent 2');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) family_id sur toutes les tables de données partagées : ajout,
--    backfill vers la famille fondatrice, NOT NULL, index, trigger,
--    puis RLS scopée par famille (suppression de TOUTE policy
--    existante d'abord, quel que soit son nom, pour ne jamais laisser
--    une ancienne policy "public all" cohabiter avec la nouvelle et la
--    rendre inopérante).
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_users', 'sync_tasks', 'sync_submissions', 'sync_transactions',
    'sync_savings_goals', 'sync_settings', 'sync_logs', 'sync_points_transactions',
    'sync_reward_claims', 'sync_penalty_rules', 'sync_shop_items', 'sync_redemptions',
    'sync_streak_defs', 'sync_badge_defs', 'sync_rank_defs', 'sync_task_suggestions',
    'sync_automation_log', 'profile_photos', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id)', t);

    EXECUTE format(
      'UPDATE %I SET family_id = (SELECT id FROM families WHERE is_founder = true) WHERE family_id IS NULL',
      t
    );

    EXECUTE format('ALTER TABLE %I ALTER COLUMN family_id SET NOT NULL', t);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (family_id)', 'idx_' || t || '_family_id', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_family_id ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_family_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_family_id()',
      t
    );

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY "family_select" ON %I FOR SELECT USING (family_id = current_family_id())', t);
    EXECUTE format('CREATE POLICY "family_insert" ON %I FOR INSERT WITH CHECK (family_id = current_family_id())', t);
    EXECUTE format(
      'CREATE POLICY "family_update" ON %I FOR UPDATE USING (family_id = current_family_id()) WITH CHECK (family_id = current_family_id())',
      t
    );
    EXECUTE format('CREATE POLICY "family_delete" ON %I FOR DELETE USING (family_id = current_family_id())', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7) RPC : signup normal — crée une TOUTE NOUVELLE famille pour le
--    compte Supabase Auth courant.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_family_for_current_user(p_family_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF EXISTS (SELECT 1 FROM family_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ce compte appartient déjà à une famille';
  END IF;

  INSERT INTO families (name) VALUES (p_family_name) RETURNING id INTO v_family_id;
  INSERT INTO family_members (family_id, user_id, role) VALUES (v_family_id, auth.uid(), 'owner');

  RETURN v_family_id;
END;
$$;

-- ------------------------------------------------------------
-- 8) RPC : rattache le compte Supabase Auth courant à la famille
--    fondatrice via un code à usage unique (voir en-tête pour comment
--    récupérer les codes après exécution de cette migration).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_founder_family(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF EXISTS (SELECT 1 FROM family_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ce compte appartient déjà à une famille';
  END IF;

  SELECT family_id INTO v_family_id FROM family_claim_codes WHERE code = p_code;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Code invalide';
  END IF;

  INSERT INTO family_members (family_id, user_id, role) VALUES (v_family_id, auth.uid(), 'owner');
  DELETE FROM family_claim_codes WHERE code = p_code;

  RETURN v_family_id;
END;
$$;

REVOKE ALL ON FUNCTION create_family_for_current_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_family_for_current_user(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION claim_founder_family(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_founder_family(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Vérification (à lire dans l'onglet Results) : une seule famille
-- fondatrice, toutes les tables listées ont family_id NOT NULL et
-- rowsecurity = true.
-- ------------------------------------------------------------
SELECT id, name, is_founder FROM families;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'sync_users', 'sync_tasks', 'sync_submissions', 'sync_transactions',
    'sync_savings_goals', 'sync_settings', 'sync_logs', 'sync_points_transactions',
    'sync_reward_claims', 'sync_penalty_rules', 'sync_shop_items', 'sync_redemptions',
    'sync_streak_defs', 'sync_badge_defs', 'sync_rank_defs', 'sync_task_suggestions',
    'sync_automation_log', 'profile_photos', 'push_subscriptions'
  )
ORDER BY tablename;
