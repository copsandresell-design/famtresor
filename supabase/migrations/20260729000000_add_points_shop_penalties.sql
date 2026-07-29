-- ============================================================
-- FamTrésor — Points, Boutique, Pénalités automatiques, Journal synchronisé
-- À exécuter dans Supabase → SQL Editor (une seule fois).
--
-- Suit le pattern déjà en place pour sync_users / sync_tasks / etc. (voir
-- src/lib/sync.ts) : chaque entité partagée est une table avec id (clé
-- métier), data (blob JSONB), updated_at — pas de schéma SQL à maintenir
-- en phase avec les types TypeScript à chaque évolution.
--
-- RLS "public all" (pas de Supabase Auth ici — login local par PIN, voir
-- docs/fix-photo-sync.sql pour le même choix sur profile_photos).
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_logs',
    'sync_points_transactions',
    'sync_reward_claims',
    'sync_penalty_rules',
    'sync_shop_items',
    'sync_redemptions',
    'sync_automation_log'
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

-- Index utile pour l'idempotence du cron (api/check-inactivity.ts cherche par clé).
CREATE INDEX IF NOT EXISTS idx_automation_log_key ON sync_automation_log ((data ->> 'key'));

-- Vérification (à lire dans l'onglet Results) : les 7 tables doivent apparaître,
-- toutes avec rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'sync_logs', 'sync_points_transactions', 'sync_reward_claims',
    'sync_penalty_rules', 'sync_shop_items', 'sync_redemptions', 'sync_automation_log'
  )
ORDER BY tablename;
