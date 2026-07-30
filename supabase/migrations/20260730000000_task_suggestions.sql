-- ============================================================
-- KidsUp — Propositions de tâches par les enfants
-- À exécuter dans Supabase → SQL Editor (une seule fois).
--
-- Suit le même pattern que sync_users / sync_tasks / etc. (voir
-- src/lib/sync.ts) : chaque entité partagée est une table avec id (clé
-- métier), data (blob JSONB), updated_at — pas de schéma SQL à maintenir
-- en phase avec les types TypeScript à chaque évolution.
--
-- RLS "public all" (pas de Supabase Auth ici — login local par PIN, voir
-- la première migration de gamification pour le même choix).
--
-- Aucune ligne insérée : contrairement aux catalogues (badges/séries/
-- rangs), il n'y a pas de "propositions par défaut" à seeder — la table
-- démarre vide et se peuple au fil des propositions des enfants.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_task_suggestions'
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

-- Vérification (à lire dans l'onglet Results) : la table doit apparaître, avec rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'sync_task_suggestions';
