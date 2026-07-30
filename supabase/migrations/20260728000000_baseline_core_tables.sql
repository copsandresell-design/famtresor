-- ============================================================
-- KidsUp — Tables de base (users, tasks, submissions, transactions,
-- savings_goals, settings, profile_photos, push_subscriptions)
--
-- Ces tables existent DÉJÀ en production (créées à la main dans le
-- tableau de bord Supabase — ou via docs/fix-photo-sync.sql pour
-- profile_photos — avant l'adoption de fichiers de migration pour ce
-- projet) — ce fichier comble un vrai trou dans l'historique de
-- migrations du repo : sans lui, impossible de reproduire le schéma de
-- zéro (ex: `supabase start` en local, disaster recovery). Découvert en
-- essayant de rejouer les migrations sur un stack Supabase CLI local
-- pour la phase 1 du multi-familles : les migrations suivantes
-- (20260729000000 et après) supposent ces tables déjà présentes et
-- échouent sinon.
--
-- Idempotent comme le reste (CREATE TABLE IF NOT EXISTS + policies
-- recréées) : SANS EFFET en production où ces tables existent déjà avec
-- les mêmes RLS "public all" — sûr à exécuter même si déjà appliqué
-- manuellement par ailleurs. Le passage à un RLS scopé par famille est
-- fait séparément par la migration multi-familles (phase 1), qui
-- s'applique après celle-ci : ce fichier reproduit fidèlement l'état
-- "pré-phase-1" de la prod, rien de plus.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_users',
    'sync_tasks',
    'sync_submissions',
    'sync_transactions',
    'sync_savings_goals',
    'sync_settings'
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

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- profile_photos — voir docs/fix-photo-sync.sql (schéma identique, même
-- RLS "public all" ; pas de FK vers sync_users car les users vivent en
-- IndexedDB, pas dans une table Postgres).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profile_photos'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'profile_photos'::regclass AND attname = 'user_id'
      )]
  ) THEN
    ALTER TABLE profile_photos ADD CONSTRAINT profile_photos_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view photos" ON profile_photos;
DROP POLICY IF EXISTS "Anyone can insert photos" ON profile_photos;
DROP POLICY IF EXISTS "Anyone can update photos" ON profile_photos;
DROP POLICY IF EXISTS "Anyone can delete photos" ON profile_photos;
CREATE POLICY "Anyone can view photos"   ON profile_photos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photos" ON profile_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photos" ON profile_photos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete photos" ON profile_photos FOR DELETE USING (true);

ALTER TABLE profile_photos REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profile_photos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- push_subscriptions — jamais documentée dans une migration ; schéma
-- déduit de src/lib/push.ts et api/send-push.ts (colonnes réellement
-- utilisées par l'app : id, user_id, endpoint (UNIQUE, cible d'upsert),
-- subscription, updated_at).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'push_subscriptions'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'push_subscriptions'::regclass AND attname = 'endpoint'
      )]
  ) THEN
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_all" ON push_subscriptions;
DROP POLICY IF EXISTS "insert_all" ON push_subscriptions;
DROP POLICY IF EXISTS "update_all" ON push_subscriptions;
DROP POLICY IF EXISTS "delete_all" ON push_subscriptions;
CREATE POLICY "select_all" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "insert_all" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON push_subscriptions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "delete_all" ON push_subscriptions FOR DELETE USING (true);

-- Vérification : toutes ces tables doivent apparaître, avec rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'sync_users', 'sync_tasks', 'sync_submissions',
    'sync_transactions', 'sync_savings_goals', 'sync_settings',
    'profile_photos', 'push_subscriptions'
  )
ORDER BY tablename;
