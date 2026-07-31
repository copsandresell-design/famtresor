# GODCLAUDE — Transformation multi-familles + freemium

Point d'avancement : **Les 5 phases sont terminées et vérifiées** (dans la limite de ce qui
est testable sans compte Stripe réel — voir sections Phase 4 et Phase 5). GODCLAUDE est donc
entièrement implémenté à ce stade ; ce qui reste est décrit en bas de ce document
("Ce qui reste").

Conformément à la consigne reçue ("avance autant de phases que possible, arrête-toi après
la phase la plus avancée correctement terminée et vérifiée, documente où et pourquoi"), ce
document explique précisément l'état des lieux, ce qui a été vérifié et comment, et ce qui
reste à faire — y compris les **actions manuelles obligatoires côté Julien avant tout
déploiement** (section "Déploiement" ci-dessous, à lire en premier).

## Choix produit faits sans validation explicite (question posée, refusée par l'utilisateur)

Avant d'implémenter la phase 3, une question de clarification a été posée sur trois points
(quels verrous exacts pour "catalogues standards", quelles fonctionnalités comptent comme
"avancées", comment activer premium sans Stripe) — refusée par l'utilisateur ("reprend").
Les choix suivants ont donc été faits de façon autonome et sont **à valider/ajuster** :

- Catalogue **tâches** : reste librement personnalisable en gratuit (cœur de l'usage
  quotidien).
- Fonctionnalités passées premium : Stats & Calendrier, pénalités automatiques (inactivité +
  récurrentes), photos de profil personnalisées (avatars emoji par défaut toujours gratuits).
- Personnalisation **boutique/séries/badges/rangs** : pas un mur total — une famille gratuite
  peut créer/modifier `MAX_FREE_CUSTOM` (1) élément personnalisé par catégorie avant l'upsell
  (les catalogues par défaut restent toujours consultables/activables gratuitement, quel que
  soit ce nombre). Donne un vrai avant-goût plutôt qu'un blocage dès le premier usage.
- **Propositions de tâches par les enfants : restées entièrement gratuites**, sans condition
  — seule fonctionnalité premium envisagée qui touchait directement l'expérience de l'ENFANT
  (agence/engagement), donc la seule où une restriction risquait de casser l'usage quotidien
  avant même qu'un parent n'envisage de payer.
- Activation premium avant/en dehors de Stripe (phase 4, maintenant faite) : colonne
  `families.plan` reste modifiable à la main en SQL en secours
  (`UPDATE families SET plan = 'premium' WHERE id = '<family_id>'`) — pas d'écran admin dédié.

## Pourquoi s'arrêter ici

Les phases 1 et 2 touchent à l'authentification et à l'isolation des données entre
familles : c'est la partie la plus sensible de tout GODCLAUDE (une erreur ici = fuite de
données entre familles, ou la famille de Julien bloquée hors de sa propre app). Les avoir
faites *et vérifiées avec un vrai test d'isolation locale* avant de passer à autre chose
était non-négociable. La phase 3 (limites freemium) est une couche produit au-dessus de ces
fondations — moins risquée individuellement mais representant tout de même du travail réel
(UI d'upsell dans 7 endroits différents, cohérence démo/gratuit/fondateur). Les phases 4/5
(Stripe, packs cosmétiques) sont plus lourdes encore (intégration paiement réelle, config de
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
  utilisent. Renvoie toujours `true` pour la famille fondatrice.

## Ce qui a été fait — Phase 3 (limites freemium)

- `supabase/migrations/20260731000000_phase3_freemium_plan.sql` : ajoute `families.plan`
  (`'free'` par défaut, `'premium'` posé automatiquement sur la famille fondatrice — en plus
  de `is_founder`, qui reste la vraie garantie non-négociable). `has_family_access()` mise à
  jour avec la vraie liste des fonctionnalités verrouillées en gratuit : `custom_shop_catalog`,
  `custom_avatar_photos`, `stats_calendar`, `automatic_penalties`, `custom_gamification_defs`,
  `task_suggestions`. Toute clé future non listée reste `true` par défaut (fail-open, pour ne
  jamais bloquer silencieusement une fonctionnalité qu'on aurait oublié d'y ajouter).
- `src/lib/access.ts` : `FeatureKey` (doit rester synchronisée avec la liste SQL ci-dessus —
  commentée comme telle des deux côtés), `computeAccess()` (miroir synchrone, pour l'affichage,
  de `has_family_access()` — évite un aller-retour réseau par rendu), `hasAccess()` (RPC,
  faisant autorité), `MAX_FREE_CHILDREN = 2` (limite numérique, pas un `FeatureKey` booléen,
  donc pas gérée par `has_family_access()` — vérifiée directement avec le nombre réel
  d'enfants).
- `src/components/ui/PremiumGate.tsx` : composant réutilisable (carte "✨ + upsell") utilisé
  pour gater les routes Stats, Calendrier, Badges/Séries/Rangs personnalisés, et l'onglet
  Propositions de tâches (voir `App.tsx`, `TasksPage.tsx`). Pas de vrai paiement (phase 4 non
  commencée) : le bouton affiche juste "Le paiement Premium arrive bientôt !".
- Gates supplémentaires, chacun avec son propre verrou inline (pas via `PremiumGate`, car
  imbriqués dans une page existante plutôt que sur une route dédiée) :
  - `ChildrenPage.tsx` : limite à `MAX_FREE_CHILDREN`, bandeau + bouton "Nouveau profil"
    bloqué au-delà (comptage sur TOUS les profils enfant, actifs ou non, pour qu'on ne
    puisse pas contourner en désactivant un profil).
  - `ShopPage.tsx` : le catalogue de départ reste consultable/assignable gratuitement ;
    "Nouveau lot" et "Modifier" un lot existant sont gatés.
  - `AvatarEditorModal.tsx` : avatars emoji toujours gratuits, "Prendre une photo"/"Choisir
    dans la galerie" gatés.
  - `SettingsPage.tsx` : activer (pas désactiver) les pénalités récurrentes/d'inactivité est
    gaté ; **`defaultSettings` (db/seed.ts) changé pour qu'une famille neuve démarre avec ces
    deux réglages à `false`** (ils valaient `true`/`false` par défaut avant — une famille
    gratuite ne doit pas démarrer avec une fonctionnalité premium déjà activée). Sans
    incidence sur la famille de Julien (ses réglages réels existent déjà côté Supabase).
  - `ChildHomePage.tsx` (côté ENFANT) : la section "Mes propositions" est masquée en
    silence si la famille n'a pas Premium — **jamais de paywall montré à un enfant**,
    exactement le même traitement que le réglage `settings.features.taskSuggestions` déjà
    existant, juste une condition de plus.
  - `api/check-inactivity.ts` : défense en profondeur — le cron vérifie lui-même
    `has_family_access(familyId, 'automatic_penalties')` avant d'appliquer quoi que ce soit,
    indépendamment de ce que dit le réglage local (utile si un réglage `true` traînait déjà,
    ou en cas de rétrogradation future premium → gratuit).
- **Mode démo toujours intégral** : chaque gate ci-dessus court-circuite si
  `useDemoMode().active` est vrai, car `useFamilyAuthStore` (dont dépend `computeAccess`)
  reflète le VRAI statut Supabase Auth de l'appareil, jamais conscient du mode démo — sans ce
  bypass explicite, visiter `/demo` aurait montré une version "gratuite" bridée de l'app au
  lieu de la vitrine complète attendue. Vérifié en navigateur (voir plus bas).

### Vérification réelle (navigateur, stack local)

Même technique que pour la phase 1 (copie jetable du repo, `src/lib/supabase.ts` repointé
vers le stack Supabase local, jamais vers la production) :

- **Famille gratuite neuve** (signup complet) : Stats, Calendrier et Badges personnalisés
  affichent bien l'upsell ; 2 enfants se créent normalement ; le bandeau de limite apparaît
  après le 2ᵉ ; un 3ᵉ enfant serait bloqué (bouton redirigé vers un message, pas de blocage
  DB).
- **Famille fondatrice** (rattachée via un profil parent de test inséré directement en local,
  Julien/Marion réels non reproductibles localement — voir plus haut) : aucun upsell nulle
  part, et le bandeau de limite enfants n'apparaît PAS malgré 2 enfants déjà présents
  (Hugo/Kenzo) + le compte fondateur peut légitimement en ajouter plus.
- 13 assertions au total, toutes passées.

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

## Ce qui a été fait — Phase 4 (facturation Stripe, mode TEST)

- `supabase/migrations/20260731020000_phase4_stripe_billing.sql` : ajoute à `families`
  `stripe_customer_id` (index unique), `stripe_subscription_id`, `premium_interval`
  (`'monthly'`/`'annual'`). Aucune policy RLS d'écriture ajoutée (cohérent avec le reste de
  `families` : mutations serveur uniquement).
- `api/create-checkout-session.ts` : vérifie le JWT Supabase du parent (`supabase.auth.getUser`),
  retrouve sa famille via `family_members` (RLS), crée une session Stripe Checkout (mode
  `subscription`, `client_reference_id`/`metadata.family_id` = la famille) et renvoie l'URL —
  n'écrit RIEN dans `families` (c'est le webhook qui fait foi, une fois le paiement réellement
  confirmé par Stripe).
- `api/create-portal-session.ts` : même vérification, ouvre le portail de facturation Stripe
  (gérer moyen de paiement / annuler) pour la famille du parent courant.
- `api/stripe-webhook.ts` : **seule source de vérité** qui fait passer `families.plan`. Vérifie
  la signature Stripe (`stripe.webhooks.constructEvent`, corps brut — `bodyParser: false`),
  traite `checkout.session.completed` (premier paiement), `customer.subscription.updated`
  (renouvellement/changement) et `customer.subscription.deleted` (résiliation). **Ne touche
  jamais la famille fondatrice** (`.eq('is_founder', false)` sur les mises à jour venant d'un
  abonnement) — même si son `stripe_customer_id` était un jour lié par erreur à un test Stripe,
  son `plan` ne peut pas être rétrogradé par ce chemin.
- Garde-fou non-négociable répété dans les 3 fichiers : refuse de démarrer si
  `STRIPE_SECRET_KEY` ne commence pas par `sk_test_` — bloque toute clé live par erreur.
- Frontend : `src/lib/billing.ts` (`startCheckout`/`openBillingPortal`, appellent les
  endpoints ci-dessus puis redirigent vers l'URL Stripe hébergée renvoyée — le frontend ne
  connaît AUCUN secret Stripe et n'appelle jamais l'API Stripe directement),
  `src/store/premiumUpsellStore.ts` + `src/components/ui/PremiumUpsellModal.tsx` (un seul
  modal Premium, monté une fois dans `App.tsx`, déclenché par TOUS les points d'upsell —
  `PremiumGate`, `ChildrenPage`, `ShopPage`, `BadgeDefsPage`/`StreakDefsPage`/`RankDefsPage`,
  `AvatarEditorModal`, `SettingsPage` — plutôt que de dupliquer un flux de paiement partout).
  Pas de prix affiché dans le modal (volontaire : le vrai prix vient de Stripe, l'afficher
  ici risquerait de désynchroniser). `SettingsPage.tsx` : nouvelle carte "Premium" (statut +
  bouton "Gérer mon abonnement" si déjà abonné) et détection du retour de Checkout
  (`?premium=success`) qui relit le statut famille en boucle courte (5 tentatives, 1,5 s
  d'écart) le temps que le webhook ait pu traiter l'événement.

### Vérifié (sans compte Stripe réel — voir ce qui NE l'est PAS juste après)

La vérification de signature Stripe est un HMAC purement local (`stripe.webhooks.constructEvent`
ne fait AUCUN appel réseau à Stripe) : entièrement testable sans compte Stripe.

- Signature invalide/forgée → rejetée (400), sans toucher la base.
- `customer.subscription.updated` (signé avec un vrai HMAC de test, événement synthétique)
  avec `status: 'active'` → famille passée à `plan = 'premium'`, `stripe_subscription_id` et
  `premium_interval` correctement renseignés.
- `customer.subscription.deleted` → famille repassée à `plan = 'free'`,
  `stripe_subscription_id` vidé.
- **Famille fondatrice jamais touchée** : même test rejoué avec le `stripe_customer_id` de la
  famille fondatrice → son `plan` reste `'premium'` et ses colonnes Stripe restent vides,
  confirmant que la clause `is_founder = false` protège bien contre toute rétrogradation.
- Flux frontend (navigateur réel, requête réseau interceptée/mockée avec Playwright, comme
  pour les phases précédentes) : depuis une page gatée d'une famille gratuite, "Découvrir
  Premium" ouvre le modal, "Mensuel" envoie bien une requête `POST /api/create-checkout-session`
  authentifiée (JWT en en-tête) avec `{ interval: 'monthly' }`.

### PAS vérifié (nécessite un vrai compte Stripe test — hors de portée sans accès à ce compte)

- Le chemin `checkout.session.completed` appelle `stripe.subscriptions.retrieve()` (vrai appel
  réseau à l'API Stripe) pour connaître l'intervalle de l'abonnement — non testable sans
  connectivité Stripe réelle.
- Le vrai clic-à-clic complet (redirection vers la vraie page Stripe Checkout, paiement avec
  une carte de test, retour sur `/parent/reglages?premium=success`, réception réelle du
  webhook par Vercel) n'a pas pu être exécuté : nécessite un compte Stripe (test) que je n'ai
  pas et ne peux pas créer. **Julien doit faire ce test réel après déploiement** (carte de
  test Stripe `4242 4242 4242 4242`, n'importe quelle date future / CVC) pour confirmer le
  chemin complet — voir "Déploiement" ci-dessous pour la configuration préalable requise.

## Ce qui a été fait — Phase 5 (packs cosmétiques)

- `supabase/migrations/20260731030000_phase5_theme_packs.sql` : `theme_packs` (catalogue
  public — emojis + palette de couleurs par pack, `stripe_price_id` NULL tant qu'un prix
  Stripe réel n'a pas été créé et renseigné), `family_theme_packs` (packs achetés à l'unité
  par une famille), `families.active_theme_pack_id`. **Entièrement piloté par données** :
  ajouter un 6ᵉ pack ne demande aucun redéploiement, juste une ligne SQL. 5 packs seedés :
  Espace (gratuit/par défaut — mêmes emojis que la liste historique, pour ne pas invalider
  les avatars déjà choisis), Dinosaures, Pirates, Fées & licornes, Robots (payants, prix à
  renseigner par Julien).
- `has_theme_pack(family_id, pack_id)` : même schéma que `has_family_access()` — fondatrice
  ou premium = tous les packs inclus (vendus "à l'unité OU avec le premium", comme demandé),
  pack par défaut toujours débloqué, sinon vérifie un achat réel dans `family_theme_packs`.
- `set_active_theme_pack(pack_id)` (RPC) : change le pack actif d'une famille — vérifie
  lui-même l'accès via `has_theme_pack()`, ne fait jamais confiance au client.
- `api/create-pack-checkout-session.ts` : session Stripe Checkout en **paiement unique**
  (`mode: 'payment'`, pas un abonnement) pour un pack donné — le prix vient de
  `theme_packs.stripe_price_id` en base, pas d'un env var (cohérent avec "config
  extensible"). `api/stripe-webhook.ts` étendu : le même événement
  `checkout.session.completed` gère maintenant à la fois les abonnements Premium (phase 4,
  `mode: 'subscription'`) ET les achats de pack (`mode: 'payment'`) selon le mode de la
  session ; l'unlock est un upsert (rejouer le même événement webhook deux fois, ce que
  Stripe peut faire, ne duplique rien).
- Frontend : `src/lib/themePacks.ts` (catalogue, packs possédés, `isPackUnlocked()` — miroir
  synchrone de `has_theme_pack()`), `src/store/themePacksStore.ts` (chargé une fois la
  famille connue, voir `App.tsx`), nouvelle carte "Apparence" dans `SettingsPage.tsx`
  (liste des 5 packs, achat/sélection). `AvatarEditorModal.tsx` et les pickers
  d'avatar/couleur de `ChildrenPage.tsx` (création ET édition de profil) utilisent
  maintenant les emojis/couleurs du pack ACTIF de la famille plutôt que la liste fixe
  `AVATAR_EMOJIS`/`COLOR_PRESETS` (conservées comme repli en mode démo ou tant que le
  catalogue n'est pas encore chargé).

### Bug réel trouvé et corrigé en testant ce dernier maillon

En vérifiant en navigateur réel le retour de paiement (`?pack=success`), la sélection d'un
pack n'apparaissait jamais après l'"achat" simulé, alors même que la ligne existait bien en
base. Cause : l'effet de relecture (`useEffect`) relisait `window.location.search` à chaque
exécution pour décider s'il devait démarrer sa boucle de sondage — mais cet effet appelle
lui-même `setSearchParams()` pour nettoyer l'URL, ce qui modifie `window.location` ET
redéclenche l'effet (React StrictMode, actif en dev, réinvoque systématiquement les effects
une seconde fois) : la seconde invocation relisait alors une URL déjà nettoyée par la
première, et n'ouvrait donc jamais de boucle de sondage. Corrigé en capturant l'intention
("l'URL contenait-elle `?pack=success` ?") **une seule fois**, via un `useState` à
initialisation paresseuse, stable quel que soit le nombre de fois où l'effet est réinvoqué —
plutôt que de relire une valeur que l'effet modifie lui-même. Le même correctif a été
appliqué à l'effet équivalent de la phase 4 (`?premium=success`), qui avait exactement le
même défaut mais n'avait encore jamais été testé jusqu'au bout (seule la requête réseau
avait été vérifiée en phase 4, pas le retour complet). Revérifié après correction : 10/10
assertions passent, y compris le cycle complet achat → webhook simulé → affichage → sélection.

### Découverte annexe, hors périmètre (non corrigée)

En testant une famille toute neuve, la console affiche des échecs de synchronisation pour
`sync_badge_defs`/`sync_streak_defs`/`sync_rank_defs`/`sync_settings` ("invalid input syntax
for type uuid") : les identifiants par défaut de ces catalogues (`'debutant'`, `'main'`,
etc., dans `src/lib/ranks.ts`/`ts` associés) sont des chaînes lisibles, pas des UUID, alors
que ces colonnes sont typées `UUID` dans les migrations. Ce problème **préexiste à
GODCLAUDE** (présent dans `20260729020000_gamification_defs.sql`, jamais touché par ce
travail) et affecterait vraisemblablement aussi la famille de Julien en production de la
même façon pour ces catalogues précis (à vérifier — possible que ces tables aient été
créées avec un type différent directement en base, comme pour d'autres écarts déjà
documentés plus haut). Sans rapport avec l'isolation/la sécurité multi-familles ni avec les
phases 1-5 : signalé ici pour visibilité, pas corrigé (nécessiterait de choisir entre
changer le type de colonne ou régénérer ces identifiants, une décision produit qui dépasse
le périmètre de cette session).

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
   - `supabase/migrations/20260731000000_phase3_freemium_plan.sql`
   - `supabase/migrations/20260731010000_phase3_adjust_free_split.sql`
   - `supabase/migrations/20260731020000_phase4_stripe_billing.sql`
   - `supabase/migrations/20260731030000_phase5_theme_packs.sql`
2. **Immédiatement après**, récupérer les codes de rattachement de la famille fondatrice :
   ```sql
   SELECT label, code FROM family_claim_codes
   JOIN families ON families.id = family_claim_codes.family_id
   WHERE families.is_founder = true;
   ```
   Deux codes sont générés ("parent 1", "parent 2") — un pour Julien, un pour Marion si elle
   veut son propre compte. Chaque code est à usage unique (supprimé automatiquement une fois
   utilisé par `claim_founder_family`).
3. **Configurer Stripe (mode TEST — ne jamais activer le mode live ici)** avant de déployer,
   sinon les boutons "Découvrir Premium" échoueront (pas bloquant pour le reste de l'app) :
   - Dans le Dashboard Stripe, vérifier que le bouton "Test mode" est actif.
   - Créer un Produit "KidsUp Premium" avec deux Prix récurrents : mensuel et annuel. Noter
     leurs `price_id` (`price_...`).
   - Récupérer la clé secrète de test (`sk_test_...`) dans Développeurs → Clés API.
   - Créer un endpoint webhook (Développeurs → Webhooks) pointant vers
     `https://kids-up.vercel.app/api/stripe-webhook`, écoutant au minimum :
     `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`. Récupérer son secret de signature (`whsec_...`).
   - Sur Vercel (Project Settings → Environment Variables), ajouter : `STRIPE_SECRET_KEY`
     (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` (`whsec_...`), `STRIPE_PRICE_MONTHLY`
     (`price_...`), `STRIPE_PRICE_ANNUAL` (`price_...`).
   - **Packs cosmétiques (phase 5, optionnel — les packs restent affichés "Bientôt" tant que
     ceci n'est pas fait, rien ne casse)** : pour chaque pack payant à mettre en vente, créer
     un Produit + Prix (paiement unique, pas récurrent) dans Stripe test mode, puis :
     ```sql
     UPDATE theme_packs SET stripe_price_id = 'price_...' WHERE id = 'dinosaures';
     -- idem pour 'pirates', 'fees-licornes', 'robots'
     ```
     Le même endpoint webhook (étape précédente) gère aussi ces achats — rien à ajouter côté
     configuration webhook.
4. **Déployer le frontend** (`git push` sur `main`, déploiement Vercel automatique).
5. **Immédiatement après le déploiement**, sur kids-up.vercel.app : créer un compte
   (email + mot de passe, différent du PIN existant), choisir "J'ai un code", coller un des
   deux codes récupérés à l'étape 2. Le picker PIN habituel doit alors réapparaître avec
   Julien/Marion/Kelly/Hugo/Lorenzo/Kenzo exactement comme avant.
6. **Test réel du paiement** (le seul morceau de tout GODCLAUDE que je n'ai pas pu vérifier
   moi-même, faute de compte Stripe) : sur une famille de test (pas la famille fondatrice —
   elle a déjà tout, gratuitement, et n'a jamais besoin de payer), déclencher un upsell,
   choisir Mensuel ou Annuel, payer avec la carte de test Stripe `4242 4242 4242 4242`
   (n'importe quelle date d'expiration future, n'importe quel CVC à 3 chiffres), confirmer
   que le retour sur `/parent/reglages` affiche bien "Abonnement Premium actif" après
   quelques secondes.

Tant que l'étape 5 n'est pas faite, personne dans la famille ne peut utiliser l'app déployée
— à faire dans la foulée du déploiement, pas "plus tard dans la journée". L'étape 6 n'est pas
bloquante pour la famille de Julien (qui n'en a pas besoin) mais doit être faite avant
d'annoncer Premium à de vraies familles.

## Ce qui reste

Les 5 phases de GODCLAUDE sont maintenant implémentées et vérifiées (dans la limite de ce
qui est testable sans compte Stripe réel). Il ne reste que des actions manuelles, pas de
code :

- Exécuter les migrations en attente et configurer Stripe (voir "Déploiement" ci-dessus).
- Créer les Prix Stripe pour les packs cosmétiques et renseigner `stripe_price_id` (optionnel,
  n'importe quel moment après le déploiement — les packs sans prix restent affichés
  "Bientôt" sans rien casser).
- Faire le test réel de paiement (Premium et, si des prix de pack sont configurés, un achat
  de pack) une fois Stripe configuré — la seule vérification que je n'ai pas pu faire
  moi-même faute d'accès à un compte Stripe.
- Décider si les choix produit faits sans validation explicite de l'utilisateur (voir section
  dédiée en haut de ce document — quels verrous exacts, `MAX_FREE_CUSTOM`, prix non affichés
  dans l'app, etc.) conviennent tels quels ou doivent être ajustés.
- La question annexe hors périmètre découverte en phase 5 (identifiants non-UUID pour les
  catalogues de badges/séries/rangs/réglages par défaut — voir section Phase 5) mériterait
  d'être creusée séparément, sans urgence.
