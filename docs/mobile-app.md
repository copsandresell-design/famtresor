# KidsUp en app native (iOS / Android) — scaffolding Capacitor

Ce document couvre uniquement le **scaffolding technique** déjà en place (voir plus bas) et ce
qu'il reste à faire **manuellement par Julien** pour publier une vraie app sur l'App Store et le
Play Store. Aucun compte développeur, aucune clé de signature, aucune soumission n'a été fait par
Claude — impossible sans les comptes personnels de Julien.

## Ce qui est déjà en place

- [Capacitor](https://capacitorjs.com/) enveloppe le build web existant (`vite build`) dans une
  vraie coquille native : le code React/Zustand/Supabase/Tailwind actuel n'a pas été réécrit, il
  tourne tel quel dans une WebView native sur iOS et Android.
- `capacitor.config.ts` : `appId: 'app.kidsup.mobile'`, `appName: 'KidsUp'`, `webDir: 'dist'`.
  **`appId` ne doit plus changer une fois publié** (c'est l'identifiant définitif de l'app dans
  les deux stores).
- Dossiers `ios/` et `android/` : deux vrais projets natifs (Xcode / Android Studio), committés
  dans le repo (ce ne sont pas des artefacts de build — seuls leurs sous-dossiers générés/
  dépendants de la machine sont ignorés, voir `.gitignore`).
- Icônes et écran de démarrage déjà générés pour les deux plateformes (voir `assets/` à la racine
  — dossier source pour `@capacitor/assets`, distinct de `public/` qui reste pour le web) à partir
  de `public/icons/icon-source.png` (icône de l'app) et `public/images/kidsup-logo.png` (logo
  centré sur fond `#0a0118` pour l'écran de démarrage natif, cohérent avec l'écran de chargement
  web actuel).
- Script `npm run build:mobile` (`vite build && npx cap sync`) : build le web puis synchronise
  vers les deux projets natifs. **Le script `npm run build` existant (utilisé par Vercel pour le
  déploiement web) n'a pas été touché** — la PWA continue de se déployer normalement,
  indépendamment de ce chantier mobile.
- Aucun plugin natif avancé branché (notifications push natives, biométrie, etc.) — volontairement
  laissé pour un chantier séparé une fois ce scaffolding de base validé.

## Regénérer les icônes/splash si le logo change

```bash
npx @capacitor/assets generate --ios --android \
  --iconBackgroundColor '#0a0118' --iconBackgroundColorDark '#0a0118' \
  --splashBackgroundColor '#0a0118' --splashBackgroundColorDark '#0a0118'
```

Important : toujours préciser `--ios --android` explicitement. Sans ces flags, l'outil essaie
*aussi* de générer des icônes PWA à partir du dossier `assets/` et écrit un
`public/manifest.webmanifest` qui **entre en conflit avec le manifest PWA déjà généré par
vite-plugin-pwa** (configuré dans `vite.config.ts`, à partir de données différentes) — repéré et
nettoyé pendant ce scaffolding, mais à éviter si regénéré plus tard.

Si le design change, remplacer les fichiers sources dans `assets/` :
- `assets/icon-only.png` (≥ 1024×1024, idéalement 1024×1024 pile)
- `assets/splash.png` + `assets/splash-dark.png` (≥ 2732×2732)

## Tester en local

```bash
npm run build:mobile
npx cap open ios       # ouvre Xcode
npx cap open android   # ouvre Android Studio
```

Dans Xcode/Android Studio : choisir un simulateur/émulateur (ou un vrai appareil branché), lancer
(▶). L'app doit s'ouvrir directement sur l'écran de connexion KidsUp.

**Vérifié dans cet environnement** : `xcodebuild -list` confirme que le projet Xcode généré
(`ios/App/App.xcodeproj`, scheme `App`) est valide et que les dépendances Swift Package Manager
(CapApp-SPM) se résolvent. Aucun simulateur iOS n'étant démarré ici, le lancement réel de l'app
(build + run sur simulateur) reste à faire par Julien, qui a Xcode sur son Mac. Côté Android,
aucun SDK Android (`ANDROID_HOME`) n'était configuré dans cet environnement — le projet est généré
et structurellement correct, mais n'a pas pu être compilé ; à vérifier via Android Studio (qui
installera le SDK au premier lancement s'il ne l'a pas déjà).

## Ce qu'il reste à faire pour publier réellement (manuel, par Julien)

### 1. Comptes développeur
- **Apple Developer Program** : 99 $/an, inscription sur [developer.apple.com](https://developer.apple.com/programs/enroll/).
  Nécessaire pour signer l'app et la soumettre à l'App Store (même pour un simple test TestFlight).
- **Google Play Console** : 25 $ *une fois*, inscription sur [play.google.com/console/signup](https://play.google.com/console/signup).

### 2. Icônes/métadonnées de store
- Screenshots de l'app pour chaque taille d'appareil requise (App Store : iPhone 6.7"/6.5",
  iPad si supporté ; Play Store : téléphone, tablette si supporté).
- Description courte/longue, mots-clés, catégorie (`Éducation` ou `Style de vie` conviennent
  probablement), classification d'âge/contenu (questionnaire IARC côté Google, questionnaire
  Apple côté App Store — app familiale, pas de contenu sensible).
- Politique de confidentialité accessible publiquement (obligatoire des deux côtés) — à rédiger,
  peut être une simple page statique décrivant les données collectées (comptes familiaux, PIN
  hashés, tâches/points — pas de données financières réelles, pas de publicité tierce).
- Icône 1024×1024 sans coins arrondis ni transparence pour l'App Store (déjà généré dans
  `assets/icon-only.png`, à vérifier/re-exporter proprement en RGB opaque si l'export actuel a un
  canal alpha).

### 3. Signature et soumission
- **iOS** : dans Xcode, sélectionner l'équipe de signature (liée au compte Apple Developer),
  choisir un identifiant de version/build, `Product → Archive`, puis distribuer via
  App Store Connect (TestFlight d'abord recommandé, avant la review publique).
- **Android** : dans Android Studio, générer un App Bundle signé (`Build → Generate Signed Bundle`),
  créer un keystore de signature (**à sauvegarder précieusement et en lieu sûr — sans lui,
  impossible de publier une mise à jour de l'app plus tard**), puis uploader le `.aab` dans la
  Play Console (piste de test interne d'abord recommandée).

### 4. Une fois en ligne
- Les mises à jour du code web (React) peuvent continuer à se déployer *instantanément* via
  Vercel comme aujourd'hui — la WebView charge le contenu à jour sans nouvelle soumission au
  store, TANT QUE `vite build` (le script `build` normal) suffit. Une nouvelle soumission au store
  n'est nécessaire que si le SHELL natif change (nouveau plugin natif, changement d'icône, etc.),
  pas pour une évolution normale de l'app.
