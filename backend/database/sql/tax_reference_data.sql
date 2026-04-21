-- =============================================================================
-- DONNÉES DE RÉFÉRENCE TVA — SKSuite
-- =============================================================================
-- Ce fichier initialise les données de paramétrage fiscal français :
--   1. account_tax_tag_ttg         — Tags comptables TVA
--   2. account_tax_report_box_trb  — Cases des formulaires CA3 et CA12
--   3. account_tax_report_box_tag_rel_tbr — Relations tag → case
--
-- Idempotent : INSERT … ON DUPLICATE KEY UPDATE
-- Prérequis  : migration 2026_04_05_000001 exécutée (tables trb et tbr créées)
-- Usage      : mysql -u user -p database < backend/database/sql/tax_reference_data.sql
-- =============================================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- =============================================================================
-- 1. TAGS TVA — account_tax_tag_ttg
-- =============================================================================
-- Référence stable côté comptabilité. Ces codes ne changent jamais même si
-- les cases Cerfa évoluent. La correspondance tag→case est dans la table tbr.

INSERT INTO account_tax_tag_ttg (ttg_code, ttg_name, ttg_updated)
VALUES
    -- ── Bases HT opérations taxées (Cadre A) ─────────────────────────────
    -- FR_BASE_DOM_IMPOSABLE est conservé mais A1 sera calculé (formule) — ce tag
    -- peut servir pour A2 si configuré sur des LASM ou opérations spéciales.
    ('FR_BASE_AUTRES_IMPOSABLES',    'Base HT autres opérations imposables (case A2 — cessions immo, LASM)',  NOW()),
    ('FR_BASE_SERV_ART283_2',        'Base HT achats de services art. 283-2 CGI — autoliq. intra-UE (case A3)', NOW()),
    ('FR_BASE_ELEC_GAZ_TAXEES',      'Base HT livraisons élec/gaz naturel taxables (case A5)',               NOW()),
    ('FR_BASE_REGUL_TAXEES',         'Base HT régularisations — opérations taxées (case B5)',                 NOW()),

    -- ── Bases HT opérations non taxées (Cadre E/F) ───────────────────────
    ('FR_BASE_INTRACOM_LIV',         'Base HT livraisons intracommunautaires (case F2)',                      NOW()),
    ('FR_BASE_EXPORT',               'Base HT exportations et opérations assimilées (case E1)',               NOW()),
    ('FR_BASE_VENTES_DISTANCE_UE',   'Base HT ventes à distance taxables dans autre EM B2C (case E3)',        NOW()),
    ('FR_BASE_IMPORT_NON_TAX',       'Base HT importations (hors produits pétroliers) non taxées (case E4)', NOW()),
    ('FR_BASE_SORTIE_SUSPENSIF',     'Base HT sorties de régime fiscal suspensif (case E5)',                  NOW()),
    ('FR_BASE_IMPORT_SUSPENSIF',     'Base HT importations placées sous régime fiscal suspensif (case E6)',   NOW()),
    ('FR_BASE_ACQ_INTRACOM_NON_TAX', 'Base HT acquisitions intracommunautaires non taxées (case F1)',         NOW()),
    ('FR_BASE_ELEC_GAZ_NON_IMP',     'Base HT livraisons élec/gaz non imposables en France (case F3)',        NOW()),
    ('FR_BASE_PETROL_NON_TAX',       'Base HT produits pétroliers mis à consommation non taxés (case F4)',    NOW()),
    ('FR_BASE_PETROL_SUSPENSIF',     'Base HT importations pétroliers sous régime suspensif (case F5)',       NOW()),
    ('FR_BASE_FRANCHISE',            'Base HT achats en franchise (case F6)',                                 NOW()),
    ('FR_BASE_VENTES_ART283_1',      'Base HT ventes par assujetti non établi en France art. 283-1 (case F7)',NOW()),
    ('FR_BASE_REGUL_NON_TAX',        'Base HT régularisations — opérations non taxées (case F8)',             NOW()),
    ('FR_BASE_INTERNE_GROUPE_TVA',   'Base HT opérations internes membres assujetti unique (case F9)',        NOW()),

    -- ── TVA brute collectée — taux métropole ─────────────────────────────
    ('FR_TVA_COLL_20',               'TVA collectée 20 % — taux normal (case 08)',                            NOW()),
    ('FR_TVA_COLL_55',               'TVA collectée 5,5 % — taux réduit (case 09)',                           NOW()),
    ('FR_TVA_COLL_10',               'TVA collectée 10 % — taux réduit (case 9B)',                            NOW()),
    ('FR_TVA_COLL_21',               'TVA collectée 2,1 % — taux particulier métropole (case T6)',            NOW()),

    -- ── TVA brute collectée — DOM ─────────────────────────────────────────
    ('FR_TVA_COLL_85',               'TVA collectée 8,5 % — DOM taux normal (case 10)',                       NOW()),
    ('FR_TVA_COLL_21_DOM',           'TVA collectée 2,1 % — DOM taux réduit (case 11)',                       NOW()),
    ('FR_TVA_DOM_175',               'TVA collectée 1,75 % — DOM taux particulier (case T1)',                 NOW()),
    ('FR_TVA_DOM_105',               'TVA collectée 1,05 % — DOM taux mini (case T2)',                        NOW()),
    ('FR_TVA_DOM_13',                'TVA collectée 13 % — DOM Guadeloupe/Martinique/Réunion (case 13)',      NOW()),

    -- ── TVA brute collectée — Corse ──────────────────────────────────────
    ('FR_TVA_CORSE_13',              'TVA collectée 13 % — Corse (case TC)',                                  NOW()),
    ('FR_TVA_CORSE_10',              'TVA collectée 10 % — Corse taux réduit (case T3)',                      NOW()),
    ('FR_TVA_CORSE_21',              'TVA collectée 2,1 % — Corse taux particulier (case T4)',                NOW()),
    ('FR_TVA_CORSE_09',              'TVA collectée 0,9 % — Corse taux mini (case T5)',                       NOW()),

    -- ── TVA brute — autoliquidation / régimes spéciaux ───────────────────
    ('FR_TVA_AUTOLIQ_BTP',           'TVA autoliquidée BTP — sous-traitance (case T6)',                       NOW()),
    ('FR_TVA_RETENUE_AUTEUR',        'Retenue à la source — droits d\'auteur (case T7)',                      NOW()),

    -- ── TVA brute — produits pétroliers ──────────────────────────────────
    ('FR_TVA_PETROL_20',             'TVA produits pétroliers 20 % (case P1)',                                 NOW()),
    ('FR_TVA_PETROL_13',             'TVA produits pétroliers 13 % (case P2)',                                 NOW()),

    -- ── TVA brute — acquisitions intracommunautaires ─────────────────────
    ('FR_TVA_INTRACOM_COLL',         'TVA intracommunautaire autoliquidée 20 % (case I1)',                    NOW()),
    ('FR_TVA_INTRACOM_10',           'TVA intracommunautaire autoliquidée 10 % (case I2)',                    NOW()),
    ('FR_TVA_INTRACOM_55',           'TVA intracommunautaire autoliquidée 5,5 % (case I3)',                   NOW()),
    ('FR_TVA_INTRACOM_21',           'TVA intracommunautaire autoliquidée 2,1 % (case I4)',                   NOW()),
    ('FR_TVA_INTRACOM_85',           'TVA intracommunautaire autoliquidée 8,5 % (case I5)',                   NOW()),
    ('FR_TVA_INTRACOM_105',          'TVA intracommunautaire autoliquidée 1,05 % (case I6)',                  NOW()),

    -- ── TVA brute — régularisations ──────────────────────────────────────
    ('FR_TVA_REVERSAL',              'TVA antérieurement déduite à reverser (case 15)',                       NOW()),
    ('FR_TVA_AJOUT_5B',              'Sommes à ajouter TVA — acompte congés payés (case 5B)',                 NOW()),
    ('FR_TVA_MONACO',                'TVA sur opérations à destination de Monaco (case 18)',                  NOW()),

    -- ── TVA déductible ────────────────────────────────────────────────────
    ('FR_TVA_DED_IMM',               'TVA déductible immobilisations (case 19 / R3)',                         NOW()),
    ('FR_TVA_DED_SVC',               'TVA déductible autres biens et services — achats domestiques (case 20)',NOW()),
    ('FR_TVA_INTRACOM_DED',          'TVA déductible — acquisitions intracommunautaires (case 20 dont 2C)',   NOW()),
    ('FR_TVA_DED_IMPORT',            'TVA déductible — importations (case 20 dont 24)',                       NOW()),
    ('FR_TVA_DED_ABS',               'TVA déductible — autoliquidation BTP/intracom (case 20 dont 2E)',       NOW()),
    ('FR_TVA_AUTRES_DED',            'Autres TVA à déduire — hors 19 et 20 (case 21)',                        NOW()),

    -- ── Taxes assimilées ──────────────────────────────────────────────────
    ('FR_TAXES_ASSIMILEES',          'Taxes assimilées — Annexe 3310 A (case 29)',                            NOW()),

    -- ── Acomptes CA12 ─────────────────────────────────────────────────────
    ('FR_TVA_ACOMPTE_S1',            'Acompte TVA 1er semestre (CA12 — case R1)',                             NOW()),
    ('FR_TVA_ACOMPTE_S2',            'Acompte TVA 2ème semestre (CA12 — case R2)',                            NOW())

