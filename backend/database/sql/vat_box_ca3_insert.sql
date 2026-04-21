-- ============================================================
-- Insertion des cases CA3 dans vat_box_vbx (régime réel)
-- Formulaire DGFiP 3310-CA3-SD
--
-- Exécuter en une seule transaction.
-- Idempotent : supprime d'abord les lignes existantes du régime 'reel'.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM vat_box_vbx WHERE vbx_regime = 'reel';
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SECTION A — Montant des opérations réalisées
-- ============================================================
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Section A — Montant des opérations réalisées', NULL, NULL, 'reel', 1, NULL, NULL, 10);
SET @secA = LAST_INSERT_ID();

-- Sous-section : Opérations imposables
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Opérations imposables', NULL, @secA, 'reel', 1, NULL, NULL, 10);
SET @secA_imp = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('A1', 'Ventes, prestations de services',                                                                                              '0979', @secA_imp, 'reel', 0, NULL, NULL, 10),
('A2', 'Autres opérations imposables',                                                                                                 '0981', @secA_imp, 'reel', 0, NULL, NULL, 20),
('A3', "Achats de prestations de services réalisés auprès d'un assujetti non établi en France (article 283-2 du CGI)",                '0044', @secA_imp, 'reel', 0, NULL, NULL, 30),
('A4', 'Importations (autres que les produits pétroliers)',                                                                             '0056', @secA_imp, 'reel', 0, NULL, NULL, 40),
('A5', 'Sorties de régime fiscal suspensif (autres que les produits pétroliers)',                                                       '0051', @secA_imp, 'reel', 0, NULL, NULL, 50),
('B1', 'Mises à la consommation de produits pétroliers',                                                                               '0048', @secA_imp, 'reel', 0, NULL, NULL, 60),
('B2', 'Acquisitions intracommunautaires',                                                                                              '0031', @secA_imp, 'reel', 0, NULL, NULL, 70),
('B3', "Achats d'électricité, de gaz naturel, de chaleur ou de froid imposables en France",                                           '0030', @secA_imp, 'reel', 0, NULL, NULL, 80),
('B4', "Achats de biens ou de prestations de services réalisés auprès d'un assujetti non établi en France",                           '0040', @secA_imp, 'reel', 0, NULL, NULL, 90),
('B5', 'Régularisations (important : cf. notice)',                                                                                      '0036', @secA_imp, 'reel', 0, NULL, NULL, 100);

-- Sous-section : Opérations non imposables
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Opérations non imposables', NULL, @secA, 'reel', 1, NULL, NULL, 20);
SET @secA_nonimp = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('E1', 'Exportations hors UE',                                                                                                          '0032', @secA_nonimp, 'reel', 0, NULL, NULL, 10),
('E2', 'Autres opérations non imposables',                                                                                              '0033', @secA_nonimp, 'reel', 0, NULL, NULL, 20),
('E3', 'Ventes à distance taxables dans un autre État membre au profit des personnes non assujetties – Ventes B to C',                  '0047', @secA_nonimp, 'reel', 0, NULL, NULL, 30),
('E4', 'Importations (autres que les produits pétroliers)',                                                                              '0052', @secA_nonimp, 'reel', 0, NULL, NULL, 40),
('E5', 'Sorties de régime fiscal suspensif (autres que les produits pétroliers)',                                                        '0053', @secA_nonimp, 'reel', 0, NULL, NULL, 50),
('E6', 'Importations placées sous régime fiscal suspensif (autres que les produits pétroliers)',                                         '0054', @secA_nonimp, 'reel', 0, NULL, NULL, 60),
('F1', 'Acquisitions intracommunautaires',                                                                                               '0055', @secA_nonimp, 'reel', 0, NULL, NULL, 70),
('F2', "Livraisons intracommunautaires à destination d'une personne assujettie – Ventes B to B",                                       '0034', @secA_nonimp, 'reel', 0, NULL, NULL, 80),
('F3', "Livraisons d'électricité, de gaz naturel, de chaleur ou de froid non imposables en France",                                    '0029', @secA_nonimp, 'reel', 0, NULL, NULL, 90),
('F4', 'Mises à la consommation de produits pétroliers',                                                                                '0049', @secA_nonimp, 'reel', 0, NULL, NULL, 100),
('F5', 'Importations de produits pétroliers placées sous régime fiscal suspensif',                                                       '0050', @secA_nonimp, 'reel', 0, NULL, NULL, 110),
('F6', 'Achats en franchise',                                                                                                            '0037', @secA_nonimp, 'reel', 0, NULL, NULL, 120),
('F7', "Ventes de biens ou prestations de services réalisées par un assujetti non établi en France",                                   '0043', @secA_nonimp, 'reel', 0, NULL, NULL, 130),
('F8', 'Régularisations (important : cf. notice)',                                                                                       '0039', @secA_nonimp, 'reel', 0, NULL, NULL, 140),
('F9', "Opérations internes réalisées entre membres d'un assujetti unique",                                                             '0061', @secA_nonimp, 'reel', 0, NULL, NULL, 150);

