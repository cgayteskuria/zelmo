-- =============================================================
-- initialize_db.sql
-- Généré  : 2026-04-20 12:43:45
-- NE PAS MODIFIER MANUELLEMENT — relancer generate_initialize_db.sh
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = '';

-- =============================================================
-- PARTIE 1 — TRUNCATE COMPLET DE TOUTES LES TABLES
-- =============================================================

-- Permissions & rôles
TRUNCATE TABLE `model_has_permissions`;
TRUNCATE TABLE `model_has_roles`;
TRUNCATE TABLE `role_has_permissions`;
TRUNCATE TABLE `permissions`;
TRUNCATE TABLE `roles`;
TRUNCATE TABLE `personal_access_tokens`;

-- Utilisateurs
TRUNCATE TABLE `user_usr`;

-- Partenaires & contacts
TRUNCATE TABLE `partner_ptr`;
TRUNCATE TABLE `contact_ctc`;
TRUNCATE TABLE `contact_partner_ctp`;
TRUNCATE TABLE `contact_device_ctd`;
TRUNCATE TABLE `bank_details_bts`;
TRUNCATE TABLE `device_dev`;

-- Produits & stocks
TRUNCATE TABLE `product_prt`;
TRUNCATE TABLE `product_stock_psk`;
TRUNCATE TABLE `product_commissioning_prc`;
TRUNCATE TABLE `stock_movement_stm`;
TRUNCATE TABLE `warehouse_whs`;

-- Ventes
TRUNCATE TABLE `sale_order_line_orl`;
TRUNCATE TABLE `sale_order_ord`;
TRUNCATE TABLE `sale_config_sco`;

-- Achats
TRUNCATE TABLE `purchase_order_line_pol`;
TRUNCATE TABLE `purchase_order_por`;
TRUNCATE TABLE `purchase_order_config_pco`;

-- Facturation
TRUNCATE TABLE `invoice_line_inl`;
TRUNCATE TABLE `invoice_inv`;
TRUNCATE TABLE `invoice_config_ico`;
TRUNCATE TABLE `payment_allocation_pal`;
TRUNCATE TABLE `payment_pay`;
TRUNCATE TABLE `payment_mode_pam`;

-- Contrats
TRUNCATE TABLE `contract_line_col`;
TRUNCATE TABLE `contract_invoice_coi`;
TRUNCATE TABLE `contract_con`;
TRUNCATE TABLE `contract_config_cco`;

-- Livraisons
TRUNCATE TABLE `delivery_note_line_dnl`;
TRUNCATE TABLE `delivery_note_dln`;

-- Comptabilité
TRUNCATE TABLE `account_transfer_atr`;
TRUNCATE TABLE `account_bank_reconciliation_abr`;
TRUNCATE TABLE `account_backup_aba`;
TRUNCATE TABLE `account_import_export_aie`;
TRUNCATE TABLE `account_exercise_aex`;
TRUNCATE TABLE `account_account_acc`;
TRUNCATE TABLE `account_config_aco`;
TRUNCATE TABLE `account_journal_ajl`;
TRUNCATE TABLE `account_move_amo`;
TRUNCATE TABLE `account_move_line_aml`;
TRUNCATE TABLE `account_tax_declaration_line_vdl`;
TRUNCATE TABLE `account_tax_declaration_vdc`;
TRUNCATE TABLE `account_tax_position_correspondence_tac`;
TRUNCATE TABLE `account_tax_position_tap`;
TRUNCATE TABLE `account_tax_repartition_line_tag_rel_rtr`;
TRUNCATE TABLE `account_tax_repartition_line_trl`;
TRUNCATE TABLE `account_tax_report_mapping_trm`;
TRUNCATE TABLE `account_tax_tag_ttg`;
TRUNCATE TABLE `account_tax_tax`;

-- Documents
TRUNCATE TABLE `document_doc`;
TRUNCATE TABLE `tr_signature_sig`;

-- Assistance
TRUNCATE TABLE `ticket_article_tka`;
TRUNCATE TABLE `ticket_tkt`;
TRUNCATE TABLE `ticket_config_tco`;
TRUNCATE TABLE `ticket_category_tkc`;
TRUNCATE TABLE `ticket_grade_tkg`;
TRUNCATE TABLE `ticket_priority_tkp`;
TRUNCATE TABLE `ticket_source_tks`;
TRUNCATE TABLE `ticket_status_tke`;
TRUNCATE TABLE `tr_ticketrecurrents_tkr`;

-- Notes de frais
TRUNCATE TABLE `expense_lines_exl`;
TRUNCATE TABLE `expense_reports_exr`;
TRUNCATE TABLE `expenses_exp`;
TRUNCATE TABLE `expense_categories_exc`;
TRUNCATE TABLE `expense_config_eco`;

-- Charges
TRUNCATE TABLE `charge_che`;
TRUNCATE TABLE `charge_type_cht`;

-- Séquences & configuration
TRUNCATE TABLE `sequence_seq`;
TRUNCATE TABLE `duration_dur`;

-- Messagerie & templates
TRUNCATE TABLE `message_mes`;
TRUNCATE TABLE `message_email_account_eml`;
TRUNCATE TABLE `message_template_emt`;

-- Entreprise
TRUNCATE TABLE `company_cop`;

-- Logs & tâches
TRUNCATE TABLE `logs_log`;
TRUNCATE TABLE `cron_task_cta`;

-- Prospect
TRUNCATE TABLE `prospect_activity_pac`;
TRUNCATE TABLE `prospect_opportunity_opp`;
TRUNCATE TABLE `prospect_pipeline_stage_pps`;
TRUNCATE TABLE `prospect_source_pso`;
TRUNCATE TABLE `prospect_lost_reason_plr`;

-- Barème kilométrique
TRUNCATE TABLE `mileage_scale_msc`;

-- Menu
TRUNCATE TABLE `menu_mnu`;
TRUNCATE TABLE `application_app`;


-- =============================================================
-- PARTIE 2 — RECHARGEMENT DES DONNÉES DE RÉFÉRENCE
-- =============================================================