ON DUPLICATE KEY UPDATE
    ttg_name    = VALUES(ttg_name),
    ttg_updated = VALUES(ttg_updated);

-- =============================================================================
-- 2. CASES DU FORMULAIRE — account_tax_report_box_trb
-- =============================================================================
-- Ordre d'affichage conforme au Cerfa 3310-CA3-SD (notice DGFiP N° 50449#29)
-- Sections : OPÉRATIONS TAXÉES | OPÉRATIONS NON TAXÉES | TVA BRUTE | TVA DÉDUCTIBLE | SOLDE
--
-- Flags :
--   trb_has_base_ht : 1 = la case a une colonne Base HT
--   trb_has_tax_amt : 1 = la case a une colonne Montant TVA
--   trb_is_computed : 1 = valeur calculée par formule (trb_formula)
--   trb_is_editable : 1 = saisie manuelle par le déclarant
--
-- Formules JSON :
--   {"op":"sum","boxes":["08","09",...]}               → somme des tax_amount des cases listées
--   {"op":"sum","refs":[{"box":"08","col":"base_ht"}]} → somme avec colonne explicite
--   {"op":"max0diff","minuend":"16","subtrahend":"23"} → max(0, a-b)

-- ── CA3 — OPÉRATIONS TAXÉES (Cadre A) ────────────────────────────────────────
-- Notice : montants HT des opérations soumises à TVA
-- A1 : total ventes/prestations imposables constituant le CA (notice p.4 §A1)
--      = somme des bases HT des cases 08, 09, 9B, 10, 11, T1, T2, 13, TC, T3, T4, T5, T6, P1, P2
-- A2 : autres opérations imposables ne constituant pas le CA courant (cessions immo, LASM)
-- A3 : achats de prestations de services art.283-2 — autoliquidation intra-UE
-- A4 : acquisitions intracommunautaires taxables = somme bases I1..I6
-- A5 : livraisons élec/gaz naturel imposables (régimes réseau)
-- B5 : régularisations (rabais, avoirs) — montant HT uniquement