-- ============================================================
-- SECTION B — Décompte de la TVA à payer
-- ============================================================
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Section B — Décompte de la TVA à payer', NULL, NULL, 'reel', 1, NULL, NULL, 20);
SET @secB = LAST_INSERT_ID();

-- TVA brute — taux courants
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'TVA brute — taux courants', NULL, @secB, 'reel', 1, NULL, NULL, 10);
SET @secB_std = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('08', 'Taux normal 20 %',   '0207', @secB_std, 'reel', 0, '[{"type":"prefix","value":"44571"}]', NULL, 10),
('09', 'Taux réduit 5,5 %',  '0105', @secB_std, 'reel', 0, '[{"type":"prefix","value":"44573"}]', NULL, 20),
('9B', 'Taux réduit 10 %',   '0151', @secB_std, 'reel', 0, '[{"type":"prefix","value":"44572"}]', NULL, 30);

-- Opérations réalisées dans les DOM
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Opérations réalisées dans les DOM', NULL, @secB, 'reel', 1, NULL, NULL, 20);
SET @secB_dom = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('10', 'Taux normal 8,5 %',  '0201', @secB_dom, 'reel', 0, '[{"type":"prefix","value":"44452"}]', NULL, 10),
('11', 'Taux réduit 2,1 %',  '0100', @secB_dom, 'reel', 0, NULL,                                 NULL, 20);

-- Opérations imposables à un taux particulier
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Opérations imposables à un taux particulier', NULL, @secB, 'reel', 1, NULL, NULL, 30);
SET @secB_tx = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('T1', 'Opérations réalisées dans les DOM et imposables au taux de 1,75 %',  '1120', @secB_tx, 'reel', 0, NULL, NULL, 10),
('T2', 'Opérations réalisées dans les DOM et imposables au taux de 1,05 %',  '1110', @secB_tx, 'reel', 0, NULL, NULL, 20),
('TC', 'Opérations réalisées en Corse et imposables au taux de 13 %',         '1090', @secB_tx, 'reel', 0, NULL, NULL, 30),
('T3', 'Opérations réalisées en Corse et imposables au taux de 10 %',         '1081', @secB_tx, 'reel', 0, NULL, NULL, 40),
('T4', 'Opérations réalisées en Corse et imposables au taux de 2,1 %',        '1050', @secB_tx, 'reel', 0, NULL, NULL, 50),
('T5', "Opérations réalisées en Corse et imposables au taux de 0,9 %",        '1040', @secB_tx, 'reel', 0, NULL, NULL, 60),
('T6', 'Opérations réalisées en France continentale au taux de 2,1 %',        '1010', @secB_tx, 'reel', 0, '[{"type":"prefix","value":"44574"}]', NULL, 70),
('T7', "Retenue de TVA sur droits d'auteur",                                   '0990', @secB_tx, 'reel', 0, NULL, NULL, 80),
('13', 'Anciens taux',                                                          '0900', @secB_tx, 'reel', 0, NULL, NULL, 90);

-- Produits pétroliers
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Produits pétroliers', NULL, @secB, 'reel', 1, NULL, NULL, 40);
SET @secB_pet = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('P1', 'Taux normal 20 %',  '0208', @secB_pet, 'reel', 0, NULL, NULL, 10),
('P2', 'Taux réduit 13 %',  '0152', @secB_pet, 'reel', 0, NULL, NULL, 20);

