# 💰 FamTrésor

L'app familiale où les tâches ménagères rapportent de vrais euros. PWA locale
(aucun serveur, aucune donnée qui sort de l'appareil) pour Marion, Julien,
Lorenzo et Kelly.

## Démarrage

```bash
npm install
npm run dev        # développement (http://localhost:5173)
npm run build      # build de production + service worker PWA
npm run preview    # sert le build (http://localhost:4173)
npm test           # tests unitaires (vitest)
```

## Codes d'accès par défaut

| Profil | Type | Code |
| --- | --- | --- |
| Marion | Parent | `parent` |
| Julien | Parent | `parent` |
| Lorenzo | Enfant | PIN `1111` |
| Kelly | Enfant | PIN `2222` |

⚠️ **À changer dès la première utilisation** : mot de passe parent dans
Réglages → Sécurité, PIN des enfants dans Enfants → Modifier. Un bandeau le
rappelle sur l'accueil parent tant que des codes par défaut restent actifs.

## Ce que fait l'app

**Côté parents** — vue d'ensemble (soldes, tendances 7 jours, tâches à valider),
CRUD complet des tâches (récurrence quotidienne / 2×semaine / hebdo / mensuelle,
montants, difficulté, assignation), centre de validations (approuver / refuser
avec motif, **photos de preuve en lightbox plein écran**, commentaire de
l'enfant), **message d'encouragement après chaque approbation** (raccourcis ou
texte libre), **calendrier mensuel** avec gains par jour et détail des
transactions, pénalités (annulables sous 24 h, plancher de solde configurable),
statistiques (podium du mois, gains par semaine, évolution des soldes,
répartition par catégorie), journal d'audit complet filtrable avec export CSV,
réglages (nom de famille, bonus initiative, thème clair/sombre/auto).

**Côté enfants** — héros dégradé à la couleur de l'enfant avec cagnotte géante
animée, **série 🔥 de jours consécutifs** (avec alerte quand elle se joue),
tâches du jour avec « Je l'ai fait ! », **jusqu'à 5 photos de preuve**
(caméra ou galerie, compressées en local) + commentaire, case ⭐ initiative,
**9 badges à débloquer** avec barres de progression et modal de célébration,
**messages reçus des parents**, **galerie des photos validées**, rang familial
du mois, historique en timeline. Confettis à chaque validation.

## Design V2

Thème sombre par défaut (slate-950), dégradés par enfant (Lorenzo bleu→cyan,
Kelly rose→violet), boutons en dégradé (primaire bleu→violet→rose, succès
émeraude→citron), titres et chiffres en Poppins, anneaux d'avatar en dégradé,
animations d'entrée en cascade. Le thème clair reste entièrement stylé
(Réglages → Apparence).

## Règles métier

- **Les montants sont stockés en centimes** (entiers) — jamais de flottants.
- **Le solde est dérivé des transactions** (somme), jamais stocké : l'audit
  et le solde ne peuvent pas diverger.
- Annuler une pénalité crée une **contre-passation** (+montant), l'originale
  est marquée annulée — rien n'est jamais supprimé de l'historique.
- Réinitialiser un solde crée un ajustement tracé dans le journal.
- Une soumission **refusée redonne sa chance** : la tâche redevient disponible.
- Session de 30 minutes, prolongée à chaque navigation.
- Codes hachés (SHA-256 salé, Web Crypto). Données dans IndexedDB via
  localforage. **Nécessite un contexte sécurisé** (localhost ou HTTPS).
- Photos compressées côté client (Canvas, max 1280 px JPEG 0.8 + miniature
  240 px), stockées dans IndexedDB — jamais envoyées nulle part.
- Badges **calculés à la volée** depuis les transactions/soumissions (aucun
  état à stocker, impossible qu'ils divergent) ; seuls les badges « déjà vus »
  sont mémorisés pour l'animation de déblocage. Seuils calibrés sur des tâches
  à 1–2 € (Golden Week 10 €/semaine, Teamplayer 25 €/mois en fratrie,
  Centenaire 100 € cumulés) — modifiables dans `src/lib/badges.ts`.

## Architecture

```text
src/
  types.ts            Modèle de données (User, Task, TaskSubmission, Transaction, AuditLog…)
  db/                 localforage (storage.ts) + données initiales (seed.ts)
  store/useStore.ts   Store zustand : état, mutations, journal d'audit, persistance
  lib/                Logique pure testée : recurrence, balance, format, csv, crypto
  components/
    ui/               Button, Card, Modal, Tabs, Badge, AnimatedBalance…
    layout/           ParentLayout (sidebar + nav mobile), ChildLayout
  pages/
    LoginPage         Choix de profil + PIN pad / mot de passe
    parent/           Overview, Tasks, Approvals, Penalties, Stats, Children, Logs, Settings
    child/            Home, History, Profile
```

Stack : Vite 6 · React 19 · TypeScript strict · Tailwind 4 · zustand ·
framer-motion · recharts (chargé à la demande sur la page Stats) ·
date-fns · localforage · vite-plugin-pwa.

## Reste à faire (backlog)

- Notifications push (nécessiterait un serveur)
- Pénalités récurrentes (volontairement écarté : une sanction automatique
  sans regard parental semble une mauvaise idée — à rediscuter)
- Export PDF du journal (CSV disponible ; jsPDF jugé trop lourd pour l'usage)
- Nettoyage des photos orphelines (soumission refusée = photos conservées)
- Icônes PNG pour anciens navigateurs (icônes SVG fournies)
- E2E automatisés versionnés (deux smoke tests Playwright ont validé les
  parcours complets V1 et V2 — photo, lightbox, message, calendrier, badge —
  lors du développement)