INSERT INTO account_tax_report_box_trb
    (trb_regime, trb_box, trb_label, trb_section, trb_order,
     trb_has_base_ht, trb_has_tax_amt, trb_is_computed, trb_is_editable, trb_formula, trb_dgfip_code)
VALUES
    -- A1 — calculé depuis les bases HT des cases de TVA brute collectée
    ('CA3', 'A1', 'Ventes et prestations de services imposables constituant le CA',
     'OPÉRATIONS TAXÉES', 10, 1, 0, 1, 0,
     '{"op":"sum","refs":['
     '{"box":"08","col":"base_ht"},'
     '{"box":"09","col":"base_ht"},'
     '{"box":"9B","col":"base_ht"},'
     '{"box":"10","col":"base_ht"},'
     '{"box":"11","col":"base_ht"},'
     '{"box":"T1","col":"base_ht"},'
     '{"box":"T2","col":"base_ht"},'
     '{"box":"13","col":"base_ht"},'
     '{"box":"TC","col":"base_ht"},'
     '{"box":"T3","col":"base_ht"},'
     '{"box":"T4","col":"base_ht"},'
     '{"box":"T5","col":"base_ht"},'
     '{"box":"T6","col":"base_ht"},'
     '{"box":"T7","col":"base_ht"},'
     '{"box":"P1","col":"base_ht"},'
     '{"box":"P2","col":"base_ht"}'
     ']}',
     NULL),

    -- A2 — base HT tag-based (cessions immo, livraisons à soi-même, art.257)
    ('CA3', 'A2', 'Autres opérations imposables (cessions immo, livraisons à soi-même)',
     'OPÉRATIONS TAXÉES', 20, 1, 0, 0, 0, NULL, NULL),

    -- A3 — base HT tag-based (autoliquidation intra-UE art.283-2)
    ('CA3', 'A3', 'Achats de prestations de services (art. 283-2 CGI) — autoliquidation',
     'OPÉRATIONS TAXÉES', 30, 1, 0, 0, 0, NULL, NULL),

    -- A4 — calculé depuis les bases I1..I6 (acquisitions intracom)
    ('CA3', 'A4', 'Acquisitions intracommunautaires taxables',
     'OPÉRATIONS TAXÉES', 40, 1, 0, 1, 0,
     '{"op":"sum","refs":['
     '{"box":"I1","col":"base_ht"},'
     '{"box":"I2","col":"base_ht"},'
     '{"box":"I3","col":"base_ht"},'
     '{"box":"I4","col":"base_ht"},'
     '{"box":"I5","col":"base_ht"},'
     '{"box":"I6","col":"base_ht"}'
     ']}',
     NULL),

    -- A5 — base HT tag-based (livraisons élec/gaz naturel imposables)
    ('CA3', 'A5', 'Livraisons de gaz naturel ou d\'électricité imposables',
     'OPÉRATIONS TAXÉES', 50, 1, 0, 0, 0, NULL, NULL),

    -- B5 — régularisations opérations taxées (base HT seulement)
    ('CA3', 'B5', 'Régularisations sur opérations taxées',
     'OPÉRATIONS TAXÉES', 70, 1, 0, 0, 0, NULL, NULL),

