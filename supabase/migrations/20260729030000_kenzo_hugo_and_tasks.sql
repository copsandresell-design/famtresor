-- ============================================================
-- FamTrésor — Nouveaux profils Kenzo (9 ans) et Hugo (5 ans) + leurs tâches
--
-- DÉJÀ APPLIQUÉ EN PRODUCTION (2026-07-30) directement via l'API REST
-- (clé anon, RLS "public all" déjà en place — même technique que les
-- migrations de données précédentes). Ce fichier reste dans le repo
-- comme référence/reproductible (ex : autre environnement) — il est
-- volontairement idempotent via des gardes "WHERE NOT EXISTS".
--
-- PIN par défaut (à changer dans Enfants — usesDefaultSecret: true) :
--   Kenzo : 3333        Hugo : 4444
-- Hash identique au mécanisme de l'app : sha256(`${salt}:${pin}`), salt =
-- un UUID v4 généré au moment de la création (voir src/lib/crypto.ts).
-- Les hashs ci-dessous ont donc été calculés par le script Python, pas
-- par ce fichier SQL (Postgres ne fait pas ce hash) — un rejeu de ce
-- fichier sur un autre environnement ne recréera PAS des comptes
-- utilisables avec ces mêmes PIN : il faudrait re-générer les hash.
-- Gardé ici pour la trace du barème de tâches, pas pour recréer les
-- comptes tel quel ailleurs.
-- ============================================================

-- 1) Comptes enfants (no-op si déjà présents).
INSERT INTO sync_users (id, data, updated_at)
SELECT '1cb7a996-9581-4f19-8c5e-dd0f36f4ee28'::uuid,
  jsonb_build_object(
    'id', '1cb7a996-9581-4f19-8c5e-dd0f36f4ee28',
    'role', 'child', 'name', 'Kenzo', 'avatar', '🦁', 'color', '#10B981',
    'usesDefaultSecret', true, 'isActive', true,
    'createdAt', extract(epoch from now()) * 1000
    -- secretHash/secretSalt omis ici : générés par le script (hash différent à chaque exécution).
  ), now()
WHERE NOT EXISTS (SELECT 1 FROM sync_users WHERE data->>'name' = 'Kenzo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sync_users (id, data, updated_at)
SELECT 'b2597ef8-c114-4334-9ad2-bdc73d5e70ad'::uuid,
  jsonb_build_object(
    'id', 'b2597ef8-c114-4334-9ad2-bdc73d5e70ad',
    'role', 'child', 'name', 'Hugo', 'avatar', '🐸', 'color', '#F97316',
    'usesDefaultSecret', true, 'isActive', true,
    'createdAt', extract(epoch from now()) * 1000
  ), now()
WHERE NOT EXISTS (SELECT 1 FROM sync_users WHERE data->>'name' = 'Hugo')
ON CONFLICT (id) DO NOTHING;

-- 2) Ajustements des tâches existantes pour porter les séries "brossage de dents"
--    et "chambre rangée" (voir demande : fréquence quotidienne, points baissés car
--    le vrai gain vient désormais du bonus de série).
UPDATE sync_tasks
SET data = data || jsonb_build_object('recurrence', jsonb_build_object('frequency', 'daily'), 'points', 10)
WHERE data->>'title' = 'Ranger sa chambre' AND data->'recurrence'->>'frequency' != 'daily';

UPDATE sync_tasks
SET data = jsonb_set(
  data, '{assignedTo}',
  (data->'assignedTo') || to_jsonb('1cb7a996-9581-4f19-8c5e-dd0f36f4ee28'::text)
)
WHERE data->>'title' = 'Débarrasser et essuyer la table'
  AND NOT (data->'assignedTo' ? '1cb7a996-9581-4f19-8c5e-dd0f36f4ee28');