-- Importations
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Importations', NULL, @secB, 'reel', 1, NULL, NULL, 50);
SET @secB_imp = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('I1', 'Taux normal 20 %',   '0210', @secB_imp, 'reel', 0, '[{"type":"prefix","value":"44454"}]', NULL, 10),
('I2', 'Taux réduit 10 %',   '0211', @secB_imp, 'reel', 0, NULL, NULL, 20),
('I3', 'Taux réduit 8,5 %',  '0212', @secB_imp, 'reel', 0, NULL, NULL, 30),
('I4', 'Taux réduit 5,5 %',  '0213', @secB_imp, 'reel', 0, NULL, NULL, 40),
('I5', 'Taux réduit 2,1 %',  '0214', @secB_imp, 'reel', 0, NULL, NULL, 50),
('I6', 'Taux réduit 1,05 %', '0215', @secB_imp, 'reel', 0, NULL, NULL, 60);

-- Ajustements et totaux
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Ajustements et totaux', NULL, @secB, 'reel', 1, NULL, NULL, 60);
SET @secB_adj = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('15', 'TVA antérieurement déduite à reverser',                    '0600', @secB_adj, 'reel', 0, NULL, NULL, 10),
('5B', 'Sommes à ajouter, y compris acompte congés payés',         '0602', @secB_adj, 'reel', 0, NULL, NULL, 20),
('16', 'Total de la TVA brute due (lignes 08 à 5B)',               NULL,   @secB_adj, 'reel', 0, NULL, NULL, 30),
('17', 'Dont TVA sur acquisitions intracommunautaires',            '0035', @secB_adj, 'reel', 0, NULL, NULL, 40),
('18', 'Dont TVA sur opérations à destination de Monaco',          '0038', @secB_adj, 'reel', 0, NULL, NULL, 50);

-- ============================================================
-- TVA DÉDUCTIBLE
-- ============================================================
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'TVA déductible', NULL, NULL, 'reel', 1, NULL, NULL, 30);
SET @secC = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('19', 'Biens constituant des immobilisations',                                              '0703', @secC, 'reel', 0, '[{"type":"prefix","value":"44568"}]',                                    NULL, 10),
('20', 'Autres biens et services',                                                           '0702', @secC, 'reel', 0, '[{"type":"prefix","value":"44562"},{"type":"prefix","value":"44566"}]',  NULL, 20),
('21', 'Autre TVA à déduire',                                                                '0059', @secC, 'reel', 0, NULL, NULL, 30),
('22', 'Report du crédit apparaissant ligne 27 de la précédente déclaration',                '8001', @secC, 'reel', 0, NULL, NULL, 40),
('2C', 'Sommes à imputer, y compris acompte congés payés',                                   '0603', @secC, 'reel', 0, NULL, NULL, 50),
('24', "Dont TVA déductible sur importations hors produits pétroliers",                      '0710', @secC, 'reel', 0, NULL, NULL, 60),
('2E', 'Dont TVA déductible sur les produits pétroliers',                                    '0711', @secC, 'reel', 0, NULL, NULL, 70),
('23', 'Total TVA déductible (lignes 19 à 2C)',                                              NULL,   @secC, 'reel', 0, NULL, NULL, 80);

-- ============================================================
-- RÉSULTAT
-- ============================================================
INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order)
VALUES (NULL, 'Résultat', NULL, NULL, 'reel', 1, NULL, NULL, 40);
SET @secD = LAST_INSERT_ID();

INSERT INTO vat_box_vbx (vbx_code, vbx_label, vbx_edi_code, fk_vbx_id_parent, vbx_regime, vbx_is_title, vbx_default_accounts, vbx_accounts, vbx_order) VALUES
('25', 'Crédit de TVA (si ligne 23 > ligne 16)',                          '0705', @secD, 'reel', 0, NULL, NULL, 10),
('TD', 'TVA due (si ligne 16 > ligne 23)',                                '8900', @secD, 'reel', 0, NULL, NULL, 20),
('26', 'Remboursement de crédit de TVA demandé',                          '8002', @secD, 'reel', 0, NULL, NULL, 30),
('27', 'Crédit de TVA à reporter',                                        '8003', @secD, 'reel', 0, NULL, NULL, 40),
('28', 'TVA nette due',                                                   '8901', @secD, 'reel', 0, NULL, NULL, 50),
('29', "Taxes assimilées calculées sur l'annexe n° 3310 A",              '9979', @secD, 'reel', 0, NULL, NULL, 60),
('32', 'Total à payer',                                                   '9992', @secD, 'reel', 0, NULL, NULL, 70);

-- ============================================================
-- Vérification : afficher le nombre de lignes insérées
-- ============================================================
SELECT COUNT(*) AS lignes_inserees FROM vat_box_vbx WHERE vbx_regime = 'reel';