-- ── CA3 — OPÉRATIONS NON TAXÉES (Cadres E + F) ────────────────────────────────
-- Notice : montants HT constituant le CA mais exonérés ou hors champ TVA France

    ('CA3', 'E1', 'Exportations et opérations assimilées',
     'OPÉRATIONS NON TAXÉES', 90, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'E2', 'Autres opérations non imposables (livraisons suspensions, universalités…)',
     'OPÉRATIONS NON TAXÉES', 100, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'E3', 'Ventes à distance taxables dans un autre État membre (B to C)',
     'OPÉRATIONS NON TAXÉES', 105, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'E4', 'Importations non taxées (hors produits pétroliers)',
     'OPÉRATIONS NON TAXÉES', 112, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'E5', 'Sorties de régime fiscal suspensif (hors produits pétroliers)',
     'OPÉRATIONS NON TAXÉES', 115, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'E6', 'Importations placées sous régime fiscal suspensif',
     'OPÉRATIONS NON TAXÉES', 118, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F1', 'Acquisitions intracommunautaires non taxées',
     'OPÉRATIONS NON TAXÉES', 121, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F2', 'Livraisons intracommunautaires exonérées (BtoB)',
     'OPÉRATIONS NON TAXÉES', 123, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F3', 'Livraisons élec/gaz/chaleur non imposables en France',
     'OPÉRATIONS NON TAXÉES', 125, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F4', 'Mises à la consommation de produits pétroliers non taxées',
     'OPÉRATIONS NON TAXÉES', 132, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F5', 'Importations de produits pétroliers sous régime suspensif',
     'OPÉRATIONS NON TAXÉES', 135, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F6', 'Achats en franchise (art. 275 CGI)',
     'OPÉRATIONS NON TAXÉES', 138, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F7', 'Ventes par un assujetti non établi en France (art. 283-1)',
     'OPÉRATIONS NON TAXÉES', 142, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F8', 'Régularisations sur opérations non imposables',
     'OPÉRATIONS NON TAXÉES', 145, 1, 0, 0, 0, NULL, NULL),
    ('CA3', 'F9', 'Opérations internes entre membres d\'un assujetti unique',
     'OPÉRATIONS NON TAXÉES', 150, 1, 0, 0, 0, NULL, NULL),

