# Setup Supabase Storage pour Photos de Profil

## 1️⃣ Crée le bucket Supabase Storage

Va sur **https://supabase.com/dashboard**

1. Clique sur projet **famtresor**
2. À gauche, clique **"Storage"**
3. Clique **"+ New bucket"**
4. Remplis:
   - **Name:** `famtresor-photos`
   - **Public bucket:** ✅ Coché (important!)
5. Clique **"Create bucket"**

## 2️⃣ Ajoute les permissions (Policies)

1. Dans Storage, clique sur le bucket **"famtresor-photos"**
2. Clique l'onglet **"Policies"**
3. Clique **"+ New policy"** (ou "New policy")
4. Sélectionne **"For SELECT"**
5. Remplis:
   - **Policy name:** `Public read`
   - **WHO can access this policy:** `true` (public)
6. Clique **"Create policy"**

7. Répète pour **INSERT** et **UPDATE**:
   - Policy name: `Users can upload photos`
   - WHO: `true` (ou `auth.uid()` si tu veux stricter)

## 3️⃣ Exécute le SQL dans Supabase

1. Va sur **SQL Editor** (left menu)
2. Clique **"+ New query"**
3. Copie le contenu de `docs/supabase-setup.sql`
4. Colle dans l'éditeur
5. Clique **"Run"** (ou Cmd+Enter)

✅ Tables + policies créées!

## 4️⃣ Test en local

```bash
cd ~/Documents/famtresor
npm install  # Si déjà fait, skip
npm run dev
```

Va sur http://localhost:5173

1. Clique sur ton avatar
2. Upload une photo
3. Ouvre l'app sur un autre appareil/navigateur
4. La photo devrait apparaître **immédiatement** ✅

## 5️⃣ Commit et push

```bash
cd ~/Documents/famtresor
git add -A
git commit -m "Sync photos profil: Supabase Storage + real-time"
git push origin main
```

Vercel redéploie automatiquement (~30s) ✅

## 🎯 Qu'est-ce qui se passe?

- Photo upload → Supabase Storage (bucket `famtresor-photos`)
- URL photo enregistrée dans table `profile_photos`
- Tous les devices écoutent `profile_photos` avec listeners real-time
- Quand un user change sa photo → tous les autres la voient **immédiatement** 🚀

## ⚠️ Problèmes?

**"Upload fails":**
- Vérifie que le bucket est PUBLIC
- Vérifie les policies (SELECT, INSERT, UPDATE)

**"Photo ne sync pas":**
- Vérifie Supabase Realtime est activé (Settings → Replication)
- Vérifie la table `profile_photos` existe
- Console (F12) pour voir les erreurs

**"Storage permissions error":**
- Bucket doit être PUBLIC
- Policies doivent autoriser INSERT/UPDATE
