# GODCLAUDE — Transformation multi-familles + freemium

Point d'avancement : **Phase 1 terminée et vérifiée. Phase 2 (scaffold minimal) terminée.
Phases 3 (limites freemium), 4 (Stripe) et 5 (packs cosmétiques) NON commencées.**

Conformément à la consigne reçue ("avance autant de phases que possible, arrête-toi après
la phase la plus avancée correctement terminée et vérifiée, documente où et pourquoi"), ce
document explique précisément l'état des lieux, ce qui a été vérifié et comment, et ce qui
reste à faire — y compris les **actions manuelles obligatoires côté Julien avant tout
déploiement** (section "Déploiement" ci-dessous, à lire en premier).

## Pourquoi s'arrêter ici

Les phases 1 et 2 touchent à l'authentification et à l'isolation des données entre
familles : c'est la partie la plus sensible de tout GODCLAUDE (une erreur ici = fuite de
données entre familles, ou la famille de Julien bloquée hors de sa propre app). Les avoir
faites *et vérifiées avec un vrai test d'isolation locale* avant de passer à autre chose
était non-négociable. Les phases 3/4/5 (limites freemium, Stripe, packs cosmétiques) sont
des couches produit au-dessus de ces fondations — moins risquées individuellement, mais
represent encore beaucoup de travail (UI d'upsell, intégration Stripe test mode, config de
packs). Les faire à la va-vite dans le temps restant aurait sacrifié la rigueur qui vient
d'être mise dans les phases 1-2. Elles sont documentées comme travail futur, non commencé.

## Ce qui a été fait — Phase 1

### Schéma
- `supabase/migrations/20260728000000_baseline_core_tables.sql` : comble un trou
  d'historique découvert en essayant de rejouer les migrations sur un stack Supabase CLI
  local — 8 tables (`sync_users`, `sync_tasks`, `sync_submissions`, `sync_transactions`,
  `sync_savings_goals`, `sync_settings`, `profile_photos`, `push_subscriptions`) existent
  en production mais n'avaient jamais été créées par une migration committée (créées à la
  main via le dashboard/l'API avant l'adoption de migrations). Idempotent, sans effet en
  production où elles existent déjà avec la même RLS "public all".