-- ── CA3 — TVA BRUTE (Cadre B) ─────────────────────────────────────────────────
-- Cases à double colonne : Base HT + Montant TVA
-- Base HT calculée par inversion : base = tva / (taux/100)
-- Le moteur dérive automatiquement la base à partir du tag TVA et du taux tbr_tax_rate

    -- Métropole
    ('CA3', '08', 'Taux normal 20 %',
     'TVA BRUTE', 200, 1, 1, 0, 0, NULL, NULL),
    ('CA3', '09', 'Taux réduit 5,5 %',
     'TVA BRUTE', 210, 1, 1, 0, 0, NULL, NULL),
    ('CA3', '9B', 'Taux réduit 10 %',
     'TVA BRUTE', 220, 1, 1, 0, 0, NULL, NULL),

    -- DOM
    ('CA3', '10', 'DOM — Taux normal 8,5 %',
     'TVA BRUTE', 230, 1, 1, 0, 0, NULL, NULL),
    ('CA3', '11', 'DOM — Taux réduit 2,1 %',
     'TVA BRUTE', 235, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T1', 'DOM — Taux particulier 1,75 %',
     'TVA BRUTE', 240, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T2', 'DOM — Taux mini 1,05 %',
     'TVA BRUTE', 245, 1, 1, 0, 0, NULL, NULL),
    ('CA3', '13', 'DOM — Taux 13 % (Guadeloupe, Martinique, Réunion)',
     'TVA BRUTE', 250, 1, 1, 0, 0, NULL, NULL),

    -- Corse
    ('CA3', 'TC', 'Corse — Taux 13 %',
     'TVA BRUTE', 252, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T3', 'Corse — Taux réduit 10 %',
     'TVA BRUTE', 255, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T4', 'Corse — Taux particulier 2,1 %',
     'TVA BRUTE', 258, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T5', 'Corse — Taux mini 0,9 %',
     'TVA BRUTE', 261, 1, 1, 0, 0, NULL, NULL),

    -- Autoliquidation / régimes spéciaux
    ('CA3', 'T6', 'Autoliquidation — Sous-traitance BTP (art. 283-2 nonies)',
     'TVA BRUTE', 264, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'T7', 'Retenue à la source — Droits d\'auteur',
     'TVA BRUTE', 267, 0, 1, 0, 0, NULL, NULL),

    -- Produits pétroliers (TICPE)
    ('CA3', 'P1', 'Produits pétroliers — Taux 20 %',
     'TVA BRUTE', 270, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'P2', 'Produits pétroliers — Taux 13 % (Corse)',
     'TVA BRUTE', 273, 1, 1, 0, 0, NULL, NULL),

    -- Acquisitions intracommunautaires (autoliquidées)
    ('CA3', 'I1', 'Acquisitions intracommunautaires autoliquidées — 20 %',
     'TVA BRUTE', 276, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'I2', 'Acquisitions intracommunautaires autoliquidées — 10 %',
     'TVA BRUTE', 278, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'I3', 'Acquisitions intracommunautaires autoliquidées — 5,5 %',
     'TVA BRUTE', 280, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'I4', 'Acquisitions intracommunautaires autoliquidées — 2,1 %',
     'TVA BRUTE', 282, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'I5', 'Acquisitions intracommunautaires autoliquidées — 8,5 %',
     'TVA BRUTE', 284, 1, 1, 0, 0, NULL, NULL),
    ('CA3', 'I6', 'Acquisitions intracommunautaires autoliquidées — 1,05 %',
     'TVA BRUTE', 286, 1, 1, 0, 0, NULL, NULL),

    -- Régularisations TVA brute
    ('CA3', '15', 'TVA antérieurement déduite à reverser',
     'TVA BRUTE', 290, 0, 1, 0, 0, NULL, NULL),
    ('CA3', '18', 'Dont TVA sur opérations à destination de Monaco',
     'TVA BRUTE', 308, 0, 1, 0, 0, NULL, NULL),
    ('CA3', '5B', 'Sommes à ajouter (dont acompte congés payés)',
     'TVA BRUTE', 295, 0, 1, 0, 0, NULL, NULL),

    -- Totaux et sous-totaux calculés
    ('CA3', '16', 'Total de la TVA brute due',
     'TVA BRUTE', 300, 0, 1, 1, 0,
     '{"op":"sum","boxes":["08","09","9B","10","11","T1","T2","13","TC","T3","T4","T5","T6","T7","P1","P2","I1","I2","I3","I4","I5","I6","15","5B"]}',
     NULL),
    ('CA3', '17', 'Dont TVA sur acquisitions intracommunautaires',
     'TVA BRUTE', 305, 0, 1, 1, 0,
     '{"op":"sum","boxes":["I1","I2","I3","I4","I5","I6"]}',
     NULL),

-- ── CA3 — TVA DÉDUCTIBLE ──────────────────────────────────────────────────────
-- Notice p.9 : cases 19 (immo), 20 (autres biens/services), 21 (autres), 22 (crédit antérieur)

    -- 19 — Immobilisations : base HT pas affichée, montant TVA uniquement
    ('CA3', '19', 'Biens constituant des immobilisations',
     'TVA DÉDUCTIBLE', 320, 0, 1, 0, 0, NULL, NULL),

    -- 20 — Autres biens/services : montant TVA agrégé (plusieurs tags possibles)
    ('CA3', '20', 'Autres biens et services',
     'TVA DÉDUCTIBLE', 325, 0, 1, 0, 0, NULL, NULL),

    -- Sous-détails informatifs de case 20 (cases "dont")
    ('CA3', '2C', 'Dont TVA déductible — acquisitions intracommunautaires',
     'TVA DÉDUCTIBLE', 328, 0, 1, 0, 0, NULL, NULL),
    ('CA3', '24', 'Dont TVA déductible — importations',
     'TVA DÉDUCTIBLE', 330, 0, 1, 0, 0, NULL, NULL),
    ('CA3', '2E', 'Dont TVA déductible — autoliquidation',
     'TVA DÉDUCTIBLE', 332, 0, 1, 0, 0, NULL, NULL),

    -- 21 — Autres TVA à déduire (hors 19 et 20)
    ('CA3', '21', 'Autres TVA à déduire',
     'TVA DÉDUCTIBLE', 335, 0, 1, 0, 0, NULL, NULL),

    -- 22 — Report crédit antérieur (auto-rempli par le service depuis box 27 précédente)
    ('CA3', '22', 'Report du crédit apparaissant ligne 27 de la déclaration précédente',
     'TVA DÉDUCTIBLE', 338, 0, 1, 0, 1, NULL, NULL),

    -- 23 — Total TVA déductible (calculé)
    ('CA3', '23', 'Total TVA déductible',
     'TVA DÉDUCTIBLE', 340, 0, 1, 1, 0,
     '{"op":"sum","boxes":["19","20","21","22"]}',
     NULL),

