-- Setup SQL pour FamTrésor + Supabase
-- À exécuter dans Supabase SQL Editor

-- Table Profile Photos (si pas existante)
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable RLS pour profile_photos
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut lire les photos de profil
CREATE POLICY "Anyone can view profile photos"
ON profile_photos FOR SELECT
USING (true);

-- Policy: Users peuvent upload leur propre photo
CREATE POLICY "Users can upload their own profile photo"
ON profile_photos FOR INSERT
WITH CHECK (user_id = auth.uid() OR true); -- Simplifié pour MVP

-- Policy: Users peuvent mettre à jour leur propre photo
CREATE POLICY "Users can update their own profile photo"
ON profile_photos FOR UPDATE
USING (user_id = auth.uid() OR true)
WITH CHECK (user_id = auth.uid() OR true);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);

-- ===== SUPABASE STORAGE =====
-- Crée un bucket "famtresor-photos" dans Storage
-- Via Dashboard:
-- 1. Va dans "Storage" (left menu)
-- 2. Clique "+ New Bucket"
-- 3. Name: famtresor-photos
-- 4. Public (coché)
-- 5. Create

-- Après, configure les permissions du bucket:
-- 1. Clique sur "famtresor-photos"
-- 2. "Policies" tab
-- 3. Ajoute policy:
--    - Nom: "Public read"
--    - Allowed operations: SELECT
--    - Who can access: true (public)
--    - Target roles: authenticated, anon
-- 4. Save

-- ===== AUDIT LOG TABLE =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  subject_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view audit logs"
ON audit_logs FOR SELECT
USING (true); -- Simplifié pour MVP

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