- `supabase/migrations/20260730010000_multi_family_phase1.sql` : le cœur du travail.
  - Tables `families`, `family_members` (1 famille par compte Supabase Auth), et
    `family_claim_codes` (codes de rattachement à usage unique — voir "Déploiement").
  - `current_family_id()` : fonction `SECURITY DEFINER` qui lit `family_members` pour
    l'utilisateur Supabase Auth courant — contourne volontairement la RLS de
    `family_members` pour éviter une récursion (sa propre policy SELECT en dépend).
  - `set_family_id()` : trigger `BEFORE INSERT` qui tamponne `family_id` automatiquement
    depuis la session authentifiée, **seulement si le client ne l'a pas déjà fourni** — ça
    laisse les scripts serveur (cron Vercel, clé `service_role`, sans session utilisateur)
    fournir explicitement le `family_id` de la famille qu'ils traitent. La vraie garantie de
    sécurité n'est PAS ce trigger mais la policy `WITH CHECK (family_id = current_family_id())`
    sur chaque table : impossible à satisfaire avec autre chose que sa propre famille, quel
    que soit ce que le client tente d'envoyer (vérifié empiriquement, voir plus bas).
  - `family_id` ajouté (avec backfill vers la famille fondatrice, puis `NOT NULL`, index,
    trigger, RLS réécrite) sur **19 tables** : les 17 `sync_*` (dont `sync_task_suggestions`,
    ajoutée par la fonctionnalité précédente) + `profile_photos` + `push_subscriptions`
    (deux tables à colonnes réelles, hors du motif générique JSONB, mais contenant de
    vraies données par famille — mêmes garanties d'isolation appliquées).
  - RLS réécrite : suppression de **toute** policy existante sur chacune de ces tables
    (par nom réellement présent dans `pg_policies`, pas une liste de noms devinés — certaines
    tables comme `push_subscriptions` n'avaient jamais eu de migration donc leurs noms de
    policy réels n'étaient pas connus avec certitude), remplacée par
    `family_select`/`family_insert`/`family_update`/`family_delete` scopées par famille.
  - RPC `create_family_for_current_user(name)` : signup normal, nouvelle famille.
  - RPC `claim_founder_family(code)` : rattache le compte Supabase Auth courant à la
    famille fondatrice (Julien) via un code à usage unique — voir "Déploiement".
- `supabase/migrations/20260730020000_phase2_founder_access.sql` (phase 2) :
  `has_family_access(family_id, feature)`, le verrou central unique que les phases 3/5
  devront utiliser. Renvoie toujours `true` pour la famille fondatrice. Comme aucune limite
  freemium ni pack cosmétique n'existe encore, elle renvoie `true` pour tout le monde pour
  l'instant (rien à restreindre) — c'est le point d'entrée qui existe déjà, prêt à être
  complété par ces phases futures.

### Correctifs nécessaires ailleurs (découverts pendant l'implémentation)
- `api/check-inactivity.ts` et `api/daily-reminder.ts` (crons Vercel) utilisent la clé
  `service_role`, qui **contourne totalement la RLS** (pas de session utilisateur, donc
  `current_family_id()` renverrait `NULL`). Sans correctif, ces crons auraient soit échoué
  (violation `NOT NULL` sur `family_id`), soit pire, mélangé les réglages/utilisateurs de
  familles différentes dans une seule passe. Réécrits pour itérer famille par famille et
  tamponner explicitement `family_id` sur chaque ligne insérée.
- `src/store/useStore.ts` : la seed de secours (`seedUsers()`/`seedTasks()`, utilisée quand
  `sync_users` distant est vide) hardcodait la famille réelle de Julien (Marion, Lorenzo,
  Kelly, PIN par défaut inclus). Avant le multi-familles, `sync_users` vide ne pouvait
  vouloir dire qu'"app jamais connectée à Supabase" (donc cloner Julien avait un sens : son
  propre premier lancement, historique). Avec le multi-familles, `sync_users` vide veut
  aussi dire "famille toute neuve" — cloner Julien dans le tenant d'une autre famille aurait
  été un vrai bug (pas une fuite entre tenants, mais une donnée totalement fausse livrée à
  un nouveau client). Supprimé ; une famille neuve démarre vide (seul le flux de signup crée
  son premier profil parent), les catalogues génériques (séries/badges/rangs, sans donnée
  personnelle) restent seedés.

### Frontend
- `src/lib/familyAuth.ts`, `src/store/familyAuthStore.ts` : couche Supabase Auth
  (email + mot de passe) et son statut (`loading` / `signed-out` / `needs-family` / `ready`).
- `src/pages/FamilyAuthScreen.tsx` : écran de connexion/inscription parent, affiché **avant**
  le picker PIN existant (`LoginPage.tsx`, inchangé) quand aucune session Supabase Auth
  n'existe encore sur l'appareil — connexion, création de compte, puis choix "nouvelle
  famille" ou "rejoindre avec un code".
- `src/App.tsx` : gate ajoutée sans toucher à la structure existante — `/demo` reste
  atteignable sans aucune authentification Supabase (vérifié, voir plus bas), le picker PIN
  et les routes parent/enfant sont strictement inchangés une fois `familyAuthStatus === 'ready'`.
- `src/pages/parent/SettingsPage.tsx` : bouton "Se déconnecter de cet appareil" (Supabase
  Auth, tous les profils) — distinct du bouton "Déconnexion" existant dans le menu (change
  juste de profil PIN, reste dans la même famille sur l'appareil).
- **Aucun changement dans `src/lib/sync.ts`** ni dans la logique `fetchAll`/`pushRecord`/
  `subscribeTable` de `useStore.ts` : le scoping par famille est entièrement implicite (RLS +
  trigger côté Postgres), confirmé par le test d'isolation ci-dessous ET par l'usage réel en
  navigateur (voir "Vérifications").

## Test d'isolation croisée réel (non-négociable, exigé explicitement)

Conformément au choix explicite de l'utilisateur ("Supabase CLI local (Recommandé)"), la
vérification a été faite en exécutant un vrai stack Supabase local (Docker, via
`supabase init` / `supabase start` / `supabase db reset`), PAS en relecture de code ni en
demandant à Julien de tester en production.

Script : conservé en référence dans le message de fin de session (non committé dans le
repo — c'est un script de test jetable contre un stack local, pas du code applicatif).
Scénario exact :
1. Deux comptes Supabase Auth de test créés sur le stack local.
2. Le premier rejoint la **vraie** famille fondatrice (celle de Julien, déjà backfillée par
   la migration) via `claim_founder_family(code)` — exactement le flux prévu pour Julien en
   production.
3. Le second crée une famille toute neuve via `create_family_for_current_user(...)` —
   exactement le flux d'un nouveau client.
4. **24 assertions**, toutes passées :
   - La famille fondatrice voit ses vraies données déjà backfillées (Hugo, Kenzo — les 2
     seuls utilisateurs reproductibles par migration ; Julien/Marion/Kelly/Lorenzo existent
     en prod mais ont été créés à la main avant l'adoption des migrations, donc absents du
     stack local reconstruit from scratch — ceci est *voulu* : leurs identifiants hashés ne
     doivent jamais être committés dans git).
   - La famille neuve ne voit RIEN de la famille fondatrice (ni Hugo/Kenzo, ni ses tâches).
   - Écriture d'une tâche de test dans chaque famille : `family_id` correctement tamponné
     de façon implicite (jamais envoyé par le client).
   - Lecture croisée : chaque famille ne voit que sa propre tâche de test.
   - La famille B tente de **modifier** une tâche de la famille A (id connu) → 0 ligne
     affectée, donnée de A inchangée après vérification.
   - La famille B tente de **supprimer** une tâche de la famille A (id connu) → 0 ligne
     affectée, la tâche de A existe toujours.
   - La famille B tente d'**usurper** la famille A en forgeant `family_id` dans le payload
     d'un INSERT → rejeté par la policy `WITH CHECK`, rien n'apparaît chez A. Ce test prouve
     que l'isolation ne repose pas sur la confiance envers le trigger, mais sur une contrainte
     RLS réellement appliquée par Postgres.
   - Même batterie de tests répétée sur `profile_photos` (colonnes réelles, pas le motif
     JSONB générique) : mêmes garanties, confirmant que la réécriture RLS généralise
     correctement aux 19 tables, pas seulement à une.

Résultat : **succès complet, aucune fuite dans aucun sens, aucune tentative de
lecture/écriture croisée n'a réussi.**

## Vérifications supplémentaires (navigateur réel, pas seulement API)

Via une copie jetable du repo (rsync hors `node_modules`/`dist`/`.git`/`ios`/`android`),
`src/lib/supabase.ts` temporairement repointé vers le stack local (jamais vers la
production), servie sur un port dev jetable, pilotée par Playwright :
- **Flux d'inscription complet** : écran de connexion → bascule "créer un compte" → email/
  mot de passe → choix "Nouvelle famille" → nom de famille + prénom + code secret → le
  picker PIN affiche alors *uniquement* le parent fraîchement créé (aucune trace de Julien/
  Hugo/Kenzo) → connexion avec le code secret choisi → atterrissage sur `/parent`, tableau de
  bord vide (0 pts, aucun enfant) comme attendu pour une famille neuve.
- **`/demo` toujours atteignable sans authentification Supabase** : confirmé indépendant du
  nouveau gate, exactement comme avant.

La copie jetable a été supprimée après le test ; aucune donnée de production n'a été
touchée à aucun moment.

## tsc / tests / build

`npx tsc -b`, `npm test -- --run` (63 tests, tous passants) et `npm run build` : tous verts
après chaque étape significative de ce travail.

## Déploiement — **à lire avant de pousser quoi que ce soit**

⚠️ **Risque de blocage complet de la famille de Julien si l'ordre ci-dessous n'est pas
respecté.** Une fois le frontend déployé, l'app affichera le nouvel écran de connexion
Supabase Auth **avant** le picker PIN habituel — tant que personne n'a rattaché un compte à
la famille fondatrice, plus personne ne peut passer cet écran pour atteindre le picker PIN.

Rien n'a été poussé ni commité automatiquement (changement trop sensible pour un
déploiement sans supervision directe). Séquence à suivre, dans cet ordre exact :

1. **Dans le SQL Editor Supabase (production)**, exécuter dans l'ordre :
   - `supabase/migrations/20260730000000_task_suggestions.sql` (déjà en attente depuis la
     fonctionnalité précédente, sans rapport avec GODCLAUDE)
   - `supabase/migrations/20260728000000_baseline_core_tables.sql`
   - `supabase/migrations/20260730010000_multi_family_phase1.sql`
   - `supabase/migrations/20260730020000_phase2_founder_access.sql`
2. **Immédiatement après**, récupérer les codes de rattachement de la famille fondatrice :
   ```sql
   SELECT label, code FROM family_claim_codes
   JOIN families ON families.id = family_claim_codes.family_id
   WHERE families.is_founder = true;
   ```
   Deux codes sont générés ("parent 1", "parent 2") — un pour Julien, un pour Marion si elle
   veut son propre compte. Chaque code est à usage unique (supprimé automatiquement une fois
   utilisé par `claim_founder_family`).
3. **Déployer le frontend** (`git push` sur `main`, déploiement Vercel automatique).
4. **Immédiatement après le déploiement**, sur kids-up.vercel.app : créer un compte
   (email + mot de passe, différent du PIN existant), choisir "J'ai un code", coller un des
   deux codes récupérés à l'étape 2. Le picker PIN habituel doit alors réapparaître avec
   Julien/Marion/Kelly/Hugo/Lorenzo/Kenzo exactement comme avant.

Tant que l'étape 4 n'est pas faite, personne dans la famille ne peut utiliser l'app déployée
— à faire dans la foulée du déploiement, pas "plus tard dans la journée".

## Ce qui reste — Phases 3, 4, 5 (non commencées)

- **Phase 3** : limites freemium (famille gratuite = 2 enfants max, avatars par défaut
  uniquement, catalogues standards, boutique basique ; premium = illimité). Blocage côté
  parent avec upsell, jamais visible aux enfants. Doit passer par `has_family_access()`.
- **Phase 4** : facturation Stripe, clés TEST uniquement, mensuel/annuel, webhook Vercel.
- **Phase 5** : packs cosmétiques (Dinosaures, Pirates, Fées & licornes, Robots), config
  extensible, vente à l'unité ou avec le premium via Stripe test mode.

Aucune de ces trois phases n'a de code écrit à ce stade — seul le chokepoint
`has_family_access()` (phase 2) existe en prévision.
