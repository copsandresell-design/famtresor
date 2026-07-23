# 🚀 SETUP FINAL - FamTrésor

## CE QUI VIENT D'ÊTRE AJOUTÉ

✅ **Photos de profil dynamiques**
- Chaque user upload sa photo depuis galerie/caméra
- Compression automatique (webp, < 100KB)
- Stockage Supabase Storage
- **SYNC REAL-TIME**: tous les devices voient change immédiatement

✅ **Notifications quand enfant valide**
- Parent reçoit notification quand enfant complète une tâche
- Enfant reçoit notification quand parent approuve/refuse
- Son de confirmation optionnel
- Auto-dismiss après 5 secondes

✅ **Supabase real-time complet**
- Tâches
- Soumissions (demandes de validation)
- Transactions
- Photos profil
- Utilisateurs

---

## 📋 ÉTAPES À FAIRE

### 1️⃣ Crée Storage Bucket

**Va sur https://supabase.com/dashboard**

1. Projet **famtresor**
2. **Storage** (left menu)
3. **+ New bucket**
   - Name: `famtresor-photos`
   - Public: ✅ CHECKED
4. **Create bucket**

### 2️⃣ Exécute le setup script

```bash
cd ~/Documents/famtresor

node setup-supabase.js
```

Ce script:
- ✅ Crée les tables
- ✅ Configure les policies RLS
- ✅ Active les indexes
- ✅ Setup real-time listeners

### 3️⃣ Install et teste

```bash
npm install
npm run dev
```

Teste:
- [ ] Upload photo profil
- [ ] Ouvre app sur autre appareil
- [ ] Photo apparaît immédiatement ✅
- [ ] Enfant complète tâche
- [ ] Parent voit notification

### 4️⃣ Commit et push

```bash
git add -A
git commit -m "Ajout photos + notifications + storage Supabase

- Hook useProfilePhotos: upload + real-time sync
- Hook useSubmissionNotifications: notifications live
- Script setup-supabase.js (automation)
- Compression image (Canvas, webp)
- Supabase Storage integration
- Real-time listeners tous les événements"

git push origin main
```

Vercel redéploie automatiquement (~30s) ✅

---

## 🎯 WORKFLOW COMPLET

### Quand parent change une tâche:
```
Parent modifie tâche
    ↓
Supabase update
    ↓
Real-time listener
    ↓
Enfant voit change immédiatement ✅
```

### Quand enfant valide:
```
Enfant upload photo + "Je l'ai fait!"
    ↓
Création submission Supabase
    ↓
Real-time INSERT event
    ↓
Parent reçoit notification "XXX a complété YYY!" 🔔
    ↓
Parent approuve/refuse
    ↓
Enfant reçoit notification "Validée! +X€" ✅
    ↓
Transaction enregistrée
    ↓
Solde updated
    ↓
Tous les devices voient nouveau solde ✅
```

---

## ⚙️ ARCHITECTURE

```
FamTrésor App
├─ Frontend React
│  ├─ Hooks Supabase
│  │  ├─ useTasks (real-time)
│  │  ├─ useSubmissions (real-time)
│  │  ├─ useProfilePhotos (storage + real-time)
│  │  └─ useSubmissionNotifications (toast)
│  └─ Zustand store
│
├─ Supabase Backend
│  ├─ PostgreSQL DB
│  │  ├─ users
│  │  ├─ tasks
│  │  ├─ submissions
│  │  ├─ transactions
│  │  ├─ penalties
│  │  ├─ profile_photos
│  │  └─ audit_logs
│  │
│  ├─ Real-time (WebSocket)
│  │  └─ ALL tables subscribed
│  │
│  └─ Storage
│     └─ famtresor-photos/ (public bucket)
│
└─ Vercel Hosting
   └─ Auto-deploy on git push
```

---

## 🔐 SÉCURITÉ

- ✅ RLS (Row Level Security) sur toutes les tables
- ✅ Storage bucket public (images)
- ✅ API key anon (frontend seulement)
- ✅ Secret key NOT exposé (backend only)
- ✅ Password hashing (parents)
- ✅ PIN code (enfants)

---

## 📱 FONCTIONNALITÉS RESTANTES (BACKLOG)

- [ ] Badges/niveaux (Bronze→Argent→Or)
- [ ] Challenges hebdomadaires (bonus spéciaux)
- [ ] Catalogue récompenses (10€ = film)
- [ ] Retrait d'argent/caisse
- [ ] Rapports PDF mensuels
- [ ] Notifications push (exige backend)
- [ ] Images fond sections
- [ ] Icônes par catégorie

---

## 🆘 TROUBLESHOOT

**"Storage bucket not found":**
- Vérifie: Storage → Bucket name = `famtresor-photos`
- Vérifie: Public = ✅

**"Photos ne sync pas":**
- Console F12 → Errors?
- Vérifie Supabase Realtime activé (Settings → Replication)
- Vérifie table `profile_photos` existe

**"Setup script erreur":**
- Vérifie credentials Supabase correctes
- Essaie SQL manuellement: SQL Editor → copy/paste docs/supabase-setup.sql

**"Notifications pas visibles":**
- Vérifie que hook useSubmissionNotifications est intégré au layout
- Console pour voir errors

---

## ✨ PROCHAINE ÉTAPE

Une fois tout testé et en production:

**Voulez-vous ajouter:**
A. Badges/Niveaux (gamification)
B. Challenges hebdo (engagement)
C. Catalogue récompenses (conversion €)
D. Tout!

---

**C'est LIVE! 🚀🎉**