-- ── CA3 — SOLDE ───────────────────────────────────────────────────────────────
-- Notice p.9-12

    -- TD — TVA due représentant fiscal (exceptionnel, saisie manuelle)
    ('CA3', 'TD', 'TVA due transmise par un représentant fiscal',
     'SOLDE', 345, 0, 1, 0, 1, NULL, NULL),

    -- 25 — TVA due (si 16 ≥ 23)
    ('CA3', '25', 'TVA due (si ligne 16 ≥ ligne 23)',
     'SOLDE', 350, 0, 1, 1, 0,
     '{"op":"max0diff","minuend":"16","subtrahend":"23"}',
     NULL),

    -- 27 — Crédit de TVA (si 23 > 16)
    ('CA3', '27', 'Crédit de TVA (si ligne 23 > ligne 16)',
     'SOLDE', 360, 0, 1, 1, 0,
     '{"op":"max0diff","minuend":"23","subtrahend":"16"}',
     NULL),

    -- 26 — Remboursement demandé (choix du déclarant)
    ('CA3', '26', 'Dont remboursement de crédit demandé (formulaire 3519)',
     'SOLDE', 365, 0, 1, 0, 1, NULL, NULL),

    -- AA — Transfert groupe TVA (exceptionnel)
    ('CA3', 'AA', 'Dont crédit de TVA transféré à la société tête de groupe',
     'SOLDE', 367, 0, 1, 0, 1, NULL, NULL),

    -- X5 — Crédit accise énergies (exceptionnel)
    ('CA3', 'X5', 'Dont crédit d\'accise sur les énergies imputé',
     'SOLDE', 368, 0, 1, 0, 1, NULL, NULL),

    -- 28 — TVA nette à payer (calculée)
    ('CA3', '28', 'TVA nette à payer (ligne 25 − ligne 26)',
     'SOLDE', 370, 0, 1, 1, 0,
     '{"op":"max0diff","minuend":"25","subtrahend":"26"}',
     NULL),

    -- 29 — Taxes assimilées Annexe 3310 A
    ('CA3', '29', 'Taxes assimilées (Annexe 3310 A)',
     'SOLDE', 375, 0, 1, 0, 0, NULL, NULL),

    -- AB — Paiement tête de groupe (exceptionnel)
    ('CA3', 'AB', 'Total à payer acquitté par la société tête de groupe',
     'SOLDE', 380, 0, 1, 0, 1, NULL, NULL),

-- ── CA12 — OPÉRATIONS RÉALISÉES ───────────────────────────────────────────────
    ('CA12', 'B1', 'Chiffre d\'affaires global (HT)',
     'OPÉRATIONS RÉALISÉES', 5, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'B2', 'Dont acquisitions intracommunautaires',
     'OPÉRATIONS RÉALISÉES', 8, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'B3', 'Dont importations',
     'OPÉRATIONS RÉALISÉES', 10, 1, 0, 0, 0, NULL, NULL),

