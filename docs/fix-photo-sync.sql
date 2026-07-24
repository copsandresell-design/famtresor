-- ============================================================
-- FIX SYNC PHOTOS DE PROFIL — à exécuter dans Supabase → SQL Editor
-- Corrige : FK invalide, UNIQUE manquant, RLS bloquantes, realtime absent.
--
-- Contexte important : l'app est local-first (login par PIN, sans Supabase
-- Auth). auth.uid() vaut donc toujours NULL → les policies doivent être
-- permissives, et user_id ne peut PAS référencer une table users distante.
-- ============================================================

-- 1) Créer la table si absente (user_id UUID généré côté app, SANS clé étrangère)
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Supprimer la clé étrangère vers users si elle existe :
--    les utilisateurs vivent dans IndexedDB, pas dans Supabase,
--    donc cette FK fait échouer TOUS les upserts.
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profile_photos'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE profile_photos DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

-- 3) Garantir UNIQUE(user_id) — requis par upsert(..., { onConflict: 'user_id' })
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

-- 4) Colonnes manquantes éventuelles + index
ALTER TABLE profile_photos
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);

-- 5) RLS permissives (pas de Supabase Auth → auth.uid() serait toujours NULL)
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profile photos" ON profile_photos;
DROP POLICY IF EXISTS "Anyone can view photos" ON profile_photos;
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON profile_photos;
DROP POLICY IF EXISTS "Users can upsert their own photo" ON profile_photos;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON profile_photos;
DROP POLICY IF EXISTS "Users can update their own photo" ON profile_photos;
DROP POLICY IF EXISTS "Anyone can delete photos" ON profile_photos;

CREATE POLICY "Anyone can view photos"   ON profile_photos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photos" ON profile_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photos" ON profile_photos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete photos" ON profile_photos FOR DELETE USING (true);

-- 6) Realtime : ajouter la table à la publication (sinon aucun événement
--    postgres_changes n'est diffusé) + REPLICA IDENTITY FULL pour que les
--    événements DELETE contiennent user_id.
ALTER TABLE profile_photos REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profile_photos;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- déjà dans la publication
END $$;

-- 7) Storage : policies du bucket famtresor-photos
--    (UPDATE nécessaire car l'app upload avec upsert: true)
DROP POLICY IF EXISTS "Public read famtresor-photos" ON storage.objects;
CREATE POLICY "Public read famtresor-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'famtresor-photos');

DROP POLICY IF EXISTS "Public upload famtresor-photos" ON storage.objects;
CREATE POLICY "Public upload famtresor-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'famtresor-photos');

DROP POLICY IF EXISTS "Public update famtresor-photos" ON storage.objects;
CREATE POLICY "Public update famtresor-photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'famtresor-photos') WITH CHECK (bucket_id = 'famtresor-photos');

-- 8) Vérifications (résultats à lire dans l'onglet Results)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profile_photos'
ORDER BY ordinal_position;

SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'profile_photos'::regclass;

SELECT pubname, tablename FROM pg_publication_tables
WHERE tablename = 'profile_photos';