-- ---------------------------------------------------------
-- Table : `user_usr` (2 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `user_usr` VALUES
(84,NULL,'2026-04-16 11:51:42',NULL,NULL,'admin@demo-company.fr','$2y$10$onJ1fIxt68/boiQjO0tMsOBjparw30WS9An34WT9gjzZWZEMEGL62','Admin','DEMO COMPANY','+33 (0)1 02 03 04 05','{\"supplier-invoices\":{\"sort_by\":\"inv_number\",\"sort_order\":\"DESC\",\"filters\":{\"inv_payment_progress\":[\"0\",\"partial\",\"100\"]},\"page_size\":50},\"charges\":{\"sort_by\":\"che_date\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"account-moves\":{\"sort_by\":\"amo_date\",\"sort_order\":\"DESC\",\"filters\":{\"amo_date_gte\":\"2024-06-01\",\"amo_date_lte\":\"2027-05-31T00:00:00.000000Z\"},\"page_size\":50},\"accounts\":{\"sort_by\":\"acc_code\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"account-lettering\":{\"acc_id\":374,\"date_start\":\"2025-06-01\",\"date_end\":\"2027-05-31\"},\"vat-declarations\":{\"sort_by\":\"vdc_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":25},\"users\":{\"sort_by\":\"usr_is_active\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"taxes\":{\"sort_by\":\"tax_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"tax-positions\":{\"sort_by\":\"tap_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"time-entries\":{\"sort_by\":\"ten_date\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"partners\":{\"sort_by\":\"ptr_name\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"devices\":{\"sort_by\":\"dev_hostname\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"contacts\":{\"sort_by\":\"ctc_firstname\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"suppliers\":{\"sort_by\":\"ptr_name\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"purchase-quotations\":{\"sort_by\":\"por_number\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"purchase-orders\":{\"sort_by\":\"por_number\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"products\":{\"sort_by\":\"id\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"accounting-closures\":{\"sort_by\":\"aex_closing_date\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":15},\"payment-modes\":{\"sort_by\":\"pam_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"customers\":{\"sort_by\":\"ptr_name\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"customer-invoices\":{\"sort_by\":\"inv_number\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"expense-categories\":{\"sort_by\":\"exc_name\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"sale-quotations\":{\"sort_by\":\"ord_number\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"durations\":{\"sort_by\":\"dur_order\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"customer-contracts\":{\"sort_by\":\"con_number\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"warehouses\":{\"sort_by\":\"whs_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"payments\":{\"sort_by\":\"pay_number\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"account-working\":{\"acc_id\":374,\"date_start\":\"2023-06-01\",\"date_end\":\"2027-05-31T00:00:00.000000Z\"},\"ticket-categories\":{\"sort_by\":\"tkc_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"ticket-grades\":{\"sort_by\":\"tkg_order\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"charge-types\":{\"sort_by\":\"cht_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"prospects\":{\"sort_by\":\"ptr_name\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"time-projects\":{\"sort_by\":\"tpr_lib\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"time-approval\":{\"sort_by\":\"ten_date\",\"sort_order\":\"DESC\",\"filters\":[],\"page_size\":50},\"message-email-accounts\":{\"sort_by\":\"eml_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50},\"message-templates\":{\"sort_by\":\"emt_label\",\"sort_order\":\"ASC\",\"filters\":[],\"page_size\":50}}','+33 (0)6 07 08 09 10','Administrateur','-2,46','108,46',1,NULL,1,1,1,319,NULL,NULL,0,NULL,0,NULL,NULL),
(3830,'2025-09-23 12:46:38','2026-02-24 15:25:35',84,NULL,'compta@capinetcomptable.fr','$2y$12$jOTeSeb8.DwUw58hw4GSn.YwZllo6kPuE0Z52gUvyYQC3MOEVMWJy','Expert','COMPTABLE',NULL,'a:7:{s:17:\"WorkingTableMoves\";a:2:{s:4:\"sidx\";s:0:\"\";s:4:\"sord\";s:4:\"desc\";}s:10:\"awkDetails\";a:3:{s:6:\"acc_id\";s:3:\"342\";s:14:\"aml_date_start\";s:10:\"2025-06-01\";s:12:\"aml_date_end\";s:10:\"2025-12-31\";}s:10:\"ablDetails\";a:5:{s:14:\"aml_date_start\";s:10:\"2025-06-01\";s:12:\"aml_date_end\";s:10:\"2025-10-31\";s:14:\"acc_code_start\";s:0:\"\";s:12:\"acc_code_end\";s:0:\"\";s:6:\"ajl_id\";s:0:\"\";}s:6:\"jqGabr\";a:2:{s:4:\"sidx\";s:0:\"\";s:4:\"sord\";s:3:\"asc\";}s:6:\"jqGamo\";a:4:{s:17:\"filter_date_start\";a:1:{s:5:\"value\";s:10:\"2024-06-01\";}s:15:\"filter_date_end\";a:1:{s:5:\"value\";s:10:\"2026-05-31\";}s:4:\"sidx\";s:0:\"\";s:4:\"sord\";s:3:\"asc\";}s:13:\"tableMoveLine\";a:2:{s:4:\"sidx\";s:0:\"\";s:4:\"sord\";s:3:\"asc\";}s:10:\"tableMoves\";a:3:{s:4:\"sidx\";s:26:\"class_code asc ,class_code\";s:4:\"sord\";s:3:\"asc\";s:7:\"filters\";s:70:\"{\"groupOp\":\"AND\",\"rules\":[{\"field\":\"acc_code\",\"op\":\"cn\",\"data\":\"44\"}]}\";}}',NULL,'Expert comptable',NULL,NULL,1,NULL,0,0,0,NULL,NULL,'2025-11-13 09:09:45',0,NULL,0,NULL,NULL);

-- ---------------------------------------------------------
-- Table : `sequence_seq` (19 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `sequence_seq` VALUES
(1,NULL,NULL,NULL,NULL,'Devis / Commade client','SO{yy}{0000@1}',0,'saleorder',NULL),
(2,NULL,NULL,NULL,NULL,'Commande fournisseur','CF{yy}{0000@1}',0,'purchaseorder',NULL),
(3,NULL,NULL,NULL,NULL,'Facture client','FC{yy}{0000@1}',0,'custinvoice',NULL),
(4,NULL,NULL,NULL,NULL,'Avoir client','AC{yy}{0000@1}',0,'custrefund',''),
(5,NULL,NULL,NULL,NULL,'Facture fournisseur','FF{yy}{0000@1}',0,'supplierinvoice',NULL),
(6,NULL,NULL,NULL,NULL,'Avoir fournisseur','AF{yy}{0000@1}',0,'supplierrefund',''),
(8,NULL,NULL,NULL,NULL,'Contrat client','CC{yy}{0000@1}',0,'custcontract',''),
(9,NULL,NULL,NULL,NULL,'Contrat fournisseur','SC{yy}{0000@1}',0,'suppliercontract',''),
(10,NULL,NULL,NULL,NULL,'Charge','CH{yy}{0000@1}',0,'charge',NULL),
(11,NULL,NULL,NULL,NULL,'Bon de livraison client','BL{yy}{0000@1}',0,'custdeliverynote',NULL),
(12,NULL,NULL,NULL,NULL,'Bon de livraison fournisseur','BR{yy}{0000@1}',0,'supplierdeliverynote',NULL),
(14,NULL,NULL,NULL,NULL,'Réglement fournisseur','RF{yy}{0000@1}',0,'supplierpayment',NULL),
(15,NULL,NULL,NULL,NULL,'Réglement client','RE{yy}{0000@1}',0,'custpayment',NULL),
(16,NULL,NULL,NULL,NULL,'Réglement charge','RH{yy}{0000@1}',0,'chargepayment',NULL),
(17,NULL,NULL,NULL,NULL,'Facture acompte client','FCA{yy}{0000@1}',0,'custdeposit',NULL),
(18,NULL,NULL,NULL,NULL,'Facture acompte fournisseur','FFA{yy}{0000@1}',0,'supplierdeposit',NULL),
(19,NULL,NULL,NULL,NULL,'Note de frais','NDF{yy}{0000@1}',0,'expensereport',NULL),
(20,NULL,NULL,NULL,NULL,'Réglement Note de frais','RN{yy}{0000@1}',0,'expensepayment',NULL),
(21,NULL,NULL,NULL,NULL,'Ticket assistance','TKT{yy}{0000@1}',0,'ticket',NULL);

-- ---------------------------------------------------------
-- Table : `roles` (2 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `roles` VALUES
(1,'Administrateur','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(2,'Comptable','sanctum','2026-02-24 15:25:18','2026-02-24 15:25:18');

-- ---------------------------------------------------------
-- Table : `role_has_permissions` (220 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `role_has_permissions` VALUES
(1,1),
(2,1),
(3,1),
(4,1),
(5,1),
(6,1),
(7,1),
(8,1),
(9,1),
(10,1),
(11,1),
(12,1),
(13,1),
(14,1),
(15,1),
(16,1),
(17,1),
(18,1),
(19,1),
(20,1),
(21,1),
(22,1),
(23,1),
(24,1),
(25,1),
(26,1),
(27,1),
(28,1),
(29,1),
(30,1),
(31,1),
(32,1),
(33,1),
(34,1),
(35,1),
(36,1),
(37,1),
(38,1),
(39,1),
(40,1),
(41,1),
(42,1),
(43,1),
(44,1),
(45,1),
(46,1),
(47,1),
(48,1),
(49,1),
(50,1),
(51,1),
(52,1),
(53,1),
(54,1),
(55,1),
(56,1),
(57,1),
(58,1),
(59,1),
(60,1),
(61,1),
(62,1),
(63,1),
(64,1),
(65,1),
(66,1),
(67,1),
(68,1),
(69,1),
(70,1),
(71,1),
(72,1),
(73,1),
(74,1),
(75,1),
(76,1),
(77,1),
(78,1),
(79,1),
(80,1),
(81,1),
(82,1),
(83,1),
(84,1),
(85,1),
(86,1),
(87,1),
(88,1),
(89,1),
(90,1),
(91,1),
(92,1),
(93,1),
(94,1),
(95,1),
(96,1),
(97,1),
(98,1),
(99,1),
(100,1),
(101,1),
(102,1),
(103,1),
(104,1),
(105,1),
(106,1),
(107,1),
(108,1),
(109,1),
(110,1),
(111,1),
(112,1),
(113,1),
(114,1),
(115,1),
(116,1),
(117,1),
(118,1),
(119,1),
(120,1),
(121,1),
(122,1),
(123,1),
(124,1),
(125,1),
(126,1),
(127,1),
(128,1),
(129,1),
(130,1),
(131,1),
(132,1),
(133,1),
(134,1),
(135,1),
(136,1),
(137,1),
(138,1),
(139,1),
(140,1),
(141,1),
(142,1),
(143,1),
(144,1),
(145,1),
(146,1),
(147,1),
(148,1),
(149,1),
(150,1),
(151,1),
(152,1),
(153,1),
(154,1),
(155,1),
(156,1),
(157,1),
(158,1),
(159,1),
(160,1),
(161,1),
(162,1),
(163,1),
(164,1),
(165,1),
(166,1),
(167,1),
(168,1),
(169,1),
(174,1),
(175,1),
(176,1),
(177,1),
(178,1),
(179,1),
(180,1),
(181,1),
(182,1),
(184,1),
(185,1),
(186,1),
(187,1),
(188,1),
(189,1),
(190,1),
(191,1),
(192,1),
(193,1),
(194,1),
(195,1),
(196,1),
(197,1),
(198,1),
(199,1),
(200,1),
(201,1),
(202,1),
(203,1),
(204,1),
(205,1),
(33,2),
(34,2),
(35,2),
(36,2),
(47,2),
(48,2),
(49,2),
(50,2),
(51,2),
(52,2),
(53,2),
(54,2),
(55,2),
(153,2),
(154,2),
(155,2),
(156,2),
(157,2),
(158,2),
(159,2);

-- ---------------------------------------------------------
-- Table : `permissions` (200 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `permissions` VALUES
(1,'partners.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(2,'partners.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(3,'partners.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(4,'partners.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(5,'products.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(6,'products.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(7,'products.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(8,'products.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(9,'stocks.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(10,'stocks.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(11,'stocks.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(12,'stocks.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(13,'sale-orders.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(14,'sale-orders.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(15,'sale-orders.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(16,'sale-orders.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(17,'contacts.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(18,'contacts.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(19,'contacts.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(20,'contacts.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(21,'devices.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(22,'devices.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(23,'devices.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(24,'devices.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(25,'users.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(26,'users.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(27,'users.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(28,'users.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(29,'settings.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(30,'settings.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(31,'settings.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(32,'settings.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(33,'accounting.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(34,'accounting.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(35,'accounting.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(36,'accounting.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(37,'menus.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(38,'menus.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(39,'menus.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(40,'menus.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(41,'documents.view','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(42,'documents.create','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(43,'documents.edit','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(44,'documents.delete','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(45,'sale-orders.validate','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(46,'sale-orders.print','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(47,'accounting.reconcile','sanctum','2026-01-27 09:04:08','2026-01-27 09:04:08'),
(48,'accountings.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(49,'accountings.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(50,'accountings.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(51,'accountings.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(52,'bank-details.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(53,'bank-details.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(54,'bank-details.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(55,'bank-details.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(56,'charges.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(57,'charges.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(58,'charges.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(59,'charges.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(60,'contracts.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(61,'contracts.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(62,'contracts.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(63,'contracts.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(64,'expenses.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(65,'expenses.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(66,'expenses.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(67,'expenses.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(68,'invoices.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(69,'invoices.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(70,'invoices.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(71,'invoices.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(72,'payments.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(73,'payments.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(74,'payments.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(75,'payments.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(76,'purchase-orders.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(77,'purchase-orders.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(78,'purchase-orders.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(79,'purchase-orders.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(80,'settings.roles.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(81,'settings.roles.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(82,'settings.roles.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(83,'settings.roles.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(84,'settings.taxs.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(85,'settings.taxs.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(86,'settings.taxs.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(87,'settings.taxs.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(88,'settings.charges.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(89,'settings.charges.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(90,'settings.charges.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(91,'settings.charges.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(92,'settings.company.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(93,'settings.company.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(94,'settings.company.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(95,'settings.company.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(96,'settings.messageemailaccounts.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(97,'settings.messageemailaccounts.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(98,'settings.messageemailaccounts.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(99,'settings.messageemailaccounts.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(100,'settings.messagetemplates.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(101,'settings.messagetemplates.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(102,'settings.messagetemplates.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(103,'settings.messagetemplates.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(104,'settings.purchaseorderconf.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(105,'settings.purchaseorderconf.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(106,'settings.purchaseorderconf.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(107,'settings.purchaseorderconf.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(108,'settings.saleorderconf.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(109,'settings.saleorderconf.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(110,'settings.saleorderconf.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(111,'settings.saleorderconf.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(112,'settings.invoiceconf.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(113,'settings.invoiceconf.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(114,'settings.invoiceconf.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(115,'settings.invoiceconf.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(116,'settings.contractconf.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(117,'settings.contractconf.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(118,'settings.contractconf.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(119,'settings.contractconf.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(120,'settings.ticketingconf.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(121,'settings.ticketingconf.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(122,'settings.ticketingconf.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(123,'settings.ticketingconf.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(124,'settings.stocks.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(125,'settings.stocks.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(126,'settings.stocks.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(127,'settings.stocks.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(128,'settings.expenses.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(129,'settings.expenses.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(130,'settings.expenses.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(131,'settings.expenses.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(132,'sale-orders.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(133,'sale-orders.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(134,'sale-orders.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(135,'purchase-orders.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(136,'purchase-orders.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(137,'purchase-orders.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(138,'invoices.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(139,'invoices.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(140,'invoices.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(141,'contracts.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(142,'contracts.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(143,'contracts.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(144,'delivery-notes.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(145,'delivery-notes.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(146,'delivery-notes.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(147,'partners.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(148,'partners.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(149,'partners.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(150,'charges.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(151,'charges.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(152,'charges.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(153,'accountings.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(154,'accountings.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(155,'accountings.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(156,'account-bank-reconciliations.documents.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(157,'account-bank-reconciliations.documents.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(158,'account-bank-reconciliations.documents.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(159,'accountings.restore','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(160,'expenses.approve','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(161,'expenses.approveall','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(162,'expenses.my.view','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(163,'expenses.my.create','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(164,'expenses.my.edit','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(165,'expenses.my.delete','sanctum','2026-01-27 09:07:56','2026-01-27 09:07:56'),
(166,'tickets.view','sanctum','2026-02-15 14:28:14','2026-02-15 14:28:14'),
(167,'tickets.create','sanctum','2026-02-15 14:28:14','2026-02-15 14:28:14'),
(168,'tickets.edit','sanctum','2026-02-15 14:28:14','2026-02-15 14:28:14'),
(169,'tickets.delete','sanctum','2026-02-15 14:28:14','2026-02-15 14:28:14'),
(174,'opportunities.view','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(175,'opportunities.create','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(176,'opportunities.edit','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(177,'opportunities.delete','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(178,'settings.prospectconf.view','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(179,'settings.prospectconf.create','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(180,'settings.prospectconf.edit','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(181,'settings.prospectconf.delete','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(182,'opportunities.view_all','sanctum','2026-02-17 14:52:16','2026-02-17 14:52:16'),
(184,'prospects.view','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(185,'prospects.create','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(186,'prospects.edit','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(187,'prospects.delete','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(188,'suppliers.view','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(189,'suppliers.create','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(190,'suppliers.edit','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(191,'suppliers.delete','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(192,'customers.view','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(193,'customers.create','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(194,'customers.edit','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(195,'customers.delete','sanctum','2026-02-17 15:17:04','2026-02-17 15:17:04'),
(196,'time.view','sanctum',NULL,NULL),
(197,'time.view.all','sanctum',NULL,NULL),
(198,'time.create','sanctum',NULL,NULL),
(199,'time.edit','sanctum',NULL,NULL),
(200,'time.approve','sanctum',NULL,NULL),
(201,'time.invoice','sanctum',NULL,NULL),
(202,'time.projects.view','sanctum',NULL,NULL),
(203,'time.projects.edit','sanctum',NULL,NULL),
(204,'prospect-activities.view_all','sanctum','2026-03-23 18:42:25','2026-03-23 18:42:25'),
(205,'time.delete','sanctum','2026-03-25 10:27:30','2026-03-25 10:27:30');

-- ---------------------------------------------------------
-- Table : `model_has_roles` (2 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `model_has_roles` VALUES
(1,'App\\Models\\UserModel',84),
(1,'App\\Models\\UserModel',3830);

-- ---------------------------------------------------------
-- Table : `model_has_permissions` (0 ligne(s))
-- ---------------------------------------------------------
-- (table vide)

-- ---------------------------------------------------------
-- Table : `mileage_scale_msc` (54 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `mileage_scale_msc` VALUES
(1,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','<=3',0,5000,0.5290,0.00,1,NULL,NULL),
(2,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','<=3',5001,20000,0.3160,1065.00,1,NULL,NULL),
(3,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','<=3',20001,NULL,0.3700,0.00,1,NULL,NULL),
(4,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','4',0,5000,0.6060,0.00,1,NULL,NULL),
(5,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','4',5001,20000,0.3400,1330.00,1,NULL,NULL),
(6,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','4',20001,NULL,0.4070,0.00,1,NULL,NULL),
(7,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','5',0,5000,0.6360,0.00,1,NULL,NULL),
(8,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','5',5001,20000,0.3570,1395.00,1,NULL,NULL),
(9,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','5',20001,NULL,0.4270,0.00,1,NULL,NULL),
(10,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','6',0,5000,0.6650,0.00,1,NULL,NULL),
(11,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','6',5001,20000,0.3740,1457.00,1,NULL,NULL),
(12,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','6',20001,NULL,0.4470,0.00,1,NULL,NULL),
(13,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','>=7',0,5000,0.6970,0.00,1,NULL,NULL),
(14,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','>=7',5001,20000,0.3940,1515.00,1,NULL,NULL),
(15,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'car','>=7',20001,NULL,0.4700,0.00,1,NULL,NULL),
(16,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','1-2',0,3000,0.3950,0.00,1,NULL,NULL),
(17,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','1-2',3001,6000,0.0990,891.00,1,NULL,NULL),
(18,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','1-2',6001,NULL,0.2480,0.00,1,NULL,NULL),
(19,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','3-5',0,3000,0.4680,0.00,1,NULL,NULL),
(20,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','3-5',3001,6000,0.0820,1158.00,1,NULL,NULL),
(21,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','3-5',6001,NULL,0.2750,0.00,1,NULL,NULL),
(22,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','>5',0,3000,0.6060,0.00,1,NULL,NULL),
(23,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','>5',3001,6000,0.0790,1583.00,1,NULL,NULL),
(24,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'motorcycle','>5',6001,NULL,0.3430,0.00,1,NULL,NULL),
(25,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'moped','<=50cc',0,3000,0.3150,0.00,1,NULL,NULL),
(26,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'moped','<=50cc',3001,6000,0.0790,711.00,1,NULL,NULL),
(27,'2026-02-15 15:29:11','2026-02-15 15:29:11',2025,'moped','<=50cc',6001,NULL,0.1980,0.00,1,NULL,NULL),
(28,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','<=3',0,5000,0.5290,0.00,1,84,84),
(29,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','<=3',5001,20000,0.3160,1065.00,1,84,84),
(30,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','<=3',20001,NULL,0.3700,0.00,1,84,84),
(31,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','4',0,5000,0.6060,0.00,1,84,84),
(32,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','4',5001,20000,0.3400,1330.00,1,84,84),
(33,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','4',20001,NULL,0.4070,0.00,1,84,84),
(34,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','5',0,5000,0.6360,0.00,1,84,84),
(35,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','5',5001,20000,0.3570,1395.00,1,84,84),
(36,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','5',20001,NULL,0.4270,0.00,1,84,84),
(37,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','6',0,5000,0.6650,0.00,1,84,84),
(38,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','6',5001,20000,0.3740,1457.00,1,84,84),
(39,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','6',20001,NULL,0.4470,0.00,1,84,84),
(40,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','>=7',0,5000,0.6970,0.00,1,84,84),
(41,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','>=7',5001,20000,0.3940,1515.00,1,84,84),
(42,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'car','>=7',20001,NULL,0.4700,0.00,1,84,84),
(43,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','1-2',0,3000,0.3950,0.00,1,84,84),
(44,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','1-2',3001,6000,0.0990,891.00,1,84,84),
(45,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','1-2',6001,NULL,0.2480,0.00,1,84,84),
(46,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','3-5',0,3000,0.4680,0.00,1,84,84),
(47,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','3-5',3001,6000,0.0820,1158.00,1,84,84),
(48,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','3-5',6001,NULL,0.2750,0.00,1,84,84),
(49,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','>5',0,3000,0.6060,0.00,1,84,84),
(50,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','>5',3001,6000,0.0790,1583.00,1,84,84),
(51,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'motorcycle','>5',6001,NULL,0.3430,0.00,1,84,84),
(52,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'moped','<=50cc',0,3000,0.3150,0.00,1,84,84),
(53,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'moped','<=50cc',3001,6000,0.0790,711.00,1,84,84),
(54,'2026-02-15 16:24:17','2026-02-15 16:24:17',2026,'moped','<=50cc',6001,NULL,0.1980,0.00,1,84,84);

-- ---------------------------------------------------------
-- Table : `message_template_emt` (20 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `message_template_emt` VALUES
(1,NULL,'2025-06-19 15:44:46',NULL,84,'Nouveau Token de validation de bon de commande','Votre nouveau lien de validation','<p>Bonjour,</p><p>Pour confirmer votre demande et valider le bon de commande, il vous suffit de cliquer sur le lien suivant : ##validationurl##&nbsp;</p><p>Nous vous remercions de nouveau pour la confiance que vous nous accordez. L\'équipe xxxxdd5</p>','ticket_reply'),
(2,NULL,'2025-06-19 15:46:05',NULL,84,'Alerte commercial lors de la validation d&amp;amp;','Nouvelle commande validée','<p>Bonjour,</p>\r\n\r\nLe bon de commande n°##ord_number## viens être validé:\r\nVous pouvez consulter le bon de commande via url :\r\n##saleOrderUrl##\r\n\r\nUnolink\r\n','ticket_reply'),
(4,NULL,'2025-06-19 15:56:52',NULL,84,'Confirmation de commande','Confirmation de commande','<p>Bonjour,</p>\r\n\r\nMeric pour votre commande.\r\nVous trouverez ci joint votre bon de commande signés\r\n\r\nl\'éuipe Unolink\r\n','ticket_reply'),
(5,NULL,'2025-12-04 12:25:58',NULL,84,'Réponse à un dossier','##tkt_label## - TrackingID##tkt_id##','<p><span style=\"color:#ffffff;\">##mail_parser##</span></p><figure class=\"table\"><table style=\"background-color:#ffffff;width:100%;\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"padding:0 40px 0px 40px;\"><p style=\"margin:0 0 15px 0;\">##last_answer.tka_message##</p></td></tr><tr><td style=\"padding:30px 40px;\"><figure class=\"table\"><table cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"color:#0f172a;font-size:14px;line-height:1.6;\"><p><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>##cop_label##</strong></span></span><br><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>##last_answer.answerer_displayname##&nbsp;</strong></span></span><br><span style=\"font-size:15px;\"><strong>##last_answer.answerer_jobtitle##</strong></span></p><p>##cop_address## – ##cop_zip## ##cop_city##<br>##cop_phone##<br>&nbsp;</p></td></tr></tbody></table></figure></td></tr><tr><td style=\"background-color:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;padding:20px 40px 20px 40px;width:100%;\"><p style=\"color:#64748b;font-size:13px;letter-spacing:0.5px;margin:0;text-transform:uppercase;\"><strong>Rappel de votre demande&nbsp;</strong></p><p>Sujet : ##tkt_label##&nbsp;<br>Demande du : ##tkt_opendate##&nbsp;<br>Assigné à : ##tech_assigned_displayname##</p></td></tr><tr><td style=\"background-color:#0f172a;padding:20px 40px;text-align:center;width:100%;\">Pour toute question, répondez directement à cet email.</td></tr></tbody></table></figure>','system'),
(6,NULL,NULL,NULL,NULL,'A-Création compte Drive','Votre compte Drive','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p><span style=\"color:black;\"><i>Votre compte drive est maintenant actif.&nbsp;</i></span><br><span style=\"color:black;\"><i>Vous recevrez, par email, dans quelques minutes, vos identifiants de connexion ; Si tel n’est pas le cas n’hésitez pas à nous contacter.</i></span></p><p><span style=\"color:black;\"><i>En cas de perte de votre mot passe il vous est possible de le réinitialiser via l’adresse</i></span></p><p><a href=\"https://app.demo-company.fr/forgot-password\"><span style=\"color:black;\"><i>https://app.demo-company.fr/forgot-password</i></span></a></p><p><span style=\"color:black;\"><i>Cet espace vous permet d’accéder en toute sécurité à vos données au travers de votre explorateur Windows (Finder pour les utilisateurs Mac).</i></span></p><p><span style=\"color:black;\"><i>Vous trouverez ci joint les procédures vous permettant d’installer l’outil sur votre ordinateur et de vous connecter aux données.</i></span><br><span style=\"color:black;\"><i>Il vous permet également d’accéder à vos fichiers via l’interface Web, </i></span><a href=\"https://app.demo-company.fr/\"><span style=\"color:black;\"><i>https://app.demo-company.fr/</i></span></a></p><p><span style=\"color:black;\"><i>Notre support reste à votre disposition&nbsp;:</i></span></p><ul><li><span style=\"color:black;\"><i>&nbsp;&nbsp; Par email sur </i></span><a href=\"mailto:support@demo-company.fr\"><span style=\"color:black;\"><i>support@demo-company.fr</i></span></a></li><li><span style=\"color:black;\"><i>&nbsp;&nbsp; &nbsp;En cas d’urgence au 01 02 03 04 05</i></span></li></ul><p><span style=\"color:black;\"><i>N’hésitez pas à nous contacter en cas de difficulté de connexion ou d’utilisation.</i></span><br><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(7,NULL,NULL,NULL,NULL,'A-Indication de mot de passe','Réinitialisation mot de passe','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p><span style=\"color:black;\"><i>Vous trouverez ci-dessous les identifiants de connexion à votre compte :</i></span></p><ul><li><span style=\"background-color:yellow;\"><i>Identifiant :&nbsp;</i></span></li><li><span style=\"background-color:yellow;\"><i>Mot de passe :</i></span></li></ul><p><span style=\"color:black;\"><i>Ces identifiants sont utilisés pour [Indiquer l\'utilité du compte]</i></span><br><br><span style=\"color:black;\"><i>A votre service</i></span></p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>','ticket_reply'),
(8,NULL,NULL,NULL,NULL,'4-Clôture sans retour utilisateur','Fermeture de votre demande','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p><br><span style=\"color:black;\"><i>Nous avons tenté de vous joindre plusieurs fois ces derniers jours sans succès.</i></span><br><span style=\"color:black;\"><i>En l\'absence de retour de votre part nous supposons que l\'incident est résolu et votre ticket sera fermé prochainement.</i></span></p><p><span style=\"color:black;\"><i>Si malheureusement ce n\'était pas le cas nous restons à votre disposition au 01 02 03 04 05 ou en réponse à ce mail.</i></span><br><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(10,NULL,'2025-12-04 15:26:58',NULL,84,'Dossier : Attribution ','Attribution du dossier ##tkt_id##','<p><span style=\"color:#ffffff;\">##mail_parser##</span></p><figure class=\"table\"><table style=\"background-color:#ffffff;width:100%;\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"padding:0 40px 0px 40px;\"><p style=\"margin:0 0 15px 0;\">Bonjour <strong>##tech_assigned_displayname##</strong>,</p><p style=\"margin:0 0 15px 0;\">Le dossier ##tkt_id## vous à été attribué.<br>Vous pouvez consulter ce dernier via l\'url : <a href=\"##ticketUrl##\">##tkt_id##</a></p><p>Ou copiez ce lien dans votre navigateur :</p><p style=\"background-color:#f5f5f5;font-size:12px;padding:10px;\"><a href=\"##ticketUrl##\">##ticketUrl##</a></p><p>&nbsp;</p></td></tr><tr><td style=\"background-color:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;padding:20px 40px 20px 40px;width:100%;\"><p style=\"color:#64748b;font-size:13px;letter-spacing:0.5px;margin:0;text-transform:uppercase;\"><strong>Rappel du dossier</strong></p><p>Sujet : ##tkt_label##&nbsp;<br>Demande du : ##tkt_opendate##&nbsp;<br>Demande initiale : ##request.tka_message##</p></td></tr><tr><td style=\"padding:30px 40px;\"><figure class=\"table\"><table cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"color:#0f172a;font-size:14px;line-height:1.6;\"><p><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>##cop_label##</strong></span></span><br><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>##curentuser.firstname##&nbsp;##curentuser.lastname##</strong></span></span><br><span style=\"font-size:15px;\"><strong>##curentuser.jobtitle##</strong></span></p><p>##cop_address## – ##cop_zip## ##cop_city##<br>##cop_phone##<br>&nbsp;</p></td></tr></tbody></table></figure></td></tr><tr><td style=\"background-color:#0f172a;padding:20px 40px;text-align:center;width:100%;\">Pour toute question, répondez directement à cet email.</td></tr></tbody></table></figure>','system'),
(12,NULL,NULL,NULL,NULL,'A-Envoi de matériel','Envoi de materiel','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p><span style=\"color:black;\"><i>Un colis a été confié à UPS à votre attention.</i></span><br><span style=\"color:black;\"><i>Ce dernier est composé de [x] Colis comprenant :</i></span><br><span style=\"color:black;\"><i>- [Lister le matériel]</i></span></p><p><span style=\"color:black;\"><i>Pouvez-vous nous valider la bonne réception du matériel. (01 02 03 04 05)</i></span></p><p><span style=\"color:black;\"><i>Vous trouverez ci-dessous le lien de suivi UPS :</i></span><br><a href=\"https://www.ups.com/track?loc=fr\\\\_FR&amp;tracknum=[SUIVIUPS]&amp;requester=ST&amp;fromrecent=1\"><span style=\"color:black;\"><i>https://www.ups.com/track?loc=fr\\\\_FR&amp;tracknum=[SUIVIUPS]&amp;requester=ST&amp;fromrecent=1</i></span></a><br><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(13,NULL,'2025-12-04 12:26:37',NULL,84,'Accusé de réception de demande','##tkt_label## - TrackingID##tkt_id##','<p><span style=\"color:#ffffff;\">##mail_parser##</span></p><figure class=\"table\"><table style=\"background-color:#ffffff;width:100%;\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"padding:0 40px 0px 40px;\"><p style=\"margin:0 0 15px 0;\">Bonjour <strong>##ctc_opener_displayname##</strong>,</p><p style=\"margin:0 0 15px 0;\">Nous avons bien reçu votre demande et un membre de notre équipe support vous répondra dans les plus brefs délais.<br>Vous pouvez répondre directement à cet email pour ajouter des informations complémentaires à votre ticket.</p><p style=\"margin:0 0 15px 0;\"><strong>Votre demande </strong>(Numéro de dossier : ##tkt_id##)</p></td></tr><tr><td style=\"background-color:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;padding:10px 40px 10px 40px;width:100%;\">##request.tka_message##</td></tr><tr><td style=\"padding:30px 40px;\"><figure class=\"table\"><table cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"color:#0f172a;font-size:14px;line-height:1.6;\"><p><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>##cop_label##</strong></span></span><br><span style=\"color:#C30079;\"><span style=\"font-size:15px;\"><strong>L\'équipe Support&nbsp;</strong></span></span></p><p>##cop_address## – ##cop_zip## ##cop_city##<br>##cop_phone##<br>&nbsp;</p></td></tr></tbody></table></figure></td></tr><tr><td style=\"background-color:#0f172a;padding:20px 40px;text-align:center;width:100%;\">Pour toute question, répondez directement à cet email.</td></tr></tbody></table></figure>','system'),
(15,NULL,NULL,NULL,NULL,'5-Demande de validation','Demande de validation','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p><span style=\"color:black;\"><i>La demande ci-dessous nécessite votre validation pour être traitée.&nbsp;</i></span></p><p><span style=\"color:black;\"><i>Pourriez-vous nous indiquer par mail si vous souhaitez ou non que nous traitions cette demande ?&nbsp;</i></span></p><p><span style=\"color:black;\"><i>Dans l\'attente de votre retour,</i></span><br><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(17,NULL,NULL,NULL,NULL,'1-Ouverture de ticket par téléphone','Ouverture de ticket par téléphone',' <p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span><br><span style=\"color:black;\"><i> </i></span><br><span style=\"color:black;\"><i>Je vous remercie d’avoir contacter le support Demo Company.</i></span></p><p><span style=\"color:black;\"><i>Vous trouverez ci-dessous le résumé de votre demande :</i></span></p><p><span style=\"background-color:yellow;color:black;\"><i>[Descriptif de la demande]</i></span></p><p><span style=\"color:black;\"><i>Votre demande est prise en charge et nous allons revenir vers vous dans les meilleurs délais.</i></span></p><p><span style=\"color:black;\"><i>Pour toute question ou complément d’information, je vous remercie de répondre exclusivement à cet émail ou de nous contacter au 01 02 03 04 05.</i></span></p><p><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(18,NULL,NULL,NULL,NULL,'3-Client non joignable','3-Client non joignable','<p><span style=\"color:black;\"><i>Bonjour </i></span><span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span><span style=\"color:black;\"><i>&nbsp;</i></span><br><i>&nbsp;</i><br><span style=\"color:black;\"><i>Cet email fait suite à votre demande d’assistance. Nous avons tenté de vous joindre sans y parvenir. Cet échange est indispensable pour nous permettre de solutionner votre demande.</i></span></p><p><span style=\"color:black;\"><i>Pourriez-vous me recontacter au 01 02 03 04 05 ?</i></span></p><p><i>A défaut, n’hésitez pas à nous faire part de vos disponibilités.</i><br><br><span style=\"color:black;\"><i>A votre service</i></span><br>&nbsp;</p>','ticket_reply'),
(19,NULL,NULL,NULL,NULL,'2-Clôture de ticket','2-Clôture de ticket','<p>Bonjour <span style=\"background-color:yellow;color:black;\"><i>[Madame/Monsieur]</i></span></p><p>Je vous remercie pour votre disponibilité et votre collaboration.&nbsp;</p><p>Comme convenu ensemble, cette demande d\'assistance est désormais résolue.</p><p>Si toutefois vous rencontriez de nouvelles difficultés liées à cette demande, je vous remercie de répondre à cet email ou de nous recontacter au <span style=\"color:black;\"><i>01 02 03 04 05 </i></span>dans les 48 heures.<br><br><span style=\"color:black;\"><i>A votre service</i></span></p>','ticket_reply'),
(22,NULL,NULL,NULL,NULL,'Envoi Bon de commande au Client','Votre bon de commande ','Sans VAlidation','ticket_reply'),
(25,NULL,NULL,NULL,NULL,'Envoi Bon de commande au Client pour vlaidation de','Votre bon de commande ','<p>Bonjour,</p>\r\n\r\nPour confirmer votre demande et valider le bon de commande, il vous suffit de cliquer sur le lien suivant :\r\n<p>##validation_url##</p>\r\n<p><a href=\"##validation_url##\">Validez votre commande</a></p>\r\n\r\ndans le cas ou le lien ne foncitonnerai pas copier l\'url ci dessou dans votre navigateur :\r\n##validation_url##\r\nNous vous remercions de nouveau pour la confiance que vous nous accordez.\r\n\r\nL\'équipe xxxx\r\n','ticket_reply'),
(26,NULL,NULL,NULL,NULL,'Envoi contrat Client','Votre bon de commande ','<p>Bonjour,</p>\r\n\r\nPour confirmer votre demande et valider le bon de commande, il vous suffit de cliquer sur le lien suivant :\r\nhttps://www.demo-company.fr/validate-order?token=XXXX\r\n\r\nNous vous remercions de nouveau pour la confiance que vous nous accordez.\r\n\r\nL\'équipe xxxx\r\n','ticket_reply'),
(27,NULL,'2025-11-10 16:58:53',NULL,84,'Réinitialisation de mot de passe','Réinitialisation de mot de passe','<figure class=\"table\"><table style=\"border-radius:8px;border:1px solid #e0e0e0;font-family:Arial, sans-serif;margin:0 auto;padding:20px;\" cellpadding=\"20\" cellspacing=\"0\"><tbody><tr><td><p>Bonjour <strong>##userName##</strong>,</p><p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte Zelmo.</p><p>Pour définir un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p><figure class=\"table\"><table style=\"margin:25px 0;width:100%;\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"text-align:center;\"><a style=\"background-color:#0066cc;border-radius:5px;color:#ffffff;display:inline-block;padding:12px 30px;text-decoration:none;\" href=\"##resetUrl##\"><strong>Réinitialiser mon mot de passe&nbsp;</strong></a></td></tr></tbody></table></figure><p>Ou copiez ce lien dans votre navigateur :</p><p style=\"background-color:#f5f5f5;border-left:3px solid #0066cc;font-size:12px;padding:10px;\"><a href=\"##resetUrl##\">##resetUrl##</a></p><figure class=\"table\"><table style=\"background-color:#FEE6FE;border-left:4px solid #E000E0;margin:20px 0;width:100%;\" cellpadding=\"15\" cellspacing=\"0\"><tbody><tr><td><p style=\"margin:0;\"><strong>Important :</strong>&nbsp;</p><p style=\"margin:0;\">• Ce lien est valable pendant <strong>1 heure</strong></p><p style=\"margin:0;\">• Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email</p><p style=\"margin:0;\">• Ne partagez jamais ce lien avec qui que ce soit</p></td></tr></tbody></table></figure><p style=\"color:#666666;font-size:12px;\">&nbsp;</p><figure class=\"table\"><table style=\"margin-top:20px;width:100%;\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr><td style=\"text-align:center;\"><p>Cet email a été envoyé automatiquement, merci de ne pas y répondre. <img style=\"margin-bottom:10px;max-width:150px;\" src=\"https://votre-domaine.com/assets/images/logo.png\" alt=\"Zelmo\"></p><p style=\"color:#999999;font-size:12px;margin:0;\">&nbsp;</p></td></tr></tbody></table></figure></td></tr></tbody></table></figure>','system'),
(28,'2025-11-07 15:45:56','2025-11-10 17:00:45',84,84,'Accusé de changement de mot de passe','Votre mot de passe a été modifié','...votre_html_password_success...','system'),
(30,'2026-03-25 10:27:29','2026-03-25 10:27:29',NULL,NULL,'Alerte TVA — Échéance à venir','Déclaration TVA — Échéance dans {vat_days_remaining} jour(s)','<p>Bonjour,</p><p>Nous vous rappelons que la déclaration TVA pour la période <strong>{vat_period}</strong> doit être déposée avant le <strong>{vat_deadline}</strong>.</p><p>Il vous reste <strong>{vat_days_remaining} jour(s)</strong> pour effectuer cette déclaration.</p><p>Connectez-vous à votre espace comptable pour accéder à la déclaration.</p><br><p>Cordialement,<br><strong>{company_name}</strong></p>','system');


REPLACE INTO `application_app` VALUES (1, 'Assistance', 'assistance', 'assistance.png', '#534AB7', 'Gestion des tickets support, SLA, base de connaissances et canaux de communication client.', 1, 'tickets.view', '/tickets', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (2, 'CRM', 'crm', 'crm.png', '#0F6E56', 'Gestion des contacts, opportunités, pipeline de vente, relances et historique client.', 2, 'partners.view|opportunities.view|contacts.view', '/partners', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (3, 'Vente', 'vente', 'vente.png', '#185FA5', 'Devis, commandes clients, bons de livraison, catalogue produits et pipeline commercial.', 4, 'sale-orders.view|invoices.view', '/customers', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (4, 'Achat', 'achats', 'achat.png', '#854F0B', 'Commandes fournisseurs, bons de commande, réception et gestion des fournisseurs.', 3, 'purchase-orders.view', '/suppliers', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (5, 'Stock', 'stock', 'stock.png', '#3B6D11', 'Gestion des stocks, mouvements, valorisation et alertes de réapprovisionnement.', 5, 'stocks.view|products.view', '/stocks', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (6, 'Comptabilité', 'comptabilite', 'comptabilite.png', '#A32D2D', 'Factures, paiements, grand-livre, rapports financiers, TVA et clôtures comptables.', 6, 'accountings.view', '/account-moves', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (7, 'RH', 'rh', 'rh.png', '#993556', 'Employés, congés, paie, recrutement, organigramme et suivi des performances.', 7, 'expenses.my.view|expenses.approve', '/my-expense-reports', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (8, 'Paramétrage', 'parametrage', 'administration.png', '#5F5E5A', NULL, 99, 'users.view|settings.view', '/users', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (9, 'Charge', 'charge', 'charge.png', '#A32D2D', NULL, 8, 'charges.view', '/charges', '2026-03-20 11:04:17', '2026-03-20 11:04:17');
REPLACE INTO `application_app` VALUES (10, 'Suivi de temps', 'time', 'time.png', '#7c3aed', 'Saisie du temps passé par client et projet, validation et facturation.', 9, 'time.view', '/time-entries', NULL, NULL);

-- ---------------------------------------------------------
-- Table : `menu_mnu` (118 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `menu_mnu` VALUES
(1,NULL,NULL,NULL,NULL,'Tous les dossiers',136,1,'/tickets',NULL,'Main',1,'DESKTOP','item','tickets.view'),
(2,NULL,NULL,NULL,NULL,'Tiers',119,1,'/partners','<ShopOutlined />','Main',2,'DESKTOP','item','partners.view'),
(3,NULL,NULL,NULL,NULL,'Contacts',119,2,'/contacts','<TeamOutlined />','Main',2,'DESKTOP','item','contacts.view'),
(8,NULL,NULL,NULL,NULL,'Utilisateur',0,1,'/users','<UserOutlined />','Main',8,'DESKTOP','item','users.view'),
(21,NULL,NULL,NULL,NULL,'Appareils',119,3,'/devices','<LaptopOutlined />','Main',2,'DESKTOP','item','devices.view'),
(53,NULL,NULL,NULL,NULL,'Commandes clients',122,3,'/sale-orders','<ShoppingCartOutlined />','Main',3,'DESKTOP','item','sale-orders.view'),
(54,NULL,NULL,NULL,NULL,'Devis clients',122,2,'/sale-quotations','<FileTextOutlined />','Main',3,'DESKTOP','item','sale-orders.view'),
(56,NULL,NULL,NULL,NULL,'Commandes fournisseurs',124,3,'/purchase-orders','<ShoppingOutlined />','Main',4,'DESKTOP','item','purchase-orders.view'),
(57,NULL,NULL,NULL,NULL,'Factures clients',122,4,'/customer-invoices','<FileDoneOutlined />','Main',3,'DESKTOP','item','invoices.view'),
(59,NULL,NULL,NULL,NULL,'Factures fournisseurs',124,4,'/supplier-invoices','<FileDoneOutlined />','Main',4,'DESKTOP','item','invoices.view'),
(62,NULL,NULL,NULL,NULL,'Écritures',130,1,'/account-moves','<EditOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(64,NULL,NULL,NULL,NULL,'Produits & Services',121,2,'/products','<AppstoreOutlined />','Main',3,'DESKTOP','item','products.view'),
(65,NULL,NULL,NULL,NULL,'Transfert en comptabilité',129,1,'/account-transfers','<SwapOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(66,NULL,NULL,NULL,NULL,'Rapprochement bancaire',131,1,'/account-bank-reconciliations','<BankOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(67,NULL,NULL,NULL,NULL,'Lettrage',130,3,'/account-lettering','<LinkOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(70,NULL,NULL,NULL,NULL,'Prospection',0,2,NULL,NULL,'Main',2,'DESKTOP','group',NULL),
(71,NULL,NULL,NULL,NULL,'Contrats clients',120,1,'/customercontracts','<FileSyncOutlined />','Main',3,'DESKTOP','item','contracts.view'),
(72,NULL,NULL,NULL,NULL,'Facturer les contrats',120,2,'/generate-contract-invoices','<ContainerOutlined />','Main',3,'DESKTOP','item','invoices.view'),
(73,NULL,NULL,NULL,NULL,'Export',134,2,'/accounting-exports','<ExportOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(75,NULL,NULL,NULL,NULL,'Import',134,1,'/accounting-imports','<ImportOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(77,NULL,NULL,NULL,NULL,'Sauvegarde & Restauration',134,3,'/accounting-backups','<CloudUploadOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(81,NULL,NULL,NULL,NULL,'États',133,1,'/accounting-editions','<BarChartOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(82,NULL,NULL,NULL,NULL,'Clôture',134,4,'/accounting-closures','<LockOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(85,NULL,NULL,NULL,NULL,'Travail sur un compte',130,4,'/account-working','<AuditOutlined />','Main',6,'DESKTOP','item','accountings.view'),
(88,NULL,NULL,NULL,NULL,'Charges fiscales/sociales',132,1,'/charges','<CalculatorOutlined />','Main',9,'DESKTOP','item','charges.view'),
(90,NULL,NULL,NULL,NULL,'Bons de livraison',130,1,'/customer-delivery-notes','<SendOutlined />','Main',5,'DESKTOP','item','stocks.view'),
(91,NULL,NULL,NULL,NULL,'Bons de réception',130,2,'/supplier-reception-notes','<InboxOutlined />','Main',5,'DESKTOP','item','stocks.view'),
(92,NULL,NULL,NULL,NULL,'Mouvements',130,3,'/stock-movements','<RetweetOutlined />','Main',5,'DESKTOP','item','stocks.view'),
(93,NULL,NULL,NULL,NULL,'Stock',131,1,'/stocks','<DatabaseOutlined />','Main',5,'DESKTOP','item','stocks.view'),
(94,NULL,NULL,NULL,NULL,'Règlements clients',123,1,'/customer-payments','<CreditCardOutlined />','Main',3,'DESKTOP','item','payments.view'),
(95,NULL,NULL,NULL,NULL,'Règlements fournisseurs',125,9,'/supplier-payments','<PayCircleOutlined />','Main',4,'DESKTOP','item','payments.view'),
(101,NULL,NULL,NULL,NULL,'Règlement charges',132,2,'/charge-payments','<AccountBookOutlined />','Main',9,'DESKTOP','item','payments.view'),
(106,NULL,NULL,NULL,NULL,'Clients',121,1,'/customers','<ShopOutlined />','Main',3,'DESKTOP','item','partners.view'),
(107,NULL,NULL,NULL,NULL,'Fournisseurs',126,1,'/suppliers','<ShopOutlined />','Main',4,'DESKTOP','item','partners.view'),
(109,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Toutes les notes de frais',156,2,'/expense-reports',NULL,'Main',7,'DESKTOP','item','expenses.approve'),
(110,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Mes notes de frais',155,1,'/my-expense-reports',NULL,'Main',7,'DESKTOP','item','expenses.my.view'),
(111,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Devis fournisseurs',124,2,'/purchase-quotations','<FileSearchOutlined />','Main',4,'DESKTOP','item','purchase-orders.view'),
(113,NULL,NULL,NULL,NULL,'Vue d\'ensemble',0,0,'/settings',NULL,'Main',8,'DESKTOP','item','settings.view'),
(114,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Dashboard commercial',70,5,'/prospect-dashboard','<DashboardOutlined />','Main',2,'DESKTOP','item','opportunities.view'),
(115,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Prospects',70,6,'/prospects','<UserAddOutlined />','Main',2,'DESKTOP','item','opportunities.view'),
(116,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Opportunités',70,7,'/opportunities','<ThunderboltOutlined />','Main',2,'DESKTOP','item','opportunities.view'),
(117,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Pipeline',70,9,'/opportunities/pipeline','<FunnelPlotOutlined />','Main',2,'DESKTOP','item','opportunities.view'),
(118,'2026-03-20 10:04:17','2026-03-20 10:04:17',NULL,NULL,'Activités',70,8,'/prospect-activities','<CalendarOutlined />','Main',2,'DESKTOP','item','opportunities.view'),
(119,NULL,NULL,NULL,NULL,'Principal',0,1,NULL,NULL,'Main',2,'DESKTOP','group',NULL),
(120,NULL,NULL,NULL,NULL,'Contrat',0,3,NULL,NULL,'Main',3,'DESKTOP','group',NULL),
(121,NULL,NULL,NULL,NULL,'Principal',0,1,NULL,NULL,'Main',3,'DESKTOP','group',NULL),
(122,NULL,NULL,NULL,NULL,'Ventes',0,2,NULL,NULL,'Main',3,'DESKTOP','group',NULL),
(123,NULL,NULL,NULL,NULL,'Finance',0,4,NULL,NULL,'Main',3,'DESKTOP','group',NULL),
(124,NULL,NULL,NULL,NULL,'Achats',0,2,NULL,NULL,'Main',4,'DESKTOP','group',NULL),
(125,NULL,NULL,NULL,NULL,'Finance',0,4,NULL,NULL,'Main',4,'DESKTOP','group',NULL),
(126,NULL,NULL,NULL,NULL,'Principal',0,1,NULL,NULL,'Main',4,'DESKTOP','group',NULL),
(127,NULL,NULL,NULL,NULL,'Mouvements',0,1,NULL,NULL,'Main',5,'DESKTOP','group',NULL),
(128,NULL,NULL,NULL,NULL,'Stock',0,2,NULL,NULL,'Main',5,'DESKTOP','group',NULL),
(129,NULL,NULL,NULL,NULL,'Intégration',0,1,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(130,NULL,NULL,NULL,NULL,'Saisie',0,2,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(131,NULL,NULL,NULL,NULL,'Banque',0,3,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(132,NULL,NULL,NULL,NULL,'Charges',0,5,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(133,NULL,NULL,NULL,NULL,'Reporting',0,5,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(134,NULL,NULL,NULL,NULL,'Données',0,6,NULL,NULL,'Main',6,'DESKTOP','group',NULL),
(136,NULL,NULL,NULL,NULL,'Principal',0,1,NULL,NULL,'Main',1,'DESKTOP','group',NULL),
(137,NULL,NULL,NULL,NULL,'Produits & Services',126,2,'/products','<AppstoreOutlined />','Main',4,'DESKTOP','item','products.view'),
(140,NULL,NULL,NULL,NULL,'Suivi de temps',0,10,NULL,NULL,NULL,10,'BOTH','group',NULL),
(146,NULL,NULL,NULL,NULL,'Administration',0,20,NULL,NULL,NULL,10,'BOTH','group',NULL),
(147,NULL,NULL,NULL,NULL,'Suivi de temps',0,10,NULL,NULL,NULL,10,'BOTH','group',NULL),
(148,NULL,NULL,NULL,NULL,'Saisies de temps',0,1,'/time-entries','<ClockCircleOutlined />','Main',10,'DESKTOP','item','time.view'),
(149,NULL,NULL,NULL,NULL,'Vue semaine',147,20,'/time-week','<CalendarOutlined />',NULL,10,'BOTH','item','time.view'),
(150,NULL,NULL,NULL,NULL,'Projets',0,2,'/time-projects','<FolderOutlined />','Main',10,'DESKTOP','item','time.view'),
(151,NULL,NULL,NULL,NULL,'Administration',0,20,NULL,NULL,NULL,10,'BOTH','group',NULL),
(152,NULL,NULL,NULL,NULL,'Approbation',151,10,'/time-approval','<CheckSquareOutlined />',NULL,10,'BOTH','item','time.approve'),
(153,NULL,NULL,NULL,NULL,'Générer factures',151,20,'/time-invoicing','<FileTextOutlined />',NULL,10,'BOTH','item','time.invoice'),
(154,NULL,NULL,NULL,NULL,'Rapports',10,50,'/time-reports','<BarChartOutlined />','Main',10,'DESKTOP','item','time.view.all'),
(155,NULL,NULL,NULL,NULL,'Principal',0,1,NULL,NULL,'Main',7,'DESKTOP','group',NULL),
(156,NULL,NULL,NULL,NULL,'Administration',0,20,NULL,NULL,NULL,7,'BOTH','group',NULL),
(159,NULL,NULL,NULL,NULL,'GENERAL',0,100,'','/app-icons/administration.png','Main',8,'DESKTOP','group',NULL),
(160,NULL,NULL,NULL,NULL,'Configuration de la société',159,101,'/settings/company-config',NULL,'Main',8,'DESKTOP','item','settings.company.edit'),
(161,NULL,NULL,NULL,NULL,'Séquences de numérotation',159,102,'/settings/sequences',NULL,'Main',8,'DESKTOP','item','settings.company.view'),
(162,NULL,NULL,NULL,NULL,'Profil utilisateur',159,103,'/settings/roles',NULL,'Main',8,'DESKTOP','item','settings.roles.edit'),
(163,NULL,NULL,NULL,NULL,'Email',159,104,'/settings/message-email-accounts',NULL,'Main',8,'DESKTOP','item','settings.messageemailaccounts.edit'),
(164,NULL,NULL,NULL,NULL,'Email modèle',159,105,'/settings/message-templates',NULL,'Main',8,'DESKTOP','item','settings.messagetemplates.edit'),
(165,NULL,NULL,NULL,NULL,'Tâches planifiées (CRON)',159,106,'/crontasks',NULL,'Main',8,'DESKTOP','item','settings.crontask.write'),
(166,NULL,NULL,NULL,NULL,'ASSISTANCE',0,200,'','/app-icons/assistance.png','Main',8,'DESKTOP','group',NULL),
(167,NULL,NULL,NULL,NULL,'Configuration module assistance',166,201,'/settings/ticket-config',NULL,'Main',8,'DESKTOP','item','settings.ticketingconf.edit'),
(168,NULL,NULL,NULL,NULL,'Catégories',166,202,'/settings/ticket-categories',NULL,'Main',8,'DESKTOP','item','settings.ticketingconf.view'),
(169,NULL,NULL,NULL,NULL,'Grades',166,203,'/settings/ticket-grades',NULL,'Main',8,'DESKTOP','item','settings.ticketingconf.view'),
(170,NULL,NULL,NULL,NULL,'Statuts',166,204,'/settings/ticket-statuses',NULL,'Main',8,'DESKTOP','item','settings.ticketingconf.view'),
(171,NULL,NULL,NULL,NULL,'ACHAT',0,400,'','/app-icons/achat.png','Main',8,'DESKTOP','group',NULL),
(172,NULL,NULL,NULL,NULL,'Configuration module achat',171,401,'/settings/purchase-order-conf',NULL,'Main',8,'DESKTOP','item','settings.purchaseorderconf.edit'),
(173,NULL,NULL,NULL,NULL,'VENTE',0,500,'','/app-icons/vente.png','Main',8,'DESKTOP','group',NULL),
(174,NULL,NULL,NULL,NULL,'Configuration module vente',173,501,'/settings/sale-order-conf',NULL,'Main',8,'DESKTOP','item','settings.saleorderconf.edit'),
(175,NULL,NULL,NULL,NULL,'Contrat',159,110,'',NULL,'Main',8,'DESKTOP','item',NULL),
(176,NULL,NULL,NULL,NULL,'Configuration module contrat',175,111,'/settings/contract-conf',NULL,'Main',8,'DESKTOP','item','settings.contractconf.edit'),
(177,NULL,NULL,NULL,NULL,'Durée reconduction',175,112,'/settings/durations/renew-durations',NULL,'Main',8,'DESKTOP','item','settings.contractconf.edit'),
(178,NULL,NULL,NULL,NULL,'Durée préavis',175,113,'/settings/durations/notice-durations',NULL,'Main',8,'DESKTOP','item','settings.contractconf.edit'),
(179,NULL,NULL,NULL,NULL,'Fréquence de facturation contrat',175,114,'/settings/durations/invoicing-durations',NULL,'Main',8,'DESKTOP','item','settings.contractconf.edit'),
(180,NULL,NULL,NULL,NULL,'Durée d\'abonnement',175,115,'/settings/durations/commitment-durations',NULL,'Main',8,'DESKTOP','item','settings.contractconf.edit'),
(182,NULL,NULL,NULL,NULL,'Configuration module facturation',173,502,'/settings/invoice-conf',NULL,'Main',8,'DESKTOP','item','settings.invoiceconf.edit'),
(183,NULL,NULL,NULL,NULL,'Condition de paiement',173,503,'/settings/durations/payment-conditions',NULL,'Main',8,'DESKTOP','item','settings.invoiceconf.edit'),
(184,NULL,NULL,NULL,NULL,'CHARGE',0,900,'','/app-icons/charge.png','Main',8,'DESKTOP','group',NULL),
(185,NULL,NULL,NULL,NULL,'Type de charge',184,901,'/settings/charge-types',NULL,'Main',8,'DESKTOP','item','settings.charges.edit'),
(186,NULL,NULL,NULL,NULL,'COMPTABILITE',0,700,'','/app-icons/comptabilite.png','Main',8,'DESKTOP','group',NULL),
(187,NULL,NULL,NULL,NULL,'Configuration comptable',186,701,'/settings/account-config',NULL,'Main',8,'DESKTOP','item','accountings.edit'),
(188,NULL,NULL,NULL,NULL,'Plan comptable',186,702,'/settings/accounts',NULL,'Main',8,'DESKTOP','item','accountings.edit'),
(189,NULL,NULL,NULL,NULL,'Journaux comptables',186,703,'/settings/account-journals',NULL,'Main',8,'DESKTOP','item','accountings.edit'),
(190,NULL,NULL,NULL,NULL,'Mode de paiement',186,704,'/settings/payment-modes',NULL,'Main',8,'DESKTOP','item','accountings.edit'),
(191,NULL,NULL,NULL,NULL,'TVA',186,705,'/settings/taxs',NULL,'Main',8,'DESKTOP','item','accountings.edit'),
(192,NULL,NULL,NULL,NULL,'Position fiscale',186,706,'/settings/taxpositions',NULL,'Main',8,'DESKTOP','item','settings.taxs.edit'),
(193,NULL,NULL,NULL,NULL,'STOCK',0,600,'','/app-icons/stock.png','Main',8,'DESKTOP','group',NULL),
(194,NULL,NULL,NULL,NULL,'Entrepôts',193,601,'/settings/warehouses',NULL,'Main',8,'DESKTOP','item','stocks.edit'),
(195,NULL,NULL,NULL,NULL,'RH',0,800,'','/app-icons/rh.png','Main',8,'DESKTOP','group',NULL),
(196,NULL,NULL,NULL,NULL,'Configuration module notes de frais',195,801,'/settings/expense-config',NULL,'Main',8,'DESKTOP','item','settings.expenses.edit'),
(197,NULL,NULL,NULL,NULL,'Catégorie',195,802,'/settings/expense-categories',NULL,'Main',8,'DESKTOP','item','settings.expenses.edit'),
(198,NULL,NULL,NULL,NULL,'SUIVI DE TEMPS',0,1000,'','/app-icons/time.png','Main',8,'DESKTOP','group',NULL),
(199,NULL,NULL,NULL,NULL,'Configuration module temps',198,1001,'/settings/time-config',NULL,'Main',8,'DESKTOP','item','time.invoice'),
(200,NULL,NULL,NULL,NULL,'CRM',0,300,'','/app-icons/crm.png','Main',8,'DESKTOP','group',NULL),
(201,NULL,NULL,NULL,NULL,'Étapes du pipeline',200,301,'/settings/prospect-pipeline-stages',NULL,'Main',8,'DESKTOP','item','settings.prospectconf.view'),
(202,NULL,NULL,NULL,NULL,'Sources de leads',200,302,'/settings/prospect-sources',NULL,'Main',8,'DESKTOP','item','settings.prospectconf.view'),
(203,NULL,NULL,NULL,NULL,'Raisons de perte',200,303,'/settings/prospect-lost-reasons',NULL,'Main',8,'DESKTOP','item','settings.prospectconf.view'),
(204,NULL,NULL,NULL,NULL,'Déclarations TVA',130,2,'/vat-declarations',' <EuroCircleOutlined />','Main',6,'DESKTOP','item','accountings.view');

-- ---------------------------------------------------------
-- Table : `expense_config_eco` (1 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `expense_config_eco` VALUES
(1,'2026-01-23 07:54:28',NULL,NULL,84,1);

-- ---------------------------------------------------------
-- Table : `expense_categories_exc` (9 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `expense_categories_exc` VALUES
(1,'2026-01-21 16:27:44','2026-01-29 17:09:34','Repas & Restauration','MEAL','Frais de repas d\'affaires et restauration','🍽️','#FF6B6B',1,1,NULL,359,'conso'),
(2,'2026-01-21 16:27:44','2026-01-28 08:53:18','Voyages et déplacements','TRANSPORT','Frais de déplacement (train, avion, taxi, essence)','🚗','#4ECDC4',1,1,NULL,336,'conso'),
(3,'2026-01-28 08:41:35','2026-01-28 08:41:35','Cadeaux clients','CAD',NULL,NULL,NULL,1,1,NULL,337,'conso'),
(4,'2026-01-28 08:43:16','2026-01-28 08:43:16','Petit équipement','EQUI',NULL,NULL,NULL,1,1,NULL,338,'conso'),
(5,'2026-01-28 08:44:30','2026-01-28 08:44:30','Frais de mission (Hôtel, Repas ...)','MISS',NULL,NULL,NULL,1,1,NULL,335,'conso'),
(6,'2026-01-28 08:53:38','2026-01-28 08:53:38','Frais kilométriques','KME',NULL,NULL,NULL,1,0,NULL,341,'conso'),
(7,'2026-01-28 08:53:52','2026-01-28 08:53:52','Téléphonie Mobile','TEL',NULL,NULL,NULL,1,1,NULL,311,'conso'),
(8,'2026-01-28 08:54:11','2026-01-28 08:54:11','Ligne internet','NET',NULL,NULL,NULL,1,1,NULL,339,'conso'),
(9,'2026-01-28 08:54:53','2026-01-28 08:54:53','Pénalités amendes fiscales et','AME',NULL,NULL,NULL,1,1,NULL,366,'conso');

-- ---------------------------------------------------------
-- Table : `duration_dur` (15 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `duration_dur` VALUES
(1,NULL,NULL,NULL,NULL,1,'Mensuel à échoir',1,1,'monthly','advance'),
(2,NULL,NULL,NULL,NULL,1,'1 an',2,1,'annually',NULL),
(5,NULL,NULL,NULL,NULL,1,'Sans engagement',0,NULL,'day',NULL),
(7,NULL,NULL,NULL,NULL,2,'1 mois',1,1,'monthly','advance'),
(8,NULL,NULL,NULL,NULL,2,'2 mois',1,2,'monthly',NULL),
(9,NULL,NULL,NULL,NULL,2,'Sans préavis',0,NULL,'day',NULL),
(10,NULL,NULL,NULL,NULL,3,'Tacite  pour 1 an',0,1,'annually',NULL),
(11,NULL,NULL,NULL,NULL,4,'Mensuel début de période',NULL,1,'monthly','advance'),
(12,NULL,NULL,NULL,NULL,4,'Mensuel fin de période',NULL,1,'monthly','arrears'),
(13,NULL,NULL,NULL,NULL,4,'Annuel à échoir',NULL,1,'annually','arrears'),
(14,NULL,NULL,NULL,NULL,4,'Trimestre fin de période',NULL,3,'monthly','arrears'),
(15,NULL,'2025-08-29 06:46:05',NULL,NULL,5,'Mensuel à échoir',2,1,'monthly','advance'),
(16,NULL,NULL,NULL,NULL,5,'15 Jours',1,15,'day',NULL),
(17,NULL,NULL,NULL,NULL,6,'30 Jours',1,30,'day',NULL),
(18,NULL,'2025-08-28 17:31:37',NULL,NULL,5,'A réception',NULL,1,'day','');

-- ---------------------------------------------------------
-- Table : `contract_config_cco` (1 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `contract_config_cco` VALUES
(1,'2025-06-19 14:01:01','0000-00-00 00:00:00',NULL,84,25);

-- ---------------------------------------------------------
-- Table : `charge_type_cht` (8 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `charge_type_cht` VALUES
(1,'2025-10-28 10:29:25','2025-10-11 13:44:21',84,84,'URSSAF de paris',NULL,NULL,313),
(2,'2025-10-11 13:48:28','2025-10-11 13:44:49',84,84,'Prélèvement à la source',NULL,NULL,318),
(3,NULL,'2025-10-11 13:46:06',84,NULL,'MALAKOFF HUMANIS -retraite',NULL,NULL,316),
(4,NULL,'2025-10-11 13:47:39',84,NULL,'AXA / SOGAREP - Prévoyance ',NULL,NULL,329),
(5,NULL,'2025-10-11 14:39:53',84,NULL,'Salaire Cédric GAYTE',NULL,NULL,319),
(6,'2025-10-27 10:57:16','2025-10-27 10:50:27',84,84,'NDF Cédric GAYTE',NULL,NULL,334),
(7,NULL,'2025-10-28 10:41:09',84,NULL,'Etat impôt sur les bénéfices',NULL,NULL,350),
(8,NULL,'2026-01-18 17:25:46',84,NULL,'CFE (Cotisation Foncière des Entreprises)',NULL,NULL,410);

-- ---------------------------------------------------------
-- Table : `company_cop` (1 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `company_cop` VALUES
(1,NULL,'2026-01-28 08:58:23',NULL,84,'MY COMPANY','60 ru du bonheur','75008','Paris','01 02 03 04 05',NULL,'123 456 789','SAS','Paris','500 000','5829C','FR12345695401',-1,733,734,NULL,'/company/cgv.pdf',27,28,6,'- Veuillez saisir votre réponse au-dessus de cette ligne -','demo_webhook_token_replace_me','','','');

-- ---------------------------------------------------------
-- Table : `account_tax_tax` (43 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_tax` VALUES
(23,'0000-00-00 00:00:00','2026-04-16 10:45:49',NULL,84,'20% HA','20%',20,'purchase',0,'on_invoice','all',1),
(24,'0000-00-00 00:00:00','2026-04-05 15:35:11',NULL,84,'10% HA','10%',10,'purchase',0,'on_invoice','all',1),
(25,'0000-00-00 00:00:00','2026-04-05 15:35:11',NULL,84,'5.5% HA','5.5%',5.5,'purchase',0,'on_invoice','conso',1),
(26,'0000-00-00 00:00:00','2026-04-12 12:56:17',NULL,84,'0% HA','0 %',0,'purchase',0,'on_invoice','all',1),
(29,'2025-09-12 18:34:04','2026-04-05 15:35:11',84,84,'20% HA Intra-EU','20%',20,'purchase',0,'on_invoice','all',1),
(30,'2025-09-15 11:59:29','2026-04-05 15:35:11',84,84,'20% HA Extra','20%',20,'purchase',0,'on_invoice','all',1),
(31,'2025-09-15 11:59:47','2026-04-16 10:46:45',84,84,'20% VT','20%',20,'sale',0,'on_invoice','all',1),
(32,'2025-09-15 12:00:07','2026-04-15 11:05:24',84,84,'10% VT','10%',10,'sale',0,'on_invoice','all',1),
(33,'2025-09-15 12:00:19','2026-04-15 11:05:24',84,84,'5.5 % VT','5.5%',5.5,'sale',0,'on_invoice','all',1),
(34,'2025-09-15 12:00:32','2026-04-15 11:05:24',84,84,'0% VT','0 %',0,'sale',0,'on_invoice','all',1),
(35,'2026-03-27 17:02:25','2026-04-15 11:05:24',84,84,'0% VT Extra','0 %',0,'sale',0,'on_invoice','all',1),
(36,'2026-03-28 21:23:31','2026-04-05 15:39:40',84,84,'8.5% HA Extra','8.5%',8.5,'purchase',0,'on_invoice','all',1),
(40,NULL,'2026-04-05 15:35:11',NULL,84,'5.5% HA Intra-UE','5.5%',5.5,'purchase',0,'on_invoice','all',1),
(43,NULL,'2026-04-15 11:05:24',NULL,84,'0% Vente UE','0 %',0,'sale',0,'on_invoice','all',1),
(45,'2026-03-28 22:12:21','2026-04-05 15:35:11',84,84,'10% HA Intra-UE','10%',10,'purchase',0,'on_invoice','conso',1),
(56,'2026-03-29 14:45:02','2026-04-15 11:05:24',84,84,'2.1% VT DOM','2.1%',2.1,'sale',0,'on_invoice','conso',1),
(61,'2026-03-29 14:45:02','2026-04-05 15:35:11',84,84,'2.1% HA','2.1%',2.1,'purchase',0,'on_invoice','conso',1),
(70,'2026-03-29 14:45:02','2026-04-15 11:05:24',84,84,'20% VT Enc.','20%',20,'sale',0,'on_payment','service',1),
(73,'2026-03-29 14:45:02','2026-04-15 11:05:24',84,84,'10% VT Enc.','10%',10,'sale',0,'on_payment','service',1),
(76,'2026-03-29 14:45:02','2026-04-15 11:05:24',84,84,'5.5% VT Enc.','5.5%',5.5,'sale',0,'on_payment','service',1),
(82,'2026-03-29 14:45:03','2026-04-05 15:35:11',84,84,'20% HA Déc.','20%',20,'purchase',0,'on_payment','service',1),
(85,'2026-03-29 14:45:03','2026-04-05 15:35:11',84,84,'10% HA Déc.','10%',10,'purchase',0,'on_payment','all',1),
(88,'2026-03-29 14:45:03','2026-04-05 15:35:11',84,84,'5.5% HA Déc.','5.5%',5.5,'purchase',0,'on_payment','service',1),
(91,'2026-03-29 14:45:03','2026-04-05 15:35:11',84,84,'2.1% HA Déc.','2.1%',2.1,'purchase',0,'on_payment','service',1),
(100,'2026-04-02 06:01:57','2026-04-15 11:05:24',84,84,'8.5% VT','8.5%',8.5,'sale',0,'on_invoice','conso',1),
(102,'2026-04-02 06:06:20','2026-04-15 11:05:24',84,84,'8.5% VT Enc.','8.5%',8.5,'sale',0,'on_payment','service',1),
(104,'2026-04-02 09:02:35','2026-04-15 11:05:24',NULL,84,'1,75% VT DOM','1.75%',1.75,'sale',0,'on_invoice','conso',1),
(113,'2026-04-02 09:14:55','2026-04-05 15:35:11',NULL,84,'20% HA Immo','20%',20,'purchase',0,'on_invoice','conso',1),
(114,'2026-04-02 09:14:55','2026-04-05 15:35:11',NULL,84,'10% HA Immo','10%',10,'purchase',0,'on_invoice','conso',1),
(116,'2026-04-02 09:14:55','2026-04-05 15:35:11',NULL,84,'2.1 % HA Intra-UE Déc','2.1%',2.1,'purchase',0,'on_payment','service',1),
(117,'2026-04-02 09:14:55','2026-04-05 15:36:18',NULL,84,'8.5% HA Intra-EU','8.5%',8.5,'purchase',0,'on_invoice','all',1),
(120,'2026-04-05 13:20:00','2026-04-15 11:05:24',84,84,'0% VT Enc.','0 %',0,'sale',0,'on_payment','all',1),
(121,'2026-04-05 14:34:30','2026-04-05 15:35:11',84,84,'10% HA Intra-UE Déc.','10%',10,'purchase',0,'on_payment','service',1),
(122,'2026-04-05 14:43:31','2026-04-05 15:35:11',84,84,'10% HA Extra','10%',10,'purchase',0,'on_invoice','all',1),
(123,'2026-04-05 14:49:42','2026-04-05 15:35:11',84,84,'2.1 % HA Intra-UE','2.1%',2.1,'purchase',0,'on_invoice','conso',1),
(124,'2026-04-05 15:01:36','2026-04-05 15:35:11',84,84,'2.1% HA Extra','2.1%',2.1,'purchase',0,'on_invoice','all',1),
(125,'2026-04-05 15:05:04','2026-04-05 15:35:11',84,84,'2.1% HA Immo','2.1%',2.1,'purchase',0,'on_invoice','all',1),
(126,'2026-04-05 15:08:03','2026-04-05 15:35:11',84,84,'20% HA Intra-EU Déc.','20%',20,'purchase',0,'on_payment','service',1),
(127,'2026-04-05 15:15:58','2026-04-05 15:35:11',84,84,'20% HA EX O EU','20%',20,'purchase',0,'on_invoice','conso',1),
(129,'2026-04-05 15:22:04','2026-04-05 15:35:11',84,84,'5.5% HA Intra-UE Déc.','5.5%',5.5,'purchase',0,'on_payment','service',1),
(130,'2026-04-05 15:24:58','2026-04-05 15:35:11',84,84,'5.5% HA Extra','5.5%',5.5,'purchase',0,'on_invoice','conso',1),
(131,'2026-04-05 15:28:02','2026-04-05 15:35:11',84,84,'5.5% HA Immo','5.5%',5.5,'purchase',0,'on_invoice','all',1),
(132,'2026-04-05 15:32:33','2026-04-05 15:32:33',84,84,'8.5% HA Intra-EU Déc.','8.5%',8.5,'purchase',1,'on_payment','service',1);

-- ---------------------------------------------------------
-- Table : `account_tax_tag_ttg` (93 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_tag_ttg` VALUES
(502,NULL,NULL,'0979_BASE','Ventes, prestations de services (A1)'),
(503,NULL,NULL,'0981_BASE','Autres opérations taxables (A2)'),
(504,NULL,NULL,'0044_BASE','Achats de prestations de services immatérielles (A3)'),
(505,NULL,NULL,'0056_BASE','Importations taxables (A4)'),
(506,NULL,NULL,'0051_BASE','Sorties de régime fiscal suspensif (A5)'),
(507,NULL,NULL,'0048_BASE','Mises à la consommation de produits pétroliers (B1)'),
(508,NULL,NULL,'0031_BASE','Acquisitions intracommunautaires (B2)'),
(509,NULL,NULL,'0030_BASE','Achats d\'électricité, gaz, chaleur (B3)'),
(510,NULL,NULL,'0040_BASE','Achats auprès d\'un non établi en France (B4)'),
(511,NULL,NULL,'0036_BASE','Régularisations sur opérations taxables (B5)'),
(512,NULL,NULL,'0032_BASE','Exportations hors UE (E1)'),
(513,NULL,NULL,'0033_BASE','Autres opérations non taxables (E2)'),
(514,NULL,NULL,'0047_BASE','Ventes à distance taxables dans un autre EM (E3)'),
(515,NULL,NULL,'0052_BASE','Importations non taxées (E4)'),
(516,NULL,NULL,'0053_BASE','Sorties de RFS non taxées (E5)'),
(517,NULL,NULL,'0054_BASE','Importations sous régime suspensif (E6)'),
(518,NULL,NULL,'0055_BASE','Acquisitions intracommunautaires non taxées (F1)'),
(519,NULL,NULL,'0034_BASE','Livraisons intracommunautaires vers un assujetti (F2)'),
(520,NULL,NULL,'0029_BASE','Livraisons élec, gaz, chaleur non imp. en France (F3)'),
(521,NULL,NULL,'0049_BASE','Produits pétroliers non taxés (F4)'),
(522,NULL,NULL,'0050_BASE','Importations pétrole régime suspensif (F5)'),
(523,NULL,NULL,'0037_BASE','Achats en franchise de taxe (F6)'),
(524,NULL,NULL,'0043_BASE','Ventes de biens ou services par un non établi (F7)'),
(525,NULL,NULL,'0039_BASE','Régularisations sur opérations non taxées (F8)'),
(526,NULL,NULL,'0061_BASE','Opérations internes Assujetti Unique (F9)'),
(527,NULL,NULL,'0207_BASE','Base - Taux normal 20% (Ligne 08)'),
(528,NULL,NULL,'0207_TAX','Taxe - Taux normal 20% (Ligne 08)'),
(529,NULL,NULL,'0105_BASE','Base - Taux réduit 5.5% (Ligne 09)'),
(530,NULL,NULL,'0105_TAX','Taxe - Taux réduit 5.5% (Ligne 09)'),
(531,NULL,NULL,'0151_BASE','Base - Taux réduit 10% (Ligne 9B)'),
(532,NULL,NULL,'0151_TAX','Taxe - Taux réduit 10% (Ligne 9B)'),
(533,NULL,NULL,'0201_BASE','Base - Taux normal 8.5% (Ligne 11)'),
(534,NULL,NULL,'0201_TAX','Taxe - Taux normal 8.5% (Ligne 11)'),
(535,NULL,NULL,'0100_BASE','Base - Taux réduit 2.1% (Ligne 10)'),
(536,NULL,NULL,'0100_TAX','Taxe - Taux réduit 2.1% (Ligne 10)'),
(537,NULL,NULL,'1120_BASE','Base - Taux 1.75% DOM (Ligne T1)'),
(538,NULL,NULL,'1120_TAX','Taxe - Taux 1.75% DOM (Ligne T1)'),
(539,NULL,NULL,'1110_BASE','Base - Taux 1.05% DOM (Ligne T2)'),
(540,NULL,NULL,'1110_TAX','Taxe - Taux 1.05% DOM (Ligne T2)'),
(541,NULL,NULL,'1090_BASE','Base - Taux 13% Corse (Ligne TC)'),
(542,NULL,NULL,'1090_TAX','Taxe - Taux 13% Corse (Ligne TC)'),
(543,NULL,NULL,'1010_BASE','Base - Taux 2.1% France (Ligne T6)'),
(544,NULL,NULL,'1010_TAX','Taxe - Taux 2.1% France (Ligne T6)'),
(545,NULL,NULL,'0900_BASE','Base - Anciens taux (Ligne 13)'),
(546,NULL,NULL,'0900_TAX','Taxe - Anciens taux (Ligne 13)'),
(547,NULL,NULL,'0210_BASE','Base - Importations 20% (Ligne I1)'),
(548,NULL,NULL,'0210_TAX','Taxe - Importations 20% (Ligne I1)'),
(549,NULL,NULL,'0211_BASE','Base - Importations 10% (Ligne I2)'),
(550,NULL,NULL,'0211_TAX','Taxe - Importations 10% (Ligne I2)'),
(551,NULL,NULL,'0213_BASE','Base - Importations 5.5% (Ligne I4)'),
(552,NULL,NULL,'0213_TAX','Taxe - Importations 5.5% (Ligne I4)'),
(553,NULL,NULL,'0980_BASE','Base - Livraisons à soi-même (L15)'),
(554,NULL,NULL,'0980_TAX','Taxe - Livraisons à soi-même (L15)'),
(555,NULL,NULL,'0600_BASE','Base - Reversement Taxe (L15 bis)'),
(556,NULL,NULL,'0600_TAX','Taxe - Reversement Taxe (L15 bis)'),
(557,NULL,NULL,'0602_BASE','Base - Sommes à ajouter (L5B)'),
(558,NULL,NULL,'0602_TAX','Taxe - Sommes à ajouter (L5B)'),
(559,NULL,NULL,'0703_TAX','Taxe déductible sur immobilisations (Ligne 19)'),
(560,NULL,NULL,'0702_TAX','Taxe déductible sur autres biens et services (Ligne 20)'),
(561,NULL,NULL,'0059_TAX','Autre Taxe à déduire (Ligne 21)'),
(562,NULL,NULL,'0058_TAX','Report de crédit antérieur (Ligne 22)'),
(563,NULL,NULL,'0603_TAX','Sommes à déduire (Ligne 2C)'),
(564,NULL,NULL,'0605_TAX','Crédit de Taxe (Ligne 25)'),
(565,NULL,NULL,'0606_TAX','Remboursement de crédit demandé (Ligne 26)'),
(566,NULL,NULL,'0057_TAX','Crédit de Taxe à reporter (Ligne 27)'),
(567,NULL,NULL,'0047_TAX','Taxe nette due (Ligne 28)'),
(568,NULL,NULL,'9999_TAX','Taxes assimilées (Ligne 29)'),
(570,NULL,NULL,'1081_BASE','Base - Taux réduit 10% Corse (Ligne T3)'),
(571,NULL,NULL,'1081_TAX','Taxe - Taux réduit 10% Corse (Ligne T3)'),
(572,NULL,NULL,'1050_BASE','Base - Taux particulier 2.1% Corse (Ligne T4)'),
(573,NULL,NULL,'1050_TAX','Taxe - Taux particulier 2.1% Corse (Ligne T4)'),
(574,NULL,NULL,'1040_BASE','Base - Taux mini 0.9% Corse (Ligne T5)'),
(575,NULL,NULL,'1040_TAX','Taxe - Taux mini 0.9% Corse (Ligne T5)'),
(576,NULL,NULL,'0990_BASE','Base - Retenue à la source droits d\'auteur (Ligne T7)'),
(577,NULL,NULL,'0990_TAX','Taxe - Retenue à la source droits d\'auteur (Ligne T7)'),
(578,NULL,NULL,'0208_BASE','Base - Produits pétroliers Taux 20% (Ligne P1)'),
(579,NULL,NULL,'0208_TAX','Taxe - Produits pétroliers Taux 20% (Ligne P1)'),
(580,NULL,NULL,'0152_BASE','Base - Produits pétroliers Taux 13% (Ligne P2)'),
(581,NULL,NULL,'0152_TAX','Taxe - Produits pétroliers Taux 13% (Ligne P2)'),
(582,NULL,NULL,'0212_BASE','Base - Acq. intracommunautaires autoliquidées 5.5% (Ligne I3)'),
(583,NULL,NULL,'0212_TAX','Taxe - Acq. intracommunautaires autoliquidées 5.5% (Ligne I3)'),
(584,NULL,NULL,'0214_BASE','Base - Acq. intracommunautaires autoliquidées 2.1% (Ligne I4)'),
(585,NULL,NULL,'0214_TAX','Taxe - Acq. intracommunautaires autoliquidées 2.1% (Ligne I4)'),
(586,NULL,NULL,'0215_BASE','Base - Acq. intracommunautaires autoliquidées 8.5% (Ligne I5)'),
(587,NULL,NULL,'0215_TAX','Taxe - Acq. intracommunautaires autoliquidées 8.5% (Ligne I5)'),
(588,NULL,NULL,'0710_TAX','Taxe déductible sur importations (Ligne 24)'),
(589,NULL,NULL,'0711_TAX','Taxe déductible sur produits pétroliers (Ligne 2E)'),
(590,NULL,NULL,'8113_TAX','Ajustement Y5 (Ligne Y5)'),
(591,NULL,NULL,'8114_TAX','Ajustement Y6 (Ligne Y6)'),
(592,NULL,NULL,'8103_TAX','Crédit d\'accise sur les énergies imputé (Ligne X5)'),
(593,NULL,NULL,'8123_TAX','Total final (Ligne Z5)'),
(594,NULL,NULL,'9991_TAX','Total acquitté par la société tête de groupe TVA (Ligne AB)'),
(596,NULL,NULL,'0035_TAX','Dont TVA sur acquisition intracommunautaires(17)');

-- ---------------------------------------------------------
-- Table : `account_tax_report_mapping_trm` (104 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_report_mapping_trm` VALUES
(1,NULL,NULL,NULL,'CA3','TITLE','SEC_A',NULL,'A - MONTANT DES OPÉRATIONS RÉALISÉES',5,NULL,NULL,0,0,NULL),
(2,NULL,NULL,NULL,'CA3','TITLE','SEC_B',NULL,'B - DÉCOMPTE DE LA TVA À PAYER',150,NULL,NULL,0,0,NULL),
(3,NULL,NULL,NULL,'CA3','SUBTITLE','SUB_B2',NULL,'TVA DÉDUCTIBLE',300,NULL,NULL,0,0,NULL),
(11,NULL,NULL,1,'CA3','SUBTITLE','SUB_A1',NULL,'Opérations taxées (HT)',6,NULL,NULL,0,0,NULL),
(162,502,NULL,11,'CA3','DATA','A1','0979','Ventes et prestations de services imposables',10,NULL,NULL,1,0,NULL),
(163,503,NULL,11,'CA3','DATA','A2','0981','Autres opérations imposables',11,NULL,NULL,1,0,NULL),
(164,504,NULL,11,'CA3','DATA','A3','0044','Achats de prestations de services (art. 283-2 CGI)',12,NULL,NULL,1,0,NULL),
(165,505,NULL,11,'CA3','DATA','A4','0056','Acquisitions intracommunautaires',13,NULL,NULL,1,0,NULL),
(166,506,NULL,11,'CA3','DATA','A5','0051','Livraisons de gaz naturel ou electricite imposables',14,NULL,NULL,1,0,NULL),
(167,511,NULL,11,'CA3','DATA','B5','0036','Regularisations (operations taxees)',20,NULL,NULL,1,0,NULL),
(169,513,NULL,289,'CA3','DATA','E2','0033','Exportations et operations assimilees',104,NULL,NULL,1,0,NULL),
(170,514,NULL,289,'CA3','DATA','E3','0047','Ventes a distance taxables dans un autre Etat membre (B to C)',105,NULL,NULL,1,0,NULL),
(171,515,NULL,289,'CA3','DATA','E4','0052','Importations (autres que produits petroliers) non taxees',112,NULL,NULL,1,0,NULL),
(172,516,NULL,289,'CA3','DATA','E5','0053','Sorties de regime fiscal suspensif (hors prod. petroliers)',115,NULL,NULL,1,0,NULL),
(173,517,NULL,289,'CA3','DATA','E6','0054','Importations placees sous regime fiscal suspensif',118,NULL,NULL,1,0,NULL),
(174,518,NULL,289,'CA3','DATA','F1','0055','Acquisitions intracommunautaires non taxees',121,NULL,NULL,1,0,NULL),
(175,520,NULL,289,'CA3','DATA','F3','0029','Livraisons elec., gaz, chaleur non imposables en France',125,NULL,NULL,1,0,NULL),
(176,521,NULL,289,'CA3','DATA','F4','0049','Mises a la consommation de produits petroliers non taxees',132,NULL,NULL,1,0,NULL),
(177,522,NULL,289,'CA3','DATA','F5','0050','Importations de produits petroliers sous regime suspensif',135,NULL,NULL,1,0,NULL),
(178,523,NULL,289,'CA3','DATA','F6','0037','Achats en franchise',138,NULL,NULL,1,0,NULL),
(179,524,NULL,289,'CA3','DATA','F7','0043','Ventes par un assujetti non etabli en France (art. 283-1)',142,NULL,NULL,1,0,NULL),
(180,525,NULL,289,'CA3','DATA','F8','0039','Regularisations (operations non taxees)',145,NULL,NULL,1,0,NULL),
(181,526,NULL,289,'CA3','DATA','F9','0061','Operations internes entre membres d un assujetti unique',146,NULL,NULL,1,0,NULL),
(206,555,556,288,'CA3','FORMULA','15','0600','TVA anterieurement deduite a reverser',207,NULL,'{\"op\":\"max0diff\",\"minuend\":\"00\",\"subtrahend\":\"20\"}',0,0,NULL),
(207,557,558,288,'CA3','DATA','5B','0602','Sommes a ajouter (dont acompte conges payes)',208,NULL,NULL,1,1,NULL),
(208,NULL,NULL,288,'CA3','DATA','18','0038','Dont TVA sur operations vers Monaco',211,NULL,NULL,0,0,NULL),
(215,NULL,559,3,'CA3','DATA','19','0703','Biens constituant des immobilisations',301,NULL,NULL,0,1,NULL),
(216,NULL,560,3,'CA3','DATA','20','0702','Autres biens et services - achats domestiques',302,NULL,'{\"op\":\"clamp_zero\"}',0,1,NULL),
(218,NULL,588,3,'CA3','DATA','24','0710','Dont TVA deductible - importations',308,NULL,NULL,0,1,NULL),
(219,NULL,561,3,'CA3','DATA','21','0059','Autres TVA a deduire',303,NULL,NULL,0,1,NULL),
(220,NULL,NULL,286,'CA3','DATA','29','9979','Taxes assimilees (Annexe 3310 A)',375,NULL,NULL,0,1,NULL),
(222,NULL,NULL,11,'CA12','DATA','B1',NULL,'Chiffre d affaires global (HT)',5,NULL,NULL,0,0,NULL),
(223,NULL,NULL,11,'CA12','DATA','B2',NULL,'Dont acquisitions intracommunautaires',8,NULL,NULL,0,0,NULL),
(224,NULL,NULL,11,'CA12','DATA','B3',NULL,'Dont importations',10,NULL,NULL,0,0,NULL),
(225,NULL,NULL,289,'CA12','DATA','E1',NULL,'Taux normal 20% - Base HT',10,20.000,NULL,0,0,NULL),
(226,NULL,NULL,289,'CA12','DATA','E2',NULL,'Taux normal 20% - Montant TVA',11,20.000,NULL,0,0,NULL),
(227,NULL,NULL,289,'CA12','DATA','E3',NULL,'Taux reduit 10% - Base HT',12,10.000,NULL,0,0,NULL),
(228,NULL,NULL,289,'CA12','DATA','E4',NULL,'Taux reduit 10% - Montant TVA',13,10.000,NULL,0,0,NULL),
(229,NULL,NULL,289,'CA12','DATA','F2',NULL,'Taux reduit 5,5% - Base HT',14,5.500,NULL,0,0,NULL),
(230,NULL,NULL,289,'CA12','DATA','F4',NULL,'Taux reduit 5,5% - Montant TVA',15,5.500,NULL,0,0,NULL),
(231,NULL,NULL,289,'CA12','DATA','F8',NULL,'Taux particulier 2,1% - Base HT',16,2.100,NULL,0,0,NULL),
(232,NULL,NULL,289,'CA12','DATA','F6',NULL,'Taux particulier 2,1% - Montant TVA',17,2.100,NULL,0,0,NULL),
(233,NULL,NULL,NULL,'CA12','DATA','GH',NULL,'Autoliquidation BTP - Montant TVA',18,20.000,NULL,0,0,NULL),
(234,NULL,NULL,NULL,'CA12','DATA','GH',NULL,'Autoliquidation intra-UE - Montant TVA',19,20.000,NULL,0,0,NULL),
(235,NULL,NULL,NULL,'CA12','DATA','R1',NULL,'Acompte 1er semestre verse',30,NULL,NULL,0,0,NULL),
(236,NULL,NULL,NULL,'CA12','DATA','R2',NULL,'Acompte 2eme semestre verse',35,NULL,NULL,0,0,NULL),
(237,NULL,NULL,NULL,'CA12','DATA','R3',NULL,'TVA deductible sur immobilisations',40,NULL,NULL,0,0,NULL),
(238,NULL,NULL,NULL,'CA12','DATA','R4',NULL,'TVA deductible autres biens et services',45,NULL,NULL,0,0,NULL),
(253,507,NULL,11,'CA3','DATA','B1','0048','Livraisons de biens et travaux immobiliers',16,NULL,NULL,1,0,NULL),
(254,508,NULL,11,'CA3','DATA','B2','0031','Prestations de services',17,NULL,NULL,1,0,NULL),
(255,509,NULL,11,'CA3','DATA','B3','0030','Livraisons à soi-même',18,NULL,NULL,1,0,NULL),
(256,510,NULL,11,'CA3','DATA','B4','0040','Opérations imposables par assujettis étrangers',19,NULL,NULL,1,0,NULL),
(257,NULL,NULL,288,'CA3','FORMULA','16',NULL,'Total de la TVA brute due (ligne 08 à 5B)',209,NULL,'{\"op\":\"sum\",\"boxes\":[\"08\",\"09\",\"9B\",\"10\",\"11\",\"T1\",\"T2\",\"13\",\"TC\",\"T3\",\"T4\",\"T5\",\"T6\",\"T7\",\"P1\",\"P2\",\"I1\",\"I2\",\"I3\",\"I4\",\"I5\",\"I6\",\"15\",\"5B\"]}',0,0,NULL),
(258,NULL,596,288,'CA3','DATA','17','0035','Dont TVA sur acquisitions intracommunautaires',210,NULL,NULL,0,1,NULL),
(259,NULL,NULL,3,'CA3','DATA','22','8001','Report du crédit de la déclaration précédente (ligne 27)',304,NULL,NULL,0,1,'PREVIOUS_CREDIT'),
(260,NULL,NULL,3,'CA3','DATA','22A',NULL,'Régularisations et crédit non encore imputé',306,NULL,NULL,0,0,NULL),
(261,NULL,NULL,3,'CA3','FORMULA','23',NULL,'Total TVA déductible (ligne 19 à 2C)',307,NULL,'{\"op\":\"sum\",\"boxes\":[\"19\",\"20\",\"21\",\"22\",\"2C\"]}',0,0,NULL),
(262,NULL,NULL,290,'CA3','FORMULA','25','0705','Crédit de TVA  (Ligne 23 - ligne 16)',321,NULL,'{\"op\":\"max0diff\",\"minuend\":\"23\",\"subtrahend\":\"16\"}',0,0,NULL),
(263,NULL,NULL,286,'CA3','DATA','26','8002','Dont remboursement de crédit demandé (formulaire 3519)',360,NULL,NULL,0,1,'REFUND_REQUESTED'),
(264,NULL,NULL,NULL,'CA3','DATA','AA','8005','Dont crédit de TVA transféré à la tête de groupe',362,NULL,NULL,0,1,NULL),
(265,NULL,NULL,286,'CA3','FORMULA','27','8003','Crédit de TVA à reporter (ligne 25 – ligne 26)',365,NULL,'{\"op\":\"max0diff\",\"minuend\":\"25\",\"subtrahend\":\"26\"}',0,0,'CURRENT_CREDIT'),
(266,NULL,NULL,286,'CA3','DATA','Y5','8113','Ajustement Y5 (à qualifier selon version formulaire)',368,NULL,NULL,0,1,NULL),
(267,NULL,NULL,286,'CA3','DATA','Y6','8114','Ajustement Y6 (à qualifier selon version formulaire)',369,NULL,NULL,0,1,NULL),
(268,NULL,NULL,286,'CA3','DATA','X5','8103','Dont crédit d\'accise sur les énergies imputé',370,NULL,NULL,0,1,NULL),
(269,NULL,NULL,286,'CA3','FORMULA','28','8901','TVA nette due (ligne TD – ligne X5)',371,NULL,'{\"op\":\"max0diff\",\"minuend\":\"TD\",\"subtrahend\":\"X5\"}',0,0,NULL),
(270,NULL,NULL,286,'CA3','DATA','Z5','8123','Total final (à qualifier selon version formulaire)',388,NULL,NULL,0,1,NULL),
(271,NULL,NULL,286,'CA3','DATA','AB','9991','Total acquitté par la société tête de groupe TVA',390,NULL,NULL,0,1,NULL),
(272,NULL,NULL,290,'CA3','FORMULA','TD','8900','TVA due (ligne 16 − ligne 23 si positif)',322,NULL,'{\"op\":\"max0diff\",\"minuend\":\"16\",\"subtrahend\":\"23\"}',0,0,NULL),
(273,NULL,NULL,286,'CA3','FORMULA','32','9992','Total à payer (lignes 28 + 29 + Z5 – AB)',420,NULL,'{\"op\":\"sum\",\"boxes\":[\"28\",\"29\",\"Z5\"]}',0,0,'TOTAL_TO_PAY'),
(274,512,NULL,289,'CA3','DATA','E1','0032','Exportations hors UE',103,NULL,NULL,1,0,NULL),
(275,NULL,563,3,'CA3','DATA','2C','0603','Sommes à imputer, y compris acompte congés',305,NULL,NULL,0,1,NULL),
(276,NULL,589,3,'CA3','DATA','2E','0711','Dont TVA déductible sur les produits pétroliers',309,NULL,NULL,0,1,NULL),
(281,NULL,NULL,287,'CA3','SUBTITLE2','SUB_B1_1',NULL,'Opérations réalisées en France métropolitaine',160,NULL,NULL,0,0,NULL),
(282,NULL,NULL,287,'CA3','SUBTITLE2','SUB_B1_2',NULL,'Opérations réalisées dans les DOM',170,NULL,NULL,0,0,NULL),
(283,NULL,NULL,287,'CA3','SUBTITLE2','SUB_B1_3',NULL,'Opérations à taux particuliers',180,NULL,NULL,0,0,NULL),
(284,NULL,NULL,287,'CA3','SUBTITLE2','SUB_B1_4',NULL,'Poduits pétroliers',190,NULL,NULL,0,0,NULL),
(286,NULL,NULL,NULL,'CA3','TITLE','SEC_D',NULL,'DÉTERMINATION DU MONTANT À PAYER',330,NULL,NULL,0,1,NULL),
(287,NULL,NULL,2,'CA3','SUBTITLE','SUB_B1',NULL,'TVA BRUTE',151,NULL,NULL,0,0,NULL),
(288,NULL,NULL,287,'CA3','SUBTITLE2','SUB_B1_5',NULL,'Importations',200,NULL,NULL,0,0,NULL),
(289,NULL,NULL,1,'CA3','SUBTITLE','SUB_A1',NULL,'Opérations non taxées',21,NULL,NULL,0,0,NULL),
(290,NULL,NULL,NULL,'CA3','TITLE','SEC_C',NULL,'TVA due ou crédit de TVA',320,NULL,NULL,0,1,NULL),
(301,527,528,281,'CA3','DATA','08','0207','Taux normal 20 %',161,20.000,NULL,1,1,NULL),
(302,529,530,281,'CA3','DATA','09','0105','Taux réduit 5,5 %',162,5.500,NULL,1,1,NULL),
(303,531,532,281,'CA3','DATA','9B','0151','Taux réduit 10 %',163,10.000,NULL,1,1,NULL),
(304,533,534,282,'CA3','DATA','10','0201','Taux normal 8.5%',171,8.500,NULL,1,1,NULL),
(310,535,536,282,'CA3','DATA','11','0100','Taux réduit 2,1 %',172,2.100,NULL,1,1,NULL),
(311,539,540,282,'CA3','DATA','T2','1110','Opérations réalisées dans les DOM et imposables au taux de 1.05 %',182,1.050,NULL,1,1,NULL),
(312,541,542,283,'CA3','DATA','TC','1090','Opérations réalisées en corse et imposables au taux de 13 %',183,13.000,NULL,1,1,NULL),
(313,570,571,283,'CA3','DATA','T3','1081','Opérations réalisées en corse et imposables au taux de 10 %',184,10.000,NULL,1,1,NULL),
(314,572,573,283,'CA3','DATA','T4','1050','Opérations réalisées en corse et imposables au taux de 2.1 %',185,2.100,NULL,1,1,NULL),
(315,574,575,283,'CA3','DATA','T5','1040','Opérations réalisées en corse et imposables au taux de 0.9 %',186,0.900,NULL,1,1,NULL),
(316,543,544,283,'CA3','DATA','T6','1010','Opérations réalisées en France continentale et imposables au taux de 2.1%',187,2.100,NULL,1,1,NULL),
(325,578,579,284,'CA3','DATA','P1','0208','Produits pétroliers (20 %)',191,20.000,NULL,1,1,NULL),
(326,580,581,284,'CA3','DATA','P2','0152','Produits pétroliers (13 %)',192,13.000,NULL,1,1,NULL),
(330,547,548,288,'CA3','DATA','I1','0210','Importations (taux normal 20 %)',201,20.000,NULL,1,1,NULL),
(331,549,550,288,'CA3','DATA','I2','0211','Importations (taux réduit 10 %)',202,10.000,NULL,1,1,NULL),
(332,551,552,288,'CA3','DATA','I4','0213','Importations (taux réduit 5,5 %)',204,5.500,NULL,1,1,NULL),
(333,584,585,288,'CA3','DATA','I5','0214','Importations (taux particulier 2,1 %)',205,2.100,NULL,1,1,NULL),
(340,519,NULL,289,'CA3','DATA','F2','0034','Acquisitions intracommunautaires',122,NULL,NULL,1,0,NULL),
(345,537,538,282,'CA3','DATA','T1','1120','Opérations réalisées dans les DOM et imposables au taux de 1.75 %',181,1.750,NULL,1,1,NULL),
(346,576,577,283,'CA3','DATA','T7','0990','Retenue sur droits d\'auteur',188,NULL,NULL,1,1,NULL),
(347,545,546,283,'CA3','DATA','13','0900','Anciens taux',189,NULL,NULL,1,1,NULL),
(348,582,583,288,'CA3','DATA','I3','0212','Importations (taux réduit 8.5%)',203,8.500,NULL,1,1,NULL),
(349,586,587,288,'CA3','DATA','I6','0215','Importations (taux particulier 1.05 %)',206,1.050,NULL,1,1,NULL);

-- ---------------------------------------------------------
-- Table : `account_tax_repartition_line_trl` (196 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_repartition_line_trl` VALUES
(73,NULL,NULL,43,'out_invoice','base',100.0000,NULL),
(74,NULL,NULL,43,'out_refund','base',100.0000,NULL),
(912,'2026-04-05 12:04:15','2026-04-05 12:04:15',32,'out_invoice','base',100.0000,NULL),
(913,'2026-04-05 12:04:15','2026-04-05 12:04:15',32,'out_invoice','tax',100.0000,429),
(914,'2026-04-05 12:04:15','2026-04-05 12:04:15',32,'out_refund','base',100.0000,NULL),
(915,'2026-04-05 12:04:16','2026-04-05 12:04:16',32,'out_refund','tax',100.0000,429),
(916,'2026-04-05 12:05:56','2026-04-05 12:05:56',73,'out_invoice','base',100.0000,NULL),
(917,'2026-04-05 12:05:56','2026-04-05 12:05:56',73,'out_invoice','tax',100.0000,429),
(918,'2026-04-05 12:05:56','2026-04-05 12:05:56',73,'out_refund','base',100.0000,NULL),
(919,'2026-04-05 12:05:56','2026-04-05 12:05:56',73,'out_refund','tax',100.0000,429),
(920,'2026-04-05 12:08:36','2026-04-05 12:08:36',31,'out_refund','base',100.0000,NULL),
(921,'2026-04-05 12:08:36','2026-04-05 12:08:36',31,'out_refund','tax',100.0000,428),
(922,'2026-04-05 12:08:36','2026-04-05 12:08:36',31,'out_invoice','base',100.0000,NULL),
(923,'2026-04-05 12:08:36','2026-04-05 12:08:36',31,'out_invoice','tax',100.0000,428),
(924,'2026-04-05 12:09:38','2026-04-05 12:09:38',70,'out_invoice','base',100.0000,NULL),
(925,'2026-04-05 12:09:38','2026-04-05 12:09:38',70,'out_invoice','tax',100.0000,428),
(926,'2026-04-05 12:09:39','2026-04-05 12:09:39',70,'out_refund','base',100.0000,NULL),
(927,'2026-04-05 12:09:39','2026-04-05 12:09:39',70,'out_refund','tax',100.0000,428),
(928,'2026-04-05 13:09:31','2026-04-05 13:09:31',33,'out_invoice','base',100.0000,NULL),
(929,'2026-04-05 13:09:31','2026-04-05 13:09:31',33,'out_invoice','tax',100.0000,102),
(930,'2026-04-05 13:09:31','2026-04-05 13:09:31',33,'out_refund','base',100.0000,NULL),
(931,'2026-04-05 13:09:31','2026-04-05 13:09:31',33,'out_refund','tax',100.0000,102),
(932,'2026-04-05 13:10:09','2026-04-05 13:10:09',76,'out_invoice','base',100.0000,NULL),
(933,'2026-04-05 13:10:09','2026-04-05 13:10:09',76,'out_invoice','tax',100.0000,102),
(934,'2026-04-05 13:10:09','2026-04-05 13:10:09',76,'out_refund','base',100.0000,NULL),
(935,'2026-04-05 13:10:09','2026-04-05 13:10:09',76,'out_refund','tax',100.0000,102),
(936,'2026-04-05 13:11:36','2026-04-05 13:11:36',100,'out_invoice','base',100.0000,NULL),
(937,'2026-04-05 13:11:36','2026-04-05 13:11:36',100,'out_invoice','tax',100.0000,434),
(938,'2026-04-05 13:11:37','2026-04-05 13:11:37',100,'out_refund','base',100.0000,NULL),
(939,'2026-04-05 13:11:37','2026-04-05 13:11:37',100,'out_refund','tax',100.0000,434),
(940,'2026-04-05 13:12:14','2026-04-05 13:12:14',102,'out_invoice','base',100.0000,NULL),
(941,'2026-04-05 13:12:14','2026-04-05 13:12:14',102,'out_invoice','tax',100.0000,434),
(942,'2026-04-05 13:12:14','2026-04-05 13:12:14',102,'out_refund','base',100.0000,NULL),
(943,'2026-04-05 13:12:14','2026-04-05 13:12:14',102,'out_refund','tax',100.0000,434),
(944,'2026-04-05 13:13:27','2026-04-05 13:13:27',56,'out_invoice','base',100.0000,NULL),
(945,'2026-04-05 13:13:27','2026-04-05 13:13:27',56,'out_invoice','tax',100.0000,431),
(946,'2026-04-05 13:13:28','2026-04-05 13:13:28',56,'out_refund','base',100.0000,NULL),
(947,'2026-04-05 13:13:28','2026-04-05 13:13:28',56,'out_refund','tax',100.0000,431),
(948,'2026-04-05 13:15:13','2026-04-05 13:15:13',34,'in_invoice','base',100.0000,NULL),
(949,'2026-04-05 13:15:13','2026-04-05 13:15:13',34,'in_refund','base',100.0000,NULL),
(950,'2026-04-05 13:15:13','2026-04-05 13:15:13',34,'out_invoice','base',100.0000,NULL),
(951,'2026-04-05 13:15:13','2026-04-05 13:15:13',34,'out_refund','base',100.0000,NULL),
(952,'2026-04-05 13:15:51','2026-04-05 13:15:51',35,'out_invoice','base',100.0000,NULL),
(953,'2026-04-05 13:15:51','2026-04-05 13:15:51',35,'out_refund','base',100.0000,NULL),
(954,'2026-04-05 13:20:31','2026-04-05 13:20:31',120,'out_invoice','base',100.0000,NULL),
(955,'2026-04-05 13:20:31','2026-04-05 13:20:31',120,'out_refund','base',100.0000,NULL),
(956,'2026-04-05 13:31:29','2026-04-05 13:31:29',104,'out_invoice','base',100.0000,NULL),
(957,'2026-04-05 13:31:29','2026-04-05 13:31:29',104,'out_invoice','tax',100.0000,380),
(958,'2026-04-05 13:31:29','2026-04-05 13:31:29',104,'out_refund','base',100.0000,NULL),
(959,'2026-04-05 13:31:29','2026-04-05 13:31:29',104,'out_refund','tax',100.0000,380),
(960,'2026-04-05 14:20:43','2026-04-05 14:20:43',23,'in_invoice','base',100.0000,NULL),
(961,'2026-04-05 14:20:43','2026-04-05 14:20:43',23,'in_invoice','tax',100.0000,430),
(962,'2026-04-05 14:20:43','2026-04-05 14:20:43',23,'in_refund','base',100.0000,NULL),
(963,'2026-04-05 14:20:44','2026-04-05 14:20:44',23,'in_refund','tax',100.0000,430),
(964,'2026-04-05 14:22:07','2026-04-05 14:22:07',82,'in_invoice','base',100.0000,NULL),
(965,'2026-04-05 14:22:07','2026-04-05 14:22:07',82,'in_invoice','tax',100.0000,430),
(966,'2026-04-05 14:22:08','2026-04-05 14:22:08',82,'in_refund','base',100.0000,NULL),
(967,'2026-04-05 14:22:08','2026-04-05 14:22:08',82,'in_refund','tax',100.0000,430),
(968,'2026-04-05 14:22:46','2026-04-05 14:22:46',24,'in_invoice','base',100.0000,NULL),
(969,'2026-04-05 14:22:46','2026-04-05 14:22:46',24,'in_invoice','tax',100.0000,383),
(970,'2026-04-05 14:22:46','2026-04-05 14:22:46',24,'in_refund','base',100.0000,NULL),
(971,'2026-04-05 14:22:47','2026-04-05 14:22:47',24,'in_refund','tax',100.0000,383),
(972,'2026-04-05 14:23:02','2026-04-05 14:23:02',85,'in_invoice','base',100.0000,NULL),
(973,'2026-04-05 14:23:02','2026-04-05 14:23:02',85,'in_invoice','tax',100.0000,383),
(974,'2026-04-05 14:23:02','2026-04-05 14:23:02',85,'in_refund','base',100.0000,NULL),
(975,'2026-04-05 14:23:02','2026-04-05 14:23:02',85,'in_refund','tax',100.0000,383),
(988,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_invoice','base',100.0000,NULL),
(989,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_invoice','tax',100.0000,379),
(990,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_invoice','tax',-100.0000,384),
(991,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_refund','base',100.0000,NULL),
(992,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_refund','tax',100.0000,379),
(993,'2026-04-05 14:28:27','2026-04-05 14:28:27',45,'in_refund','tax',-100.0000,384),
(1000,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_invoice','base',100.0000,NULL),
(1001,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_invoice','tax',100.0000,379),
(1002,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_invoice','tax',-100.0000,384),
(1003,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_refund','base',100.0000,NULL),
(1004,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_refund','tax',100.0000,379),
(1005,'2026-04-05 14:31:31','2026-04-05 14:31:31',40,'in_refund','tax',-100.0000,384),
(1013,'2026-04-05 14:46:55','2026-04-05 14:46:55',122,'in_invoice','base',100.0000,NULL),
(1014,'2026-04-05 14:46:55','2026-04-05 14:46:55',122,'in_invoice','tax',100.0000,379),
(1015,'2026-04-05 14:46:55','2026-04-05 14:46:55',122,'in_invoice','tax',-100.0000,385),
(1016,'2026-04-05 14:46:55','2026-04-05 14:46:55',122,'in_refund','base',100.0000,NULL),
(1017,'2026-04-05 14:46:56','2026-04-05 14:46:56',122,'in_refund','tax',100.0000,379),
(1018,'2026-04-05 14:46:56','2026-04-05 14:46:56',122,'in_refund','tax',-100.0000,385),
(1019,'2026-04-05 14:47:55','2026-04-05 14:47:55',114,'in_invoice','base',100.0000,NULL),
(1020,'2026-04-05 14:47:55','2026-04-05 14:47:55',114,'in_invoice','tax',100.0000,382),
(1021,'2026-04-05 14:47:56','2026-04-05 14:47:56',114,'in_refund','base',100.0000,NULL),
(1022,'2026-04-05 14:47:56','2026-04-05 14:47:56',114,'in_refund','tax',100.0000,382),
(1023,'2026-04-05 14:51:48','2026-04-05 14:51:48',123,'in_invoice','base',100.0000,NULL),
(1024,'2026-04-05 14:51:48','2026-04-05 14:51:48',123,'in_invoice','tax',100.0000,379),
(1025,'2026-04-05 14:51:48','2026-04-05 14:51:48',123,'in_invoice','tax',-100.0000,384),
(1026,'2026-04-05 14:51:48','2026-04-05 14:51:48',123,'in_refund','base',100.0000,NULL),
(1027,'2026-04-05 14:51:49','2026-04-05 14:51:49',123,'in_refund','tax',100.0000,379),
(1028,'2026-04-05 14:51:49','2026-04-05 14:51:49',123,'in_refund','tax',-100.0000,384),
(1029,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_invoice','base',100.0000,NULL),
(1030,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_invoice','tax',100.0000,379),
(1031,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_invoice','tax',-100.0000,384),
(1032,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_refund','base',100.0000,NULL),
(1033,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_refund','tax',100.0000,379),
(1034,'2026-04-05 15:00:36','2026-04-05 15:00:36',116,'in_refund','tax',-100.0000,384),
(1035,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_invoice','base',100.0000,NULL),
(1036,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_invoice','tax',100.0000,379),
(1037,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_invoice','tax',-100.0000,385),
(1038,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_refund','base',100.0000,NULL),
(1039,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_refund','tax',100.0000,379),
(1040,'2026-04-05 15:03:47','2026-04-05 15:03:47',124,'in_refund','tax',-100.0000,385),
(1041,'2026-04-05 15:04:14','2026-04-05 15:04:14',61,'in_invoice','base',100.0000,NULL),
(1042,'2026-04-05 15:04:14','2026-04-05 15:04:14',61,'in_invoice','tax',100.0000,432),
(1043,'2026-04-05 15:04:14','2026-04-05 15:04:14',61,'in_refund','base',100.0000,NULL),
(1044,'2026-04-05 15:04:14','2026-04-05 15:04:14',61,'in_refund','tax',100.0000,432),
(1045,'2026-04-05 15:04:31','2026-04-05 15:04:31',91,'in_invoice','base',100.0000,NULL),
(1046,'2026-04-05 15:04:31','2026-04-05 15:04:31',91,'in_invoice','tax',100.0000,432),
(1047,'2026-04-05 15:04:31','2026-04-05 15:04:31',91,'in_refund','base',100.0000,NULL),
(1048,'2026-04-05 15:04:31','2026-04-05 15:04:31',91,'in_refund','tax',100.0000,432),
(1049,'2026-04-05 15:05:45','2026-04-05 15:05:45',125,'in_invoice','base',100.0000,NULL),
(1050,'2026-04-05 15:05:45','2026-04-05 15:05:45',125,'in_invoice','tax',100.0000,382),
(1051,'2026-04-05 15:05:45','2026-04-05 15:05:45',125,'in_refund','base',100.0000,NULL),
(1052,'2026-04-05 15:05:45','2026-04-05 15:05:45',125,'in_refund','tax',100.0000,382),
(1053,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_refund','base',100.0000,NULL),
(1054,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_refund','tax',100.0000,379),
(1055,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_refund','tax',-100.0000,384),
(1056,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_invoice','base',100.0000,NULL),
(1057,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_invoice','tax',100.0000,379),
(1058,'2026-04-05 15:07:29','2026-04-05 15:07:29',29,'in_invoice','tax',-100.0000,384),
(1071,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_invoice','base',100.0000,NULL),
(1072,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_invoice','tax',-100.0000,379),
(1073,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_invoice','tax',100.0000,385),
(1074,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_refund','base',100.0000,NULL),
(1075,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_refund','tax',-100.0000,379),
(1076,'2026-04-05 15:11:43','2026-04-05 15:11:43',30,'in_refund','tax',100.0000,385),
(1077,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_invoice','base',100.0000,NULL),
(1078,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_invoice','tax',100.0000,379),
(1079,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_invoice','tax',100.0000,385),
(1080,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_refund','base',100.0000,NULL),
(1081,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_refund','tax',100.0000,379),
(1082,'2026-04-05 15:17:53','2026-04-05 15:17:53',127,'in_refund','tax',100.0000,385),
(1083,'2026-04-05 15:20:34','2026-04-05 15:20:34',113,'in_invoice','base',100.0000,NULL),
(1084,'2026-04-05 15:20:34','2026-04-05 15:20:34',113,'in_invoice','tax',100.0000,382),
(1085,'2026-04-05 15:20:34','2026-04-05 15:20:34',113,'in_refund','base',100.0000,NULL),
(1086,'2026-04-05 15:20:34','2026-04-05 15:20:34',113,'in_refund','tax',100.0000,382),
(1087,'2026-04-05 15:24:10','2026-04-05 15:24:10',129,'in_invoice','base',100.0000,NULL),
(1088,'2026-04-05 15:24:10','2026-04-05 15:24:10',129,'in_invoice','tax',100.0000,379),
(1089,'2026-04-05 15:24:11','2026-04-05 15:24:11',129,'in_invoice','tax',-100.0000,384),
(1090,'2026-04-05 15:24:11','2026-04-05 15:24:11',129,'in_refund','base',100.0000,NULL),
(1091,'2026-04-05 15:24:11','2026-04-05 15:24:11',129,'in_refund','tax',100.0000,379),
(1092,'2026-04-05 15:24:11','2026-04-05 15:24:11',129,'in_refund','tax',-100.0000,384),
(1093,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_invoice','base',100.0000,NULL),
(1094,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_invoice','tax',100.0000,379),
(1095,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_invoice','tax',-100.0000,385),
(1096,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_refund','base',100.0000,NULL),
(1097,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_refund','tax',100.0000,379),
(1098,'2026-04-05 15:27:01','2026-04-05 15:27:01',130,'in_refund','tax',-100.0000,385),
(1099,'2026-04-05 15:27:31','2026-04-05 15:27:31',25,'in_invoice','base',100.0000,NULL),
(1100,'2026-04-05 15:27:31','2026-04-05 15:27:31',25,'in_invoice','tax',100.0000,101),
(1101,'2026-04-05 15:27:31','2026-04-05 15:27:31',25,'in_refund','base',100.0000,NULL),
(1102,'2026-04-05 15:27:31','2026-04-05 15:27:31',25,'in_refund','tax',100.0000,101),
(1103,'2026-04-05 15:28:32','2026-04-05 15:28:32',131,'in_invoice','base',100.0000,NULL),
(1104,'2026-04-05 15:28:33','2026-04-05 15:28:33',131,'in_invoice','tax',100.0000,382),
(1105,'2026-04-05 15:28:33','2026-04-05 15:28:33',131,'in_refund','base',100.0000,NULL),
(1106,'2026-04-05 15:28:33','2026-04-05 15:28:33',131,'in_refund','tax',100.0000,382),
(1107,'2026-04-05 15:28:53','2026-04-05 15:28:53',88,'in_invoice','base',100.0000,NULL),
(1108,'2026-04-05 15:28:53','2026-04-05 15:28:53',88,'in_invoice','tax',100.0000,101),
(1109,'2026-04-05 15:28:54','2026-04-05 15:28:54',88,'in_refund','base',100.0000,NULL),
(1110,'2026-04-05 15:28:54','2026-04-05 15:28:54',88,'in_refund','tax',100.0000,101),
(1111,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_invoice','base',100.0000,NULL),
(1112,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_invoice','tax',100.0000,379),
(1113,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_invoice','tax',-100.0000,384),
(1114,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_refund','base',100.0000,NULL),
(1115,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_refund','tax',100.0000,379),
(1116,'2026-04-05 15:32:08','2026-04-05 15:32:08',117,'in_refund','tax',-100.0000,384),
(1123,'2026-04-05 15:39:35','2026-04-05 15:39:35',36,'in_invoice','base',100.0000,NULL),
(1124,'2026-04-05 15:39:36','2026-04-05 15:39:36',36,'in_invoice','tax',100.0000,383),
(1125,'2026-04-05 15:39:36','2026-04-05 15:39:36',36,'in_invoice','tax',-100.0000,385),
(1126,'2026-04-05 15:39:36','2026-04-05 15:39:36',36,'in_refund','base',100.0000,NULL),
(1127,'2026-04-05 15:39:36','2026-04-05 15:39:36',36,'in_refund','tax',100.0000,383),
(1128,'2026-04-05 15:39:36','2026-04-05 15:39:36',36,'in_refund','tax',-100.0000,385),
(1129,'2026-04-05 15:44:36','2026-04-05 15:44:36',26,'in_invoice','base',100.0000,NULL),
(1130,'2026-04-05 15:44:36','2026-04-05 15:44:36',26,'in_refund','base',100.0000,NULL),
(1131,'2026-04-12 12:01:37','2026-04-12 12:01:37',126,'in_invoice','base',100.0000,NULL),
(1132,'2026-04-12 12:01:37','2026-04-12 12:01:37',126,'in_invoice','tax',100.0000,379),
(1133,'2026-04-12 12:01:37','2026-04-12 12:01:37',126,'in_invoice','tax',-100.0000,384),
(1134,'2026-04-12 12:01:37','2026-04-12 12:01:37',126,'in_refund','base',100.0000,NULL),
(1135,'2026-04-12 12:01:37','2026-04-12 12:01:37',126,'in_refund','tax',100.0000,379),
(1136,'2026-04-12 12:01:38','2026-04-12 12:01:38',126,'in_refund','tax',-100.0000,384),
(1138,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_refund','base',100.0000,NULL),
(1139,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_refund','tax',100.0000,379),
(1140,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_refund','tax',-100.0000,384),
(1141,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_invoice','base',100.0000,NULL),
(1142,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_invoice','tax',100.0000,379),
(1143,'2026-04-12 12:34:57','2026-04-12 12:34:57',121,'in_invoice','tax',-100.0000,384),
(1144,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_invoice','base',100.0000,NULL),
(1145,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_invoice','tax',100.0000,379),
(1146,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_invoice','tax',-100.0000,384),
(1147,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_refund','base',100.0000,NULL),
(1148,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_refund','tax',100.0000,379),
(1149,'2026-04-12 12:36:03','2026-04-12 12:36:03',132,'in_refund','tax',-100.0000,384);

-- ---------------------------------------------------------
-- Table : `account_tax_repartition_line_tag_rel_rtr` (249 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_repartition_line_tag_rel_rtr` VALUES
(912,502),
(914,502),
(916,502),
(918,502),
(920,502),
(922,502),
(924,502),
(926,502),
(928,502),
(930,502),
(932,502),
(934,502),
(936,502),
(938,502),
(940,502),
(942,502),
(944,502),
(946,502),
(956,502),
(958,502),
(1029,504),
(1032,504),
(1087,504),
(1090,504),
(1131,504),
(1134,504),
(1138,504),
(1141,504),
(1144,504),
(1147,504),
(1013,505),
(1016,505),
(1035,505),
(1038,505),
(1077,505),
(1080,505),
(1093,505),
(1096,505),
(1123,505),
(1126,505),
(988,508),
(991,508),
(1000,508),
(1003,508),
(1023,508),
(1026,508),
(1053,508),
(1056,508),
(1111,508),
(1114,508),
(1071,510),
(1074,510),
(952,512),
(953,512),
(950,513),
(951,513),
(954,513),
(955,513),
(1129,513),
(1130,513),
(920,527),
(922,527),
(924,527),
(926,527),
(1053,527),
(1056,527),
(1071,527),
(1074,527),
(1131,527),
(1134,527),
(921,528),
(923,528),
(925,528),
(927,528),
(1055,528),
(1058,528),
(1073,528),
(1076,528),
(1133,528),
(1136,528),
(928,529),
(930,529),
(932,529),
(934,529),
(1000,529),
(1003,529),
(1087,529),
(1090,529),
(929,530),
(931,530),
(933,530),
(935,530),
(1002,530),
(1005,530),
(1089,530),
(1092,530),
(912,531),
(914,531),
(916,531),
(988,531),
(991,531),
(1138,531),
(1141,531),
(913,532),
(915,532),
(917,532),
(919,532),
(990,532),
(993,532),
(1140,532),
(1143,532),
(936,533),
(938,533),
(940,533),
(942,533),
(1111,533),
(1114,533),
(1144,533),
(1147,533),
(937,534),
(939,534),
(941,534),
(943,534),
(1113,534),
(1116,534),
(1146,534),
(1149,534),
(944,535),
(946,535),
(1023,535),
(1026,535),
(1029,535),
(1032,535),
(945,536),
(947,536),
(1025,536),
(1028,536),
(1031,536),
(1034,536),
(956,537),
(958,537),
(957,538),
(959,538),
(1077,547),
(1080,547),
(1079,548),
(1082,548),
(1013,549),
(1016,549),
(1015,550),
(1018,550),
(1093,551),
(1096,551),
(1095,552),
(1098,552),
(1020,559),
(1022,559),
(1050,559),
(1052,559),
(1084,559),
(1086,559),
(1104,559),
(1106,559),
(961,560),
(963,560),
(965,560),
(967,560),
(969,560),
(971,560),
(973,560),
(975,560),
(989,560),
(992,560),
(1001,560),
(1004,560),
(1014,560),
(1017,560),
(1024,560),
(1027,560),
(1030,560),
(1033,560),
(1036,560),
(1039,560),
(1042,560),
(1044,560),
(1046,560),
(1048,560),
(1054,560),
(1057,560),
(1072,560),
(1075,560),
(1078,560),
(1081,560),
(1088,560),
(1091,560),
(1094,560),
(1097,560),
(1100,560),
(1102,560),
(1108,560),
(1110,560),
(1112,560),
(1115,560),
(1124,560),
(1127,560),
(1132,560),
(1135,560),
(1139,560),
(1142,560),
(1145,560),
(1148,560),
(1123,582),
(1126,582),
(1125,583),
(1128,583),
(1035,584),
(1038,584),
(1037,585),
(1040,585),
(1014,588),
(1017,588),
(1036,588),
(1039,588),
(1078,588),
(1081,588),
(1094,588),
(1097,588),
(1124,588),
(1127,588),
(990,596),
(993,596),
(1002,596),
(1005,596),
(1025,596),
(1028,596),
(1031,596),
(1034,596),
(1055,596),
(1058,596),
(1089,596),
(1092,596),
(1113,596),
(1116,596),
(1133,596),
(1136,596),
(1140,596),
(1143,596),
(1146,596),
(1149,596);

-- ---------------------------------------------------------
-- Table : `account_tax_position_tap` (2 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_position_tap` VALUES
(5,NULL,'2025-09-15 12:02:22',84,NULL,'Intra-communautaire'),
(7,NULL,'2025-09-15 12:11:03',84,NULL,'Extra-communautaire');

-- ---------------------------------------------------------
-- Table : `account_tax_position_correspondence_tac` (14 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_tax_position_correspondence_tac` VALUES
(16,NULL,NULL,NULL,NULL,5,23,29),
(17,NULL,NULL,NULL,NULL,5,25,40),
(18,NULL,NULL,NULL,NULL,5,31,43),
(19,NULL,NULL,NULL,NULL,7,23,30),
(21,NULL,NULL,NULL,NULL,5,24,45),
(22,'2026-04-05 14:42:07','2026-04-05 14:42:07',84,84,5,85,121),
(23,'2026-04-12 09:09:04','2026-04-12 09:09:04',84,84,5,82,126),
(24,'2026-04-12 09:09:57','2026-04-12 09:09:57',84,84,5,40,129),
(25,'2026-04-12 09:14:38','2026-04-12 09:14:38',84,84,7,24,122),
(26,'2026-04-12 09:14:55','2026-04-12 09:14:55',84,84,7,61,124),
(27,'2026-04-12 09:15:21','2026-04-12 09:15:21',84,84,7,25,130),
(28,'2026-04-12 11:41:58','2026-04-12 11:41:58',84,84,7,82,30),
(29,'2026-04-12 11:42:16','2026-04-12 11:42:16',84,84,7,88,130),
(30,'2026-04-12 11:42:29','2026-04-12 11:42:29',84,84,7,85,122);

-- ---------------------------------------------------------
-- Table : `account_journal_ajl` (8 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_journal_ajl` VALUES
(1,'2025-03-28 17:15:35','0000-00-00 00:00:00',NULL,NULL,'VT','Vente','general'),
(2,'2025-03-28 17:16:29','0000-00-00 00:00:00',NULL,NULL,'HA','Achats','general'),
(3,'0000-00-00 00:00:00','0000-00-00 00:00:00',NULL,NULL,'BQ','Banque','bank'),
(4,'2025-05-27 06:54:23','2025-05-27 06:54:23',84,84,'OD','Opera','general'),
(5,'2025-05-28 12:34:11','2025-05-28 12:34:11',84,84,'SA','Journal SA','general'),
(6,'2025-05-28 12:34:11','2025-05-28 12:34:11',84,84,'NF','Journal NF','general'),
(7,'2025-05-28 12:34:11','2025-05-28 12:34:11',84,84,'AN','Journal AN','general'),
(8,'2025-10-10 08:55:08','2025-10-10 08:55:08',84,84,'IN','Inventaire','general');

-- ---------------------------------------------------------
-- Table : `account_exercise_aex` (3 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_exercise_aex` VALUES
(84,'2025-11-26 18:18:55','2025-09-23 12:41:37',84,84,'2024-06-01','2025-05-31',0,0,'2025-11-26',84),
(85,'2025-11-26 18:18:55','2025-09-23 12:41:37',84,84,'2025-06-01','2026-05-31',1,0,NULL,NULL),
(86,'2025-11-26 18:18:55','2025-11-26 18:18:55',84,84,'2026-06-01','2027-05-31',0,1,NULL,NULL);

-- ---------------------------------------------------------
-- Table : `account_config_aco` (1 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_config_aco` VALUES
(1,'2026-04-16 10:50:13','2025-03-26 10:40:21',NULL,84,6,1,1,392,393,1,2,2,391,355,2,3,4,5,103,357,377,378,341,2,1,3,7,4,'2023-06-06','2024-05-31',23,'debits','monthly',NULL,'reel',317,342,NULL,435,NULL,0,15,NULL,NULL);

-- ---------------------------------------------------------
-- Table : `account_account_acc` (118 ligne(s))
-- ---------------------------------------------------------
/*M!999999\- enable the sandbox mode */ 
REPLACE INTO `account_account_acc` VALUES (386, NULL, '2025-09-15 16:41:36', 84, NULL, 'Capital souscrit – non appelé', '101100', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (388, NULL, '2025-09-15 16:41:57', 84, NULL, 'Capital souscrit – appelé, versé', '101200', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (343, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Capital souscrit appele verse', '101300', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (400, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Réserve légale', '106100', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (401, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Autres réserves', '106800', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (378, NULL, '2025-07-07 15:46:38', 84, NULL, 'Report a nouveau (solde crediteur)', '110000', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (357, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Resultat de l\'exercice (benefice)', '120000', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (377, NULL, '2025-07-07 15:46:29', 84, NULL, 'Résultat de l\'exercice (perte)', '129000', 'equity', 0, 1);
REPLACE INTO `account_account_acc` VALUES (344, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Autres titres', '261800', 'asset_fixed', 0, 1);
REPLACE INTO `account_account_acc` VALUES (403, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Titres de participation', '261810', 'asset_fixed', 0, 1);
REPLACE INTO `account_account_acc` VALUES (346, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Creanc. ratt. part. (hors groupe)', '267400', 'asset_fixed', 0, 1);
REPLACE INTO `account_account_acc` VALUES (347, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Autres titres', '271800', 'asset_fixed', 0, 1);
REPLACE INTO `account_account_acc` VALUES (4, NULL, NULL, NULL, NULL, 'Fournisseurs divers', '401000', 'liability_payable', 1, 1);
REPLACE INTO `account_account_acc` VALUES (348, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Fournisseurs', '408100', 'asset_current', 0, 1);
REPLACE INTO `account_account_acc` VALUES (391, '2025-09-22 14:16:41', '2025-09-19 12:09:13', 84, 84, 'Fournisseurs - Avances et acomptes versés sur commandes ', '409100', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (3, '2025-04-24 11:31:34', NULL, NULL, 84, 'Clients divers', '411000', 'asset_receivable', 1, 1);
REPLACE INTO `account_account_acc` VALUES (392, NULL, '2025-09-19 12:09:22', 84, NULL, 'Clients - Avances et acomptes reçus sur commande ', '419100', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (5, NULL, NULL, NULL, NULL, 'Personnel rémunérations dues', '421000', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (319, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Rémunération John DOE', '421001', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (349, '2025-11-25 09:40:29', '2025-06-23 11:57:29', 84, 84, 'Autres charges a payer', '428600', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (365, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'NDF  John Doe', '428601', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (313, '2025-10-28 10:27:44', '2025-06-23 11:57:29', 84, 84, 'URSSAF DE PARIS ET REGION', '431000', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (329, '2025-10-11 13:47:51', '2025-06-23 11:57:29', 84, 84, 'AXA Entreprises', '437020', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (316, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'MALAKOFF MEDERIC (retraite)', '437030', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (367, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'AXA Prévoyance AGIRC', '437530', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (330, '2025-11-26 09:28:55', '2025-06-23 11:57:29', 84, 84, 'Org. soc. charg. a pay. & prod.', '438000', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (318, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Prélèvement à la source', '442100', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (350, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Etat impôt sur les bénéfices', '444000', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (384, NULL, '2025-09-15 12:02:08', 84, NULL, 'TVA due intracommunautaire', '445200', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (385, NULL, '2025-09-15 12:10:19', 84, NULL, 'TVA due extracommunautaire', '445300', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (317, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Tva à décaisser', '445510', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (353, '2025-11-26 09:29:56', '2025-06-23 11:57:29', 84, 84, 'Taxes sur le ca deductibles', '445600', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (382, '2026-03-29 18:14:03', '2025-09-12 18:32:49', 84, 84, 'TVA déductible sur Immobilisations', '445620', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (379, NULL, '2025-09-12 11:28:20', 84, NULL, 'TVA déductible à autoliquider', '445660', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (430, '2026-03-28 11:35:19', '2026-03-28 11:35:19', NULL, NULL, 'TVA déductible sur ABS - 20%', '445661', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (383, '2026-03-29 18:13:42', '2025-09-12 18:33:00', 84, 84, 'TVA déductible sur ABS - 10%', '445662', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (101, '2026-03-28 11:36:29', NULL, NULL, 84, 'TVA déductible sur ABS - 5,5%', '445663', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (432, '2026-03-29 14:45:03', '2026-03-29 14:45:03', 84, 84, 'TVA déductible sur ABS - 2,1%', '445664', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (342, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Crédit de tva à reporter', '445670', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (380, NULL, '2025-09-12 11:28:36', 84, NULL, 'TVA collectée à autoliquider', '445710', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (428, '2026-03-28 11:35:19', '2026-03-28 11:35:19', NULL, NULL, 'TVA collectée - 20%', '445711', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (429, '2026-03-28 11:35:19', '2026-03-28 11:35:19', NULL, NULL, 'TVA collectée - 10%', '445712', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (102, '2026-03-28 11:36:28', NULL, NULL, 84, 'TVA collectée - 5,5%', '445713', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (431, '2026-03-29 14:45:03', '2026-03-29 14:45:03', 84, 84, 'TVA collectée - 2,1%', '445714', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (434, '2026-03-29 14:45:03', '2026-03-29 14:45:03', 84, 84, 'TVA collectée - 8.5%', '445715', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (433, '2026-03-29 18:22:44', '2026-03-29 18:22:23', 84, 84, 'TVA Autoliquidée', '445780', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (435, '2026-04-12 15:53:36', '2026-04-12 15:53:21', 84, 84, 'Remboursement de taxes sur le chiffre d\'affaires demandé', '445830', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (354, '2025-11-26 09:29:18', '2025-06-23 11:57:29', 84, 84, 'Tva recuperee d\'avance', '445840', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (355, '2025-09-19 12:09:38', '2025-06-23 11:57:29', 84, 84, 'Tva en attente deductible', '445860', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (393, NULL, '2025-09-19 12:09:49', 84, NULL, 'Tva en attente collectée', '445870', 'liability_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (410, NULL, '2026-01-18 17:25:12', 84, NULL, 'Autres impôts, taxes et versements assimilés', '447000', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (331, '2025-11-26 09:30:12', '2025-06-23 11:57:29', 84, 84, 'Taxe d\'apprentissage (Majoration)', '448220', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (351, '2025-11-26 09:30:14', '2025-06-23 11:57:29', 84, 84, 'Autres charges a payer', '448600', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (352, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Principal', '455100', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (334, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'C/c John Doe', '455150', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (389, NULL, '2025-09-15 16:42:35', 84, NULL, 'Associés – versements reçus sur le capital', '456100', 'asset_current', 0, 1);
REPLACE INTO `account_account_acc` VALUES (390, NULL, '2025-09-15 16:42:45', 84, NULL, 'Associés – capital non appelé', '456200', 'asset_current', 0, 1);
REPLACE INTO `account_account_acc` VALUES (361, '2025-10-21 08:08:03', '2025-06-23 11:57:29', 84, 84, 'Creances sur cessions d\'immobilis.', '462000', 'asset_current', 1, 1);
REPLACE INTO `account_account_acc` VALUES (375, '2025-06-23 11:57:30', '2025-06-23 11:57:30', 84, 84, 'Comptes d\'attente', '471000', 'asset_current', 0, 1);
REPLACE INTO `account_account_acc` VALUES (103, '2025-10-10 09:08:26', NULL, NULL, 84, 'Banque', '512000', 'asset_cash', 0, 1);
REPLACE INTO `account_account_acc` VALUES (356, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Interets courus a payer', '518600', 'asset_current', 0, 1);
REPLACE INTO `account_account_acc` VALUES (363, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Achats materiel equipem. travaux', '605000', 'expense_direct_cost', 0, 1);
REPLACE INTO `account_account_acc` VALUES (338, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Fournit. entretien & petit equip.', '606300', 'expense_direct_cost', 0, 1);
REPLACE INTO `account_account_acc` VALUES (340, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Fournitures administratives', '606400', 'expense_direct_cost', 0, 1);
REPLACE INTO `account_account_acc` VALUES (2, NULL, NULL, NULL, NULL, 'Achat de marchandise', '607000', 'expense_direct_cost', 0, 1);
REPLACE INTO `account_account_acc` VALUES (333, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Locations immobilieres', '613200', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (315, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Honoraires', '622600', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (373, '2025-06-23 11:57:30', '2025-06-23 11:57:30', 84, 84, 'Frais d\'actes et de contentieux', '622700', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (337, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Cadeaux a la clientele', '623400', 'expense', 1, 1);
REPLACE INTO `account_account_acc` VALUES (381, NULL, '2025-09-12 11:34:20', 84, NULL, 'Frais de transport sur achats', '624000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (336, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Voyages et deplacements', '625100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (341, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Indemnités kilométriques', '625110', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (335, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Missions', '625600', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (360, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Frais postaux et de télécomm.', '626000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (339, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Ligne Internet', '626100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (311, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Téléphonie Mobile', '626200', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (309, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Services bancaires et assim.', '627000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (398, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Taxe sur les salaires', '631100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (326, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Taxe d\'apprentissage', '631200', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (328, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Part. employ. a form.  prof. cont.', '633300', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (327, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Vers. liberat. a exoner. taxe app.', '633500', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (396, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Cont. éco. territoriale', '635110', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (395, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Taxes foncières', '635120', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (315, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Honoraires', '622600', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (373, '2025-06-23 11:57:30', '2025-06-23 11:57:30', 84, 84, 'Frais d\'actes et de contentieux', '622700', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (337, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Cadeaux a la clientele', '623400', 'expense', 1, 1);
REPLACE INTO `account_account_acc` VALUES (381, NULL, '2025-09-12 11:34:20', 84, NULL, 'Frais de transport sur achats', '624000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (336, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Voyages et deplacements', '625100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (341, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Indemnités kilométriques', '625110', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (335, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Missions', '625600', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (360, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Frais postaux et de télécomm.', '626000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (339, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Ligne Internet', '626100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (311, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Téléphonie Mobile', '626200', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (309, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Services bancaires et assim.', '627000', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (398, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Taxe sur les salaires', '631100', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (326, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Taxe d\'apprentissage', '631200', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (328, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Part. employ. a form.  prof. cont.', '633300', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (327, '2025-06-23 11:57:29', '2025-06-23 11:57:29', 84, 84, 'Vers. liberat. a exoner. taxe app.', '633500', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (396, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Cont. éco. territoriale', '635110', 'expense', 0, 1);
REPLACE INTO `account_account_acc` VALUES (395, '2025-10-10 08:55:08', '2025-10-10 08:55:08', 84, 84, 'Taxes foncières', '635120', 'expense', 0, 1);


REPLACE INTO `warehouse_whs` VALUES (7, '2026-04-12 14:43:16', '2026-04-12 14:43:16', 84, NULL, 'DEF', 'PAR DEFAUT', 1, NULL, NULL, NULL, NULL, 'France', 1, 0);

REPLACE INTO `payment_mode_pam` VALUES (26, NULL, '2025-04-03 19:46:54', NULL, NULL, 'Prélèvement automatique');
REPLACE INTO `payment_mode_pam` VALUES (27, '2025-04-03 13:19:31', NULL, NULL, NULL, 'Virement');
REPLACE INTO `payment_mode_pam` VALUES (28, '2025-04-03 13:19:39', NULL, NULL, NULL, 'Chèque');
REPLACE INTO `payment_mode_pam` VALUES (29, '2025-04-03 13:19:56', NULL, NULL, NULL, 'Espèces');
REPLACE INTO `payment_mode_pam` VALUES (30, '2025-09-12 10:47:46', NULL, 84, NULL, 'Carte bancaire');

REPLACE INTO `prospect_lost_reason_plr` VALUES (1, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Prix trop élevé', 1);
REPLACE INTO `prospect_lost_reason_plr` VALUES (2, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Concurrent choisi', 1);
REPLACE INTO `prospect_lost_reason_plr` VALUES (3, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Pas de budget', 1);
REPLACE INTO `prospect_lost_reason_plr` VALUES (4, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Projet annulé', 1);
REPLACE INTO `prospect_lost_reason_plr` VALUES (5, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Sans réponse', 1);
REPLACE INTO `prospect_lost_reason_plr` VALUES (6, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Autre', 1);

REPLACE INTO `prospect_source_pso` VALUES (1, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Site web', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (2, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Salon / Événement', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (3, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Recommandation', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (4, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Appel entrant', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (5, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Email entrant', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (6, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Réseau social', 1, 0);
REPLACE INTO `prospect_source_pso` VALUES (7, '2026-02-17 15:52:15', '2026-02-17 15:52:15', NULL, NULL, 'Autre', 1, 0);

REPLACE INTO `ticket_category_tkc` VALUES (4, NULL, NULL, NULL, NULL, '0-Arrivée (nouvel compte/PC)');
REPLACE INTO `ticket_category_tkc` VALUES (5, NULL, NULL, NULL, NULL, '0-Départ (suppression de compte/PC)');
REPLACE INTO `ticket_category_tkc` VALUES (6, NULL, NULL, NULL, NULL, '2-Drive (Droits d\'accès)');
REPLACE INTO `ticket_category_tkc` VALUES (7, NULL, NULL, NULL, NULL, '1-365');
REPLACE INTO `ticket_category_tkc` VALUES (8, NULL, NULL, NULL, NULL, '2-Appli métiers ');
REPLACE INTO `ticket_category_tkc` VALUES (9, NULL, NULL, NULL, NULL, '3-Téléphonie');
REPLACE INTO `ticket_category_tkc` VALUES (12, NULL, NULL, NULL, NULL, '0-Procédure / documentation');
REPLACE INTO `ticket_category_tkc` VALUES (13, NULL, NULL, NULL, NULL, '3-Réseau');
REPLACE INTO `ticket_category_tkc` VALUES (14, NULL, NULL, NULL, NULL, '1-Matériel');
REPLACE INTO `ticket_category_tkc` VALUES (15, NULL, NULL, NULL, NULL, '3-Developpement');
REPLACE INTO `ticket_category_tkc` VALUES (16, NULL, NULL, NULL, NULL, '2-Sauvegarde');
REPLACE INTO `ticket_category_tkc` VALUES (17, NULL, NULL, NULL, NULL, '4-Commercial');
REPLACE INTO `ticket_category_tkc` VALUES (18, NULL, NULL, NULL, NULL, '3-Infra MAIA');
REPLACE INTO `ticket_category_tkc` VALUES (19, NULL, NULL, NULL, NULL, '5-Autres');
REPLACE INTO `ticket_category_tkc` VALUES (20, NULL, NULL, NULL, NULL, '3-Sécurité');
REPLACE INTO `ticket_category_tkc` VALUES (21, NULL, NULL, NULL, NULL, '5-Supervision');
REPLACE INTO `ticket_category_tkc` VALUES (22, NULL, NULL, NULL, NULL, '2-Drive (pb)');

REPLACE INTO `ticket_grade_tkg` VALUES (1, NULL, NULL, NULL, NULL, 'Demande de changement ', 0, 'orange');
REPLACE INTO `ticket_grade_tkg` VALUES (2, NULL, NULL, NULL, NULL, 'Administration', 3, 'mauve');
REPLACE INTO `ticket_grade_tkg` VALUES (4, NULL, NULL, NULL, NULL, 'Tâche Projet ', 2, 'mauve');
REPLACE INTO `ticket_grade_tkg` VALUES (5, NULL, '2026-04-15 13:06:21', NULL, 84, 'Incident', 1, 'red');
REPLACE INTO `ticket_grade_tkg` VALUES (6, NULL, NULL, NULL, NULL, 'Commercial', 6, 'lightGreen');

REPLACE INTO `ticket_priority_tkp` VALUES (1, NULL, NULL, NULL, NULL, '3-Basse', 3, 0);
REPLACE INTO `ticket_priority_tkp` VALUES (2, NULL, NULL, NULL, NULL, '2-Normale', 2, 0);
REPLACE INTO `ticket_priority_tkp` VALUES (3, NULL, NULL, NULL, NULL, '1-Haute', 1, 0);
REPLACE INTO `ticket_priority_tkp` VALUES (4, NULL, NULL, NULL, NULL, '--', 0, 0);

REPLACE INTO `ticket_source_tks` VALUES (1, NULL, NULL, NULL, NULL, 'Email', 0, 0);
REPLACE INTO `ticket_source_tks` VALUES (2, NULL, NULL, NULL, NULL, 'Téléphone', 0, 0);
REPLACE INTO `ticket_source_tks` VALUES (3, NULL, NULL, NULL, NULL, 'De visu', 0, 0);

REPLACE INTO `ticket_status_tke` VALUES (1, NULL, NULL, NULL, NULL, 'Clos', 6, 'status-tag-emerald', 'CheckCircleOutlined');
REPLACE INTO `ticket_status_tke` VALUES (3, NULL, NULL, NULL, NULL, 'Nouveau', 1, 'status-tag-red', 'ExclamationCircleOutlined');
REPLACE INTO `ticket_status_tke` VALUES (4, NULL, NULL, NULL, NULL, 'Attente retour', 3, 'status-tag-orange', 'PhoneOutlined');
REPLACE INTO `ticket_status_tke` VALUES (5, NULL, NULL, NULL, NULL, 'Attente interv. sur site', 4, 'status-tag-orange', 'HomeOutlined');
REPLACE INTO `ticket_status_tke` VALUES (6, NULL, NULL, NULL, NULL, 'Ouvert', 2, 'status-tag-yellow', 'PlayCircleOutlined');
REPLACE INTO `ticket_status_tke` VALUES (7, NULL, NULL, NULL, NULL, 'Planifié', 5, 'status-tag-cyan', 'CalendarOutlined');

INSERT INTO `prospect_pipeline_stage_pps` (`pps_id`, `pps_created`, `pps_updated`, `fk_usr_id_author`, `fk_usr_id_updater`, `pps_label`, `pps_order`, `pps_color`, `pps_is_won`, `pps_is_lost`, `pps_default_probability`, `pps_is_active`, `pps_is_default`) VALUES
(1, '2026-02-17 15:40:46', '2026-02-17 15:55:55', NULL, 84, 'Nouveau lead', 1, '#1677ff', 0, 0, 10, 1, 1),
(2, '2026-02-17 15:40:46', '2026-02-17 15:40:46', NULL, NULL, 'Qualification', 2, '#13c2c2', 0, 0, 20, 1, 0),
(3, '2026-02-17 15:40:46', '2026-02-17 15:40:46', NULL, NULL, 'Proposition', 3, '#fa8c16', 0, 0, 40, 1, 0),
(4, '2026-02-17 15:40:46', '2026-02-17 15:40:46', NULL, NULL, 'Négociation', 4, '#722ed1', 0, 0, 60, 1, 0),
(5, '2026-02-17 15:40:46', '2026-02-17 15:40:46', NULL, NULL, 'Gagné', 5, '#52c41a', 1, 0, 100, 1, 0),
(6, '2026-02-17 15:40:46', '2026-02-17 15:40:46', NULL, NULL, 'Perdu', 6, '#ff4d4f', 0, 1, 0, 1, 0);
-- =============================================================
SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================
-- FIN initialize_db.sql
-- =============================================================