-- ── CA12 — TVA COLLECTÉE DUE ──────────────────────────────────────────────────
-- Cases à double colonne base HT + TVA
    ('CA12', 'E1', 'Taux normal 20 % — Base HT',
     'TVA COLLECTÉE DUE', 10, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'E2', 'Taux normal 20 % — Montant TVA',
     'TVA COLLECTÉE DUE', 11, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'E3', 'Taux réduit 10 % — Base HT',
     'TVA COLLECTÉE DUE', 12, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'E4', 'Taux réduit 10 % — Montant TVA',
     'TVA COLLECTÉE DUE', 13, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'F2', 'Taux réduit 5,5 % — Base HT',
     'TVA COLLECTÉE DUE', 14, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'F4', 'Taux réduit 5,5 % — Montant TVA',
     'TVA COLLECTÉE DUE', 15, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'F8', 'Taux particulier 2,1 % — Base HT',
     'TVA COLLECTÉE DUE', 16, 1, 0, 0, 0, NULL, NULL),
    ('CA12', 'F6', 'Taux particulier 2,1 % — Montant TVA',
     'TVA COLLECTÉE DUE', 17, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'GH', 'Autoliquidation BTP + intra-UE — Montant TVA',
     'TVA COLLECTÉE DUE', 18, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'T1', 'Total TVA due (E2 + E4 + F4 + F6 + GH)',
     'TVA COLLECTÉE DUE', 20, 0, 1, 1, 0,
     '{"op":"sum","boxes":["E2","E4","F4","F6","GH"]}',
     NULL),

-- ── CA12 — TVA À DÉDUIRE ──────────────────────────────────────────────────────
    ('CA12', 'R1', 'Acompte 1er semestre versé',
     'TVA À DÉDUIRE', 30, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'R2', 'Acompte 2ème semestre versé',
     'TVA À DÉDUIRE', 35, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'R3', 'TVA déductible sur immobilisations',
     'TVA À DÉDUIRE', 40, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'R4', 'TVA déductible autres biens et services',
     'TVA À DÉDUIRE', 45, 0, 1, 0, 0, NULL, NULL),
    ('CA12', 'R5', 'Régularisations et crédit de TVA antérieur reporté',
     'TVA À DÉDUIRE', 50, 0, 1, 0, 1, NULL, NULL),
    ('CA12', 'T2', 'Total TVA à déduire (R1 + R2 + R3 + R4 + R5)',
     'TVA À DÉDUIRE', 55, 0, 1, 1, 0,
     '{"op":"sum","boxes":["R1","R2","R3","R4","R5"]}',
     NULL),

-- ── CA12 — SOLDE ──────────────────────────────────────────────────────────────
    ('CA12', 'T3', 'TVA nette à payer (si T1 > T2)',
     'SOLDE', 60, 0, 1, 1, 0,
     '{"op":"max0diff","minuend":"T1","subtrahend":"T2"}',
     NULL),
    ('CA12', 'T4', 'Crédit de TVA (si T2 > T1)',
     'SOLDE', 65, 0, 1, 1, 0,
     '{"op":"max0diff","minuend":"T2","subtrahend":"T1"}',
     NULL),
    ('CA12', 'T5', 'Dont remboursement de crédit demandé',
     'SOLDE', 70, 0, 1, 0, 1, NULL, NULL)

ON DUPLICATE KEY UPDATE
    trb_label       = VALUES(trb_label),
    trb_section     = VALUES(trb_section),
    trb_order       = VALUES(trb_order),
    trb_has_base_ht = VALUES(trb_has_base_ht),
    trb_has_tax_amt = VALUES(trb_has_tax_amt),
    trb_is_computed = VALUES(trb_is_computed),
    trb_is_editable = VALUES(trb_is_editable),
    trb_formula     = VALUES(trb_formula),
    trb_dgfip_code  = VALUES(trb_dgfip_code);

-- =============================================================================
-- 3. RELATIONS TAG → CASE — account_tax_report_box_tag_rel_tbr
-- =============================================================================
-- Insère les relations en résolvant les IDs par les codes et cases naturels.
-- Chaque ligne dit : "la colonne tbr_col du tag ttg_code contribue à la case trb_box".
-- tbr_sign  : +1 collecté (augmente la taxe due), -1 déductible (réduit la taxe due)
-- tbr_tax_rate : taux TVA — si renseigné, le moteur dérive la base HT par inversion

-- ── Suppression préalable des relations pour re-insertion propre ──────────────
DELETE tbr FROM account_tax_report_box_tag_rel_tbr tbr
INNER JOIN account_tax_report_box_trb trb ON trb.trb_id = tbr.fk_trb_id
WHERE trb.trb_regime IN ('CA3', 'CA12');

-- ── Macro d'insertion réutilisable ───────────────────────────────────────────
-- Syntaxe : INSERT SELECT résolvant les IDs depuis les codes naturels

