-- ============================================================
-- FamTrésor — Bascule tâches → points + catalogue boutique
--
-- DÉJÀ APPLIQUÉ EN PRODUCTION (2026-07-29) directement via l'API REST
-- (clé anon, RLS "public all" déjà en place — même privilège que l'appli
-- déployée) : les 16 tâches ont leurs points, les 12 lots sont dans
-- sync_shop_items. Vérifié ligne par ligne après coup. Ce fichier reste
-- dans le repo comme référence/reproductible (ex : autre environnement) —
-- il est volontairement idempotent, donc sans risque si quelqu'un le
-- rejoue dans le SQL Editor : les UPDATE sync_tasks sont des no-op une
-- fois 'amount' déjà absent, et l'INSERT des lots est gardé par une
-- vérification "catalogue vide" pour ne jamais dupliquer les 12 lots.
--
-- CHOIX IMPORTANT (voir résumé de session) : seules les 16 tâches existantes
-- sont converties (amount en centimes → points, barème donné). L'HISTORIQUE
-- des transactions déjà appliquées (sync_transactions, argent déjà gagné par
-- les enfants avant ce changement) N'EST PAS touché ni "reconverti" — il n'y
-- a pas de taux de change honnête entre l'ancien barème €/tâche et le nouveau
-- barème points/tâche, et rétroactivement retirer de l'argent déjà mérité
-- serait injuste. Seules les validations futures utiliseront des points
-- (déjà géré côté application, aucune action SQL requise pour ça).
-- ============================================================

-- 1) sync_tasks : amount (centimes) → points, par titre (titres uniques).
--    (data - 'amount') retire l'ancienne clé ; jsonb_build_object ajoute la nouvelle.
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 10)  WHERE data->>'title' = 'Vider le lave-vaisselle';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 10)  WHERE data->>'title' = 'Remplir le lave-vaisselle';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 10)  WHERE data->>'title' = 'Mettre la table';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 10)  WHERE data->>'title' = 'Débarrasser et essuyer la table';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 8)   WHERE data->>'title' = 'Ranger le canapé';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 8)   WHERE data->>'title' = 'Ranger chaussures et sac à l''entrée';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 20)  WHERE data->>'title' = 'Vider les poubelles';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 25)  WHERE data->>'title' = 'Ramasser le linge';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 30)  WHERE data->>'title' = 'Étendre le linge';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 35)  WHERE data->>'title' = 'Faire ses devoirs sans qu''on le demande';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 30)  WHERE data->>'title' = 'Réviser 15 minutes une leçon';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 45)  WHERE data->>'title' = 'Passer la pièce';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 55)  WHERE data->>'title' = 'Passer l''aspirateur';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 60)  WHERE data->>'title' = 'Ranger sa chambre';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 25)  WHERE data->>'title' = 'Arroser les plantes';
UPDATE sync_tasks SET data = (data - 'amount') || jsonb_build_object('points', 75)  WHERE data->>'title' = 'Aider à préparer le repas';

-- Vérification : les 16 lignes doivent maintenant avoir 'points' et ne plus avoir 'amount'.
SELECT data->>'title' AS titre, data->>'points' AS points, data ? 'amount' AS a_encore_amount
FROM sync_tasks
ORDER BY (data->>'points')::int;

-- 2) sync_shop_items : catalogue de départ (petites / moyennes / grosses récompenses).
--    Barème choisi pour qu'une grosse récompense prenne ~2 à 4 semaines à un enfant
--    sérieux sur ses tâches quotidiennes + hebdomadaires (voir résumé de session pour
--    le détail du calcul). Gardé par "catalogue vide" en plus de ON CONFLICT : n'insère
--    jamais une deuxième fois ces 12 lots si le parent en a déjà (ceux-ci ou d'autres).
INSERT INTO sync_shop_items (id, data, updated_at)
SELECT * FROM (VALUES
  ('a1a10000-0000-4000-8000-000000000001'::uuid, jsonb_build_object('id','a1a10000-0000-4000-8000-000000000001','title','Bonbon ou friandise au choix','icon','🎁','category','cadeau','cost',150,'status','active','createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000002', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000002','title','Dessert au choix après le repas','icon','🍦','category','resto','cost',180,'status','active','createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000003', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000003','title','30 min d''écran bonus','icon','📱','category','ecran','cost',200,'status','active','createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000004', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000004','title','30 min de jeu vidéo bonus','icon','🎮','category','jeu_video','cost',220,'status','active','createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000005', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000005','title','Petit cadeau surprise (- de 5€)','icon','🧸','category','cadeau','cost',250,'status','active','stock',10,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000006', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000006','title','Soirée ciné à la maison','icon','🎬','category','cinema','cost',450,'status','active','stock',3,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000007', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000007','title','Sortie au parc au choix','icon','🎡','category','sortie','cost',480,'status','active','stock',3,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000008', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000008','title','1h de jeu vidéo bonus','icon','🕹️','category','jeu_video','cost',500,'status','active','stock',2,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-000000000009', jsonb_build_object('id','a1a10000-0000-4000-8000-000000000009','title','Sortie bowling','icon','🎳','category','sortie','cost',550,'status','active','stock',2,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-00000000000a', jsonb_build_object('id','a1a10000-0000-4000-8000-00000000000a','title','Repas au McDo (ou fast-food au choix)','icon','🍔','category','resto','cost',900,'status','active','stock',1,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-00000000000b', jsonb_build_object('id','a1a10000-0000-4000-8000-00000000000b','title','Vraie sortie cinéma','icon','🎟️','category','cinema','cost',1100,'status','active','stock',1,'createdBy','system','createdAt', extract(epoch from now())*1000), now()),
  ('a1a10000-0000-4000-8000-00000000000c', jsonb_build_object('id','a1a10000-0000-4000-8000-00000000000c','title','Sortie au choix avec un parent','icon','🎢','category','sortie','cost',1400,'status','active','stock',1,'createdBy','system','createdAt', extract(epoch from now())*1000), now())
) AS v(id, data, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM sync_shop_items)
ON CONFLICT (id) DO NOTHING;

-- Vérification : 12 lots doivent apparaître, triés par coût.
SELECT data->>'title' AS titre, data->>'cost' AS cout_pts, data->>'stock' AS stock
FROM sync_shop_items
ORDER BY (data->>'cost')::int;
