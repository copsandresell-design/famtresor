# 🔧 CLAUDE CODE PROMPT - FIX PHOTO SYNC COMPLET

## CONTEXTE
La synchronisation des photos de profil entre appareils ne fonctionne pas. Les photos changent uniquement dans la même session/appareil, pas cross-device. 

**Root causes identifiés:**
1. Paramètre `onConflict` manquait dans `.upsert()` → crée des doublons au lieu de mettre à jour
2. Colonne `user_id` peut ne pas être `UNIQUE` dans table `profile_photos`
3. RLS policies peuvent bloquer l'accès aux données
4. Realtime peut ne pas être configuré correctement

---

## MISSION
**Corriger TOUS les problèmes de synchronisation photo et tester que ça marche cross-device.**

---

## ÉTAPES DÉTAILLÉES

### 1️⃣ FIXER LE CODE (src/lib/photos.ts)

**Vérifier/corriger:**
- ✅ Ligne ~65: `.upsert()` DOIT avoir `{ onConflict: 'user_id' }`
- ✅ Gestion d'erreur: Logs clairs si upload Storage échoue
- ✅ Gestion d'erreur: Logs clairs si upsert table échoue
- ✅ N'utilise pas `console.warn` silencieux - utilise `console.error` avec context

**Code exemple correct:**
```typescript
const { error: dbError } = await supabase
  .from('profile_photos')
  .upsert({
    user_id: userId,
    photo_url: photoUrl,
    uploaded_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })  // ✅ ESSENTIEL

if (dbError) {
  console.error('❌ Profile photo DB upsert failed:', {
    userId,
    photoUrl,
    error: dbError.message
  })
  throw dbError
}
```

---

### 2️⃣ SETUP SUPABASE - TABLE STRUCTURE

**Exécute ce SQL dans Supabase → SQL Editor:**

```sql
-- 1. Ajouter constraint UNIQUE sur user_id si n'existe pas
ALTER TABLE profile_photos 
ADD CONSTRAINT profile_photos_user_id_unique UNIQUE (user_id) 
ON CONFLICT DO NOTHING;

-- 2. S'assurer que les colonnes existent
ALTER TABLE profile_photos 
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Créer un index sur user_id pour perf
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id 
ON profile_photos(user_id);

-- 4. Vérifier la structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profile_photos'
ORDER BY ordinal_position;
```

---

### 3️⃣ VÉRIFIER/CORRIGER RLS POLICIES

**Exécute ce SQL dans Supabase → SQL Editor:**

```sql
-- RLS pour table profile_photos
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- Lecture: Tout le monde peut lire les photos
DROP POLICY IF EXISTS "Anyone can view photos" ON profile_photos;
CREATE POLICY "Anyone can view photos"
  ON profile_photos FOR SELECT
  USING (true);

-- INSERT: Utilisateur peut upserter sa propre photo
DROP POLICY IF EXISTS "Users can upsert their own photo" ON profile_photos;
CREATE POLICY "Users can upsert their own photo"
  ON profile_photos FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- UPDATE: Utilisateur peut mettre à jour sa propre photo
DROP POLICY IF EXISTS "Users can update their own photo" ON profile_photos;
CREATE POLICY "Users can update their own photo"
  ON profile_photos FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
```

---

### 4️⃣ VÉRIFIER STORAGE BUCKET RLS

**Exécute dans Supabase → SQL Editor:**

```sql
-- S'assurer que le bucket 'famtresor-photos' existe avec RLS correctes
-- Lecture publique
DROP POLICY IF EXISTS "Public read famtresor-photos" ON storage.objects;
CREATE POLICY "Public read famtresor-photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'famtresor-photos');

-- Upload public
DROP POLICY IF EXISTS "Public upload famtresor-photos" ON storage.objects;
CREATE POLICY "Public upload famtresor-photos" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'famtresor-photos');
```

---

### 5️⃣ VÉRIFIER REALTIME

**Dans Supabase Dashboard:**
- Aller à **Settings → Realtime**
- Toggle **Realtime** doit être **ON** (vert)
- Si OFF → **Activer-le!**

**OU exécute (Supabase CLI):**
```bash
# Si tu as Supabase CLI:
supabase realtime stats
```

---

### 6️⃣ AMÉLIORER LOGS & DEBUGGING

**Dans src/lib/photos.ts, ajouter logs détaillés:**

```typescript
console.log('📸 Starting photo upload...', { userId, fileSize: full.size })

// Avant Storage upload
console.log('📤 Uploading to Storage:', { filePath })

// Après Storage upload
if (uploadError) {
  console.error('❌ Storage upload failed:', uploadError)
} else {
  console.log('✅ Storage upload success:', { photoUrl })
}

// Avant DB upsert
console.log('💾 Upserting to DB:', { userId, photoUrl })

// Après DB upsert
if (dbError) {
  console.error('❌ DB upsert failed:', dbError)
} else {
  console.log('✅ DB upsert success')
}
```

---

### 7️⃣ VÉRIFIER HOOK - useProfilePhotos.ts

**Vérifier que:**
- ✅ Hook fetch les photos initiales: `.select('user_id, photo_url')`
- ✅ Hook subscribe aux changements: `.on('postgres_changes', { event: '*', ... })`
- ✅ Le channel a un ID unique pour éviter les doublons: `profile-photos-${Math.random()}`
- ✅ Le payload mapping est correct:
  ```typescript
  const { user_id, photo_url } = payload.new as Database['public']['Tables']['profile_photos']['Row']
  ```

---

### 8️⃣ TESTER CROSS-DEVICE

**Script de test (à exécuter après déploiement):**

1. **Ouvre 2 onglets de navigateur** (ou 2 appareils)
2. **Onglet A:** Se connecter → Aller à Children → Cliquer sur l'avatar d'un enfant → Uploader une photo
3. **Onglet B:** (Sans refresh!) La photo devrait **changer en temps réel**
4. **Si ça marche:** ✅ SUCCÈS
5. **Si ça ne marche pas:** Ouvrir Console Dev (F12) et regarder les logs

---

### 9️⃣ COMMIT & DEPLOY

**Commit les changements:**
```bash
git add -A
git commit -m "fix: complete photo sync - add onConflict, verify RLS, add logging"
git push origin main
```

**Vercel va redéployer automatiquement** (attendre 2-3 min)

---

## CHECKLIST FINALE

- [ ] Code photos.ts a `onConflict: 'user_id'`
- [ ] Code photos.ts a logs détaillés pour debugging
- [ ] SQL execuée: UNIQUE constraint sur user_id
- [ ] SQL execuée: RLS policies pour profile_photos
- [ ] SQL execuée: RLS policies pour storage bucket
- [ ] Supabase Realtime est ON
- [ ] Hook useProfilePhotos est correct
- [ ] Test cross-device réussi ✅
- [ ] Commit & push à main

---

## SI TOUJOURS PAS DE SUCCÈS

**Vérifier les logs Supabase:**
1. Dashboard → **Logs** (en bas à gauche)
2. Chercher les erreurs RLS ou les failed upserts
3. Vérifier le network tab dans Console Dev (F12)

**Potentiels problèmes restants:**
- user_id ne matchant pas entre sessions (format différent?)
- RLS policies bloquant les requêtes
- Realtime non activé au niveau du projet
- Browser cache empêchant les updates

---

## RÉSULTAT ATTENDU

✅ **Photo changée sur Appareil A → Appareil B la voit changer en temps réel** (< 1 sec)