-- 3) Nouvelle tâche commune : Se brosser les dents (quotidienne, 5 pts, ×2/jour max).
INSERT INTO sync_tasks (id, data, updated_at)
SELECT gen_random_uuid(),
  jsonb_build_object(
    'id', gen_random_uuid(), 'title', 'Se brosser les dents', 'points', 5,
    'category', 'autre', 'icon', '🦷', 'type', 'recurrente',
    'recurrence', jsonb_build_object('frequency', 'daily'), 'dailyLimit', 2,
    'assignedTo', jsonb_build_array(
      'ffb91644-88bc-4214-8ea8-ed955bf491d8', 'df07983a-a210-4507-aab5-d0abf3a1d4b9',
      '1cb7a996-9581-4f19-8c5e-dd0f36f4ee28', 'b2597ef8-c114-4334-9ad2-bdc73d5e70ad'
    ),
    'difficulty', 'easy', 'createdBy', '75f1b6fd-f3be-4309-882b-7b2cbdc1faf6',
    'createdAt', extract(epoch from now()) * 1000, 'isActive', true
  ), now()
WHERE NOT EXISTS (SELECT 1 FROM sync_tasks WHERE data->>'title' = 'Se brosser les dents');

-- 4) Tâches spécifiques à Hugo (5 ans).
INSERT INTO sync_tasks (id, data, updated_at)
SELECT gen_random_uuid(), jsonb_build_object(
  'id', gen_random_uuid(), 'title', v.title, 'points', v.points, 'category', v.category,
  'icon', v.icon, 'type', 'recurrente', 'recurrence', jsonb_build_object('frequency', 'daily'),
  'assignedTo', jsonb_build_array('b2597ef8-c114-4334-9ad2-bdc73d5e70ad'),
  'difficulty', 'easy', 'createdBy', '75f1b6fd-f3be-4309-882b-7b2cbdc1faf6',
  'createdAt', extract(epoch from now()) * 1000, 'isActive', true
), now()
FROM (VALUES
  ('Ranger ses jouets', 8, 'rangement', '🧸'),
  ('Mettre son pyjama tout seul', 6, 'autre', '👕'),
  ('Mettre son assiette dans l''évier', 6, 'cuisine', '🍽️')
) AS v(title, points, category, icon)
WHERE NOT EXISTS (SELECT 1 FROM sync_tasks WHERE data->>'title' = v.title);

-- 5) Tâches spécifiques à Kenzo (9 ans).
INSERT INTO sync_tasks (id, data, updated_at)
SELECT gen_random_uuid(), jsonb_build_object(
  'id', gen_random_uuid(), 'title', v.title, 'points', v.points, 'category', 'rangement',
  'icon', v.icon, 'type', 'recurrente', 'recurrence', jsonb_build_object('frequency', v.frequency),
  'assignedTo', jsonb_build_array('1cb7a996-9581-4f19-8c5e-dd0f36f4ee28'),
  'difficulty', 'easy', 'createdBy', '75f1b6fd-f3be-4309-882b-7b2cbdc1faf6',
  'createdAt', extract(epoch from now()) * 1000, 'isActive', true
), now()
FROM (VALUES
  ('Faire son lit', 12, '🛏️', 'daily'),
  ('Ranger son cartable', 10, '🎒', 'daily'),
  ('Ranger son bureau', 12, '🖊️', 'twice-weekly')
) AS v(title, points, icon, frequency)
WHERE NOT EXISTS (SELECT 1 FROM sync_tasks WHERE data->>'title' = v.title);

-- Vérification : Kenzo et Hugo doivent apparaître, actifs.
SELECT data->>'name' AS nom, data->>'role' AS role, data->>'avatar' AS avatar, data->>'isActive' AS actif
FROM sync_users WHERE data->>'name' IN ('Kenzo', 'Hugo');

-- Vérification : 10 tâches doivent référencer Kenzo ou Hugo dans assignedTo (7 nouvelles + 2 partagées + 1 étendue).
SELECT data->>'title' AS titre, data->>'points' AS points, data->'recurrence'->>'frequency' AS frequence
FROM sync_tasks
WHERE data->'assignedTo' ? '1cb7a996-9581-4f19-8c5e-dd0f36f4ee28'
   OR data->'assignedTo' ? 'b2597ef8-c114-4334-9ad2-bdc73d5e70ad'
ORDER BY titre;
