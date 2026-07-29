-- ============================================================
-- FamTrésor — Catalogues administrables : séries, badges, rangs
-- À exécuter dans Supabase → SQL Editor (une seule fois).
--
-- Suit le même pattern que sync_users / sync_tasks / etc. (voir
-- src/lib/sync.ts) : chaque entité partagée est une table avec id (clé
-- métier), data (blob JSONB), updated_at. RLS "public all" (pas de
-- Supabase Auth ici — login local par PIN, voir la première migration).
--
-- Contrairement aux migrations précédentes, cette fois AUCUNE ligne
-- n'est insérée ici : l'application (voir useStore.ts → init()) détecte
-- que ces tables sont vides au premier chargement après ce changement et
-- y publie elle-même le catalogue par défaut (séries globale/sans
-- pénalité + les deux séries liées aux tâches, badges, rangs). C'est
-- voulu : le catalogue par défaut vit dans le code (src/lib/streak.ts,
-- src/lib/badges.ts, src/lib/ranks.ts) pour rester la seule source de
-- vérité, cette migration se contente de préparer les tables qui vont
-- l'accueillir.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_streak_defs',
    'sync_badge_defs',
    'sync_rank_defs'
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
         id UUID PRIMARY KEY,
         data JSONB NOT NULL,
         updated_at TIMESTAMPTZ DEFAULT now()
       )', t
    );

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "select_all" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "insert_all" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update_all" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_all" ON %I', t);

    EXECUTE format('CREATE POLICY "select_all" ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "insert_all" ON %I FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "update_all" ON %I FOR UPDATE USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "delete_all" ON %I FOR DELETE USING (true)', t);

    -- Ajoute la table à la publication realtime si elle n'y est pas déjà.
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Vérification (à lire dans l'onglet Results) : les 3 tables doivent apparaître,
-- toutes avec rowsecurity = true et vides (0 ligne — l'app les peuple au premier chargement).
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('sync_streak_defs', 'sync_badge_defs', 'sync_rank_defs')
ORDER BY tablename;