-- ── CA3 — OPÉRATIONS TAXÉES : cases A2, A3, A5, B5 ──────────────────────────
-- (A1 et A4 sont calculées, elles n'ont pas de tag direct)

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_AUTRES_IMPOSABLES'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'A2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_SERV_ART283_2'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'A3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_ELEC_GAZ_TAXEES'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'A5';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_REGUL_TAXEES'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'B5';

-- ── CA3 — OPÉRATIONS NON TAXÉES ──────────────────────────────────────────────

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_EXPORT'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'E1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_VENTES_DISTANCE_UE'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'E3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_IMPORT_NON_TAX'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'E4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_SORTIE_SUSPENSIF'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'E5';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_IMPORT_SUSPENSIF'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'E6';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_ACQ_INTRACOM_NON_TAX'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_INTRACOM_LIV'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_ELEC_GAZ_NON_IMP'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_PETROL_NON_TAX'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_PETROL_SUSPENSIF'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F5';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_FRANCHISE'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F6';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_VENTES_ART283_1'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F7';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_REGUL_NON_TAX'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F8';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb
JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_INTERNE_GROUPE_TVA'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'F9';

-- ── CA3 — TVA BRUTE : cases 08 à I6 ──────────────────────────────────────────
-- tbr_col='tax_amount' + tbr_tax_rate renseigné → moteur déduit la base HT par inversion

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_20'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '08';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 5.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_55'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '09';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 10.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_10'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '9B';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 8.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_85'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '10';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 2.1
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_21_DOM'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '11';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 1.75
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DOM_175'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 1.05
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DOM_105'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 13.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DOM_13'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '13';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 13.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_CORSE_13'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'TC';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 10.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_CORSE_10'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 2.1
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_CORSE_21'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 0.9
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_CORSE_09'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T5';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_AUTOLIQ_BTP'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T6';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_RETENUE_AUTEUR'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'T7';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_PETROL_20'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'P1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 13.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_PETROL_13'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'P2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_COLL'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 10.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_10'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 5.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_55'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 2.1
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_21'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 8.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_85'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I5';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 1.05
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_105'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = 'I6';

-- Régularisations TVA brute
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_REVERSAL'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '15';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_MONACO'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '18';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_AJOUT_5B'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '5B';

-- ── CA3 — TVA DÉDUCTIBLE ──────────────────────────────────────────────────────

-- Case 19 — Immobilisations
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_IMM'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '19';

-- Case 20 — Autres biens/services (4 tags contribuent à la même case)
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_SVC'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '20';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_DED'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '20';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_IMPORT'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '20';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_ABS'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '20';

-- Sous-détails de case 20 (cases "dont" — même tags, cases différentes)
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_DED'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '2C';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_IMPORT'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '24';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_ABS'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '2E';

-- Case 21 — Autres TVA déductibles
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_AUTRES_DED'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '21';

-- Case 29 — Taxes assimilées
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TAXES_ASSIMILEES'
WHERE trb.trb_regime = 'CA3' AND trb.trb_box = '29';

-- ── CA12 — OPÉRATIONS RÉALISÉES ───────────────────────────────────────────────

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_DOM_IMPOSABLE'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'B1';

-- B1 n'a pas de tag universel unique pour le CA12 : FR_TVA_COLL_20 + d'autres contribuent.
-- Pour simplifier : on l'alimente depuis le total des tags collectés (base_ht).
-- Ajout des principaux tags collectés vers B1 (chiffre d'affaires global CA12)
INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_20'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'B1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_IMPORT_NON_TAX'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'B3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_BASE_ACQ_INTRACOM_NON_TAX'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'B2';

-- ── CA12 — TVA COLLECTÉE DUE ──────────────────────────────────────────────────

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_20'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'E1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_20'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'E2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, 10.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_10'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'E3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 10.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_10'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'E4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, 5.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_55'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'F2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 5.5
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_55'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'F4';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'base_ht', 1, 2.1
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_21'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'F8';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 2.1
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_COLL_21'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'F6';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_AUTOLIQ_BTP'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'GH';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', 1, 20.0
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_INTRACOM_COLL'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'GH';

-- ── CA12 — TVA À DÉDUIRE ──────────────────────────────────────────────────────

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_ACOMPTE_S1'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'R1';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_ACOMPTE_S2'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'R2';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_IMM'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'R3';

INSERT INTO account_tax_report_box_tag_rel_tbr (fk_trb_id, fk_ttg_id, tbr_col, tbr_sign, tbr_tax_rate)
SELECT trb.trb_id, ttg.ttg_id, 'tax_amount', -1, NULL
FROM account_tax_report_box_trb trb JOIN account_tax_tag_ttg ttg ON ttg.ttg_code = 'FR_TVA_DED_SVC'
WHERE trb.trb_regime = 'CA12' AND trb.trb_box = 'R4';

-- =============================================================================

SET foreign_key_checks = 1;

-- Fin du fichier tax_reference_data.sql
