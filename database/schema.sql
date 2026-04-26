-- --------------------------------------------------------
-- Hôte:                         127.0.0.1
-- Version du serveur:           11.4.9-MariaDB - MariaDB Server
-- SE du serveur:                Win64
-- HeidiSQL Version:             12.13.0.7147
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Listage de la structure de la base pour fr_skuria_sksuite-skuria
CREATE DATABASE IF NOT EXISTS `fr_skuria_sksuite-skuria` /*!40100 DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci */;
USE `fr_skuria_sksuite-skuria`;

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_account_acc
CREATE TABLE IF NOT EXISTS `account_account_acc` (
  `acc_id` int(11) NOT NULL AUTO_INCREMENT,
  `acc_updated` timestamp NULL DEFAULT NULL,
  `acc_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `acc_label` varchar(100) DEFAULT NULL,
  `acc_code` varchar(10) DEFAULT NULL,
  `acc_type` enum('asset_receivable','asset_cash','asset_current','asset_non_current','asset_prepayments','asset_fixed','liability_payable','liability_credit_card','liability_current','liability_non_current','equity','equity_unaffected','equity_retained','equity_current_year_earnings','income','income_other','expense','expense_depreciation','expense_direct_cost','off_balance') NOT NULL DEFAULT 'asset_current',
  `acc_is_letterable` tinyint(4) NOT NULL DEFAULT 0,
  `acc_is_active` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`acc_id`) USING BTREE,
  UNIQUE KEY `acc_code` (`acc_code`),
  KEY `FK_t_account_journal_acc_tr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_account_journal_acc_tr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `acc_label` (`acc_label`),
  CONSTRAINT `FK_account_account_acc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_account_acc_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=436 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_backup_aba
CREATE TABLE IF NOT EXISTS `account_backup_aba` (
  `aba_id` int(11) NOT NULL AUTO_INCREMENT,
  `aba_label` varchar(255) DEFAULT NULL,
  `aba_size` bigint(20) DEFAULT NULL COMMENT 'Taille en octets',
  `aba_tables_count` int(11) NOT NULL DEFAULT 7,
  `aba_updated` timestamp NULL DEFAULT NULL,
  `aba_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  PRIMARY KEY (`aba_id`) USING BTREE,
  KEY `FK_account_transfer_aba_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_account_transfer_aba_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_account_transfer_aba_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_transfer_aba_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=375 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_bank_reconciliation_abr
CREATE TABLE IF NOT EXISTS `account_bank_reconciliation_abr` (
  `abr_id` int(11) NOT NULL AUTO_INCREMENT,
  `abr_updated` timestamp NULL DEFAULT NULL,
  `abr_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `abr_label` varchar(50) DEFAULT NULL,
  `abr_date_start` date DEFAULT NULL,
  `abr_date_end` date DEFAULT NULL,
  `abr_initial_balance` double DEFAULT NULL,
  `abr_final_balance` double DEFAULT NULL,
  `abr_gap` double DEFAULT NULL,
  `fk_bts_id` int(11) DEFAULT NULL,
  `abr_status` int(11) DEFAULT NULL,
  PRIMARY KEY (`abr_id`) USING BTREE,
  KEY `FK_account_bank_reconciliation_abr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_account_bank_reconciliation_abr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_account_bank_reconciliation_abr_bank_details_bts` (`fk_bts_id`),
  CONSTRAINT `FK_account_bank_reconciliation_abr_bank_details_bts` FOREIGN KEY (`fk_bts_id`) REFERENCES `bank_details_bts` (`bts_id`),
  CONSTRAINT `FK_account_bank_reconciliation_abr_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_bank_reconciliation_abr_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_config_aco
CREATE TABLE IF NOT EXISTS `account_config_aco` (
  `aco_id` int(11) NOT NULL AUTO_INCREMENT,
  `aco_updated` timestamp NULL DEFAULT NULL,
  `aco_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `aco_account_length` int(11) DEFAULT NULL,
  `fk_acc_id_sale` int(11) DEFAULT NULL,
  `fk_acc_id_sale_intra` int(11) DEFAULT NULL,
  `fk_acc_id_sale_advance` int(11) DEFAULT NULL,
  `fk_acc_id_sale_vat_waiting` int(11) DEFAULT NULL,
  `fk_acc_id_sale_export` int(11) DEFAULT NULL,
  `fk_acc_id_purchase` int(11) DEFAULT NULL,
  `fk_acc_id_purchase_intra` int(11) DEFAULT NULL,
  `fk_acc_id_purchase_advance` int(11) DEFAULT NULL,
  `fk_acc_id_purchase_vat_waiting` int(11) DEFAULT NULL,
  `fk_acc_id_purchase_import` int(11) DEFAULT NULL,
  `fk_acc_id_customer` int(11) DEFAULT NULL,
  `fk_acc_id_supplier` int(11) DEFAULT NULL,
  `fk_acc_id_employee` int(11) DEFAULT NULL,
  `fk_acc_id_bank` int(11) DEFAULT NULL,
  `fk_acc_id_profit` int(11) DEFAULT NULL,
  `fk_acc_id_loss` int(11) DEFAULT NULL,
  `fk_acc_id_carry_forward` int(11) DEFAULT NULL,
  `fk_acc_id_mileage_expense` int(11) DEFAULT NULL,
  `fk_ajl_id_purchase` int(11) DEFAULT NULL,
  `fk_ajl_id_sale` int(11) DEFAULT NULL,
  `fk_ajl_id_bank` int(11) DEFAULT NULL,
  `fk_ajl_id_an` int(11) DEFAULT NULL,
  `fk_ajl_id_od` int(11) DEFAULT NULL,
  `aco_first_exercise_start_date` date DEFAULT NULL,
  `aco_first_exercise_end_date` date DEFAULT NULL,
  `fk_tax_id_product_sale` int(11) DEFAULT NULL,
  `aco_vat_regime` enum('debits','encaissements') DEFAULT 'debits',
  `aco_vat_periodicity` enum('monthly','quarterly','mini_reel') DEFAULT 'monthly',
  `aco_vat_prorata` decimal(5,2) DEFAULT NULL,
  `aco_vat_system` enum('reel','simplifie') NOT NULL DEFAULT 'reel',
  `fk_acc_id_vat_payable` int(11) DEFAULT NULL COMMENT 'TOTAL_TO_PAY',
  `fk_acc_id_vat_credit` int(11) DEFAULT NULL COMMENT 'CURRENT_CREDIT / PREVIOUS_CREDIT',
  `fk_acc_id_vat_regularisation` int(11) DEFAULT NULL,
  `fk_acc_id_vat_refund` int(11) DEFAULT NULL COMMENT 'REFUND_REQUESTED',
  `fk_acc_id_vat_advance` int(11) DEFAULT NULL,
  `aco_vat_alert_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `aco_vat_alert_days` int(11) DEFAULT 15,
  `aco_vat_alert_emails` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`aco_vat_alert_emails`)),
  `fk_emt_id_vat_alert` int(11) DEFAULT NULL,
  PRIMARY KEY (`aco_id`) USING BTREE,
  KEY `FK_t_acoount_journal_aco_tr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_acoount_journal_aco_tr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_account_config_aco_account_account_sale` (`fk_acc_id_sale`),
  KEY `FK_account_config_aco_account_account_sale_intra` (`fk_acc_id_sale_intra`),
  KEY `FK_account_config_aco_account_account_sale_export` (`fk_acc_id_sale_export`),
  KEY `FK_account_config_aco_account_account_purchase` (`fk_acc_id_purchase`),
  KEY `FK_account_config_aco_account_account_purchase_intra` (`fk_acc_id_purchase_intra`),
  KEY `FK_account_config_aco_account_account_purchase_import` (`fk_acc_id_purchase_import`),
  KEY `FK_account_config_aco_account_account_customer` (`fk_acc_id_customer`),
  KEY `FK_account_config_aco_account_account_supplier` (`fk_acc_id_supplier`),
  KEY `FK_account_config_aco_account_account_employee` (`fk_acc_id_employee`),
  KEY `FK_account_config_aco_account_account_bank` (`fk_acc_id_bank`),
  KEY `FK_account_config_aco_account_journal_purchase` (`fk_ajl_id_purchase`),
  KEY `FK_account_config_aco_account_journal_sale` (`fk_ajl_id_sale`),
  KEY `FK_account_config_aco_account_journal_bank` (`fk_ajl_id_bank`),
  KEY `FK_account_config_aco_account_journal_ajl_2` (`fk_ajl_id_an`),
  KEY `FK_account_config_aco_account_journal_ajl_3` (`fk_ajl_id_od`),
  KEY `FK_account_config_aco_account_account_acc_fk_carry_forward` (`fk_acc_id_carry_forward`),
  KEY `FK_account_config_aco_account_account_acc_profit` (`fk_acc_id_profit`),
  KEY `FK_account_config_aco_account_account_acc_loss` (`fk_acc_id_loss`),
  KEY `FK_account_config_aco_tax_tax` (`fk_tax_id_product_sale`),
  KEY `FK_account_config_aco_account_account_acc_sale_advance` (`fk_acc_id_sale_advance`),
  KEY `FK_account_config_aco_account_account_acc_purchase_advance` (`fk_acc_id_purchase_advance`),
  KEY `FK_account_config_aco_account_account_acc_2` (`fk_acc_id_sale_vat_waiting`),
  KEY `FK_account_config_aco_account_account_acc_3` (`fk_acc_id_purchase_vat_waiting`),
  KEY `FK_account_config_aco_account_account_acc_mileage_expense` (`fk_acc_id_mileage_expense`),
  KEY `FK_aco_vat_payable` (`fk_acc_id_vat_payable`),
  KEY `FK_aco_vat_credit` (`fk_acc_id_vat_credit`),
  KEY `FK_aco_vat_alert_emt` (`fk_emt_id_vat_alert`),
  KEY `FK_aco_vat_regularisation` (`fk_acc_id_vat_regularisation`),
  KEY `FK_aco_vat_refund` (`fk_acc_id_vat_refund`),
  KEY `FK_aco_vat_advance` (`fk_acc_id_vat_advance`),
  CONSTRAINT `FK_account_config_aco_account_account_acc` FOREIGN KEY (`fk_acc_id_bank`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_acc_2` FOREIGN KEY (`fk_acc_id_sale_vat_waiting`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_account_account_acc_3` FOREIGN KEY (`fk_acc_id_purchase_vat_waiting`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_account_account_acc_fk_carry_forward` FOREIGN KEY (`fk_acc_id_carry_forward`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_acc_loss` FOREIGN KEY (`fk_acc_id_loss`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_acc_mileage_expense` FOREIGN KEY (`fk_acc_id_mileage_expense`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_account_account_acc_profit` FOREIGN KEY (`fk_acc_id_profit`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_acc_purchase_advance` FOREIGN KEY (`fk_acc_id_purchase_advance`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_account_account_acc_sale_advance` FOREIGN KEY (`fk_acc_id_sale_advance`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_account_account_bank` FOREIGN KEY (`fk_acc_id_bank`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_customer` FOREIGN KEY (`fk_acc_id_customer`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_employee` FOREIGN KEY (`fk_acc_id_employee`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_purchase` FOREIGN KEY (`fk_acc_id_purchase`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_purchase_import` FOREIGN KEY (`fk_acc_id_purchase_import`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_purchase_intra` FOREIGN KEY (`fk_acc_id_purchase_intra`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_sale` FOREIGN KEY (`fk_acc_id_sale`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_sale_export` FOREIGN KEY (`fk_acc_id_sale_export`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_sale_intra` FOREIGN KEY (`fk_acc_id_sale_intra`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_account_supplier` FOREIGN KEY (`fk_acc_id_supplier`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_ajl` FOREIGN KEY (`fk_ajl_id_purchase`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_ajl_2` FOREIGN KEY (`fk_ajl_id_an`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_ajl_3` FOREIGN KEY (`fk_ajl_id_od`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_bank` FOREIGN KEY (`fk_ajl_id_bank`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_purchase` FOREIGN KEY (`fk_ajl_id_purchase`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_account_journal_sale` FOREIGN KEY (`fk_ajl_id_sale`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_config_aco_tax_tax` FOREIGN KEY (`fk_tax_id_product_sale`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_config_aco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_config_aco_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_aco_vat_advance` FOREIGN KEY (`fk_acc_id_vat_advance`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_aco_vat_alert_emt` FOREIGN KEY (`fk_emt_id_vat_alert`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_aco_vat_credit` FOREIGN KEY (`fk_acc_id_vat_credit`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_aco_vat_payable` FOREIGN KEY (`fk_acc_id_vat_payable`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_aco_vat_refund` FOREIGN KEY (`fk_acc_id_vat_refund`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_aco_vat_regularisation` FOREIGN KEY (`fk_acc_id_vat_regularisation`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_exercise_aex
CREATE TABLE IF NOT EXISTS `account_exercise_aex` (
  `aex_id` int(11) NOT NULL AUTO_INCREMENT,
  `aex_updated` timestamp NULL DEFAULT NULL,
  `aex_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `aex_start_date` date DEFAULT NULL,
  `aex_end_date` date DEFAULT NULL,
  `aex_is_current_exercise` tinyint(4) NOT NULL DEFAULT 0,
  `aex_is_next_exercise` tinyint(4) NOT NULL DEFAULT 0,
  `aex_closing_date` date DEFAULT NULL,
  `fk_usr_id_closer` int(11) DEFAULT NULL,
  PRIMARY KEY (`aex_id`) USING BTREE,
  KEY `FK_account_exercise_aex_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_account_exercise_aex_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_account_exercise_aex_user_usr` (`fk_usr_id_closer`),
  CONSTRAINT `FK_account_exercise_aex_user_usr` FOREIGN KEY (`fk_usr_id_closer`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_exercise_aex_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_exercise_aex_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_import_export_aie
CREATE TABLE IF NOT EXISTS `account_import_export_aie` (
  `aie_id` int(11) NOT NULL AUTO_INCREMENT,
  `aie_updated` timestamp NULL DEFAULT NULL,
  `aie_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `aie_sens` tinyint(4) NOT NULL DEFAULT 0,
  `aie_transfer_start` date DEFAULT NULL,
  `aie_transfer_end` date DEFAULT NULL,
  `aie_moves` mediumtext DEFAULT NULL,
  `aie_moves_number` int(11) DEFAULT NULL,
  `aie_type` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`aie_id`) USING BTREE,
  KEY `FK_account_transfer_aie_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_account_transfer_aie_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_account_transfer_aie_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_transfer_aie_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=237 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_journal_ajl
CREATE TABLE IF NOT EXISTS `account_journal_ajl` (
  `ajl_id` int(11) NOT NULL AUTO_INCREMENT,
  `ajl_updated` timestamp NULL DEFAULT NULL,
  `ajl_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `ajl_code` varchar(10) DEFAULT NULL,
  `ajl_label` varchar(50) DEFAULT NULL,
  `ajl_type` enum('sale','purchase','bank','cash','general') NOT NULL DEFAULT 'general',
  PRIMARY KEY (`ajl_id`) USING BTREE,
  UNIQUE KEY `ajl_code` (`ajl_code`),
  KEY `FK_account_journal_ajl_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_account_journal_ajl_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_account_journal_ajl_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_journal_ajl_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_move_amo
CREATE TABLE IF NOT EXISTS `account_move_amo` (
  `amo_id` int(11) NOT NULL AUTO_INCREMENT,
  `amo_created` timestamp NULL DEFAULT NULL,
  `amo_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_ajl_id` int(11) DEFAULT NULL,
  `amo_date` date DEFAULT NULL,
  `amo_label` varchar(100) DEFAULT NULL,
  `amo_ref` varchar(100) DEFAULT NULL,
  `amo_document_type` enum('out_invoice','out_refund','in_invoice','in_refund','entry') DEFAULT NULL,
  `fk_inv_id` int(11) DEFAULT NULL,
  `fk_pay_id` int(11) DEFAULT NULL,
  `fk_exr_id` bigint(20) unsigned DEFAULT NULL,
  `fk_amo_id_parent` int(11) DEFAULT NULL,
  `amo_amount` decimal(12,2) DEFAULT NULL,
  `amo_valid` date DEFAULT NULL,
  `fk_aex_id` int(11) NOT NULL,
  PRIMARY KEY (`amo_id`) USING BTREE,
  KEY `FK_t_account_journal_aen_tr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_account_journal_aen_tr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_account_move_amo_account_journal_ajl` (`fk_ajl_id`),
  KEY `FK_account_move_amo_invoice_inv` (`fk_inv_id`),
  KEY `FK_account_move_amo_invoice_payment_inp` (`fk_pay_id`),
  KEY `FK_account_move_amo_account_exercise_aex` (`fk_aex_id`),
  KEY `FK_amo_parent` (`fk_amo_id_parent`),
  KEY `FK_account_move_amo_expense_reports_exr` (`fk_exr_id`),
  CONSTRAINT `FK_account_move_amo_account_exercise_aex` FOREIGN KEY (`fk_aex_id`) REFERENCES `account_exercise_aex` (`aex_id`),
  CONSTRAINT `FK_account_move_amo_account_journal_ajl` FOREIGN KEY (`fk_ajl_id`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_move_amo_expense_reports_exr` FOREIGN KEY (`fk_exr_id`) REFERENCES `expense_reports_exr` (`exr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_move_amo_invoice_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`),
  CONSTRAINT `FK_account_move_amo_invoice_payment_inp` FOREIGN KEY (`fk_pay_id`) REFERENCES `payment_pay` (`pay_id`),
  CONSTRAINT `FK_account_move_amo_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_move_amo_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_amo_parent` FOREIGN KEY (`fk_amo_id_parent`) REFERENCES `account_move_amo` (`amo_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=8280 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_move_line_aml
CREATE TABLE IF NOT EXISTS `account_move_line_aml` (
  `aml_id` int(11) NOT NULL AUTO_INCREMENT,
  `aml_created` timestamp NULL DEFAULT NULL,
  `aml_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_amo_id` int(11) NOT NULL,
  `fk_acc_id` int(11) NOT NULL,
  `fk_ajl_id` int(11) NOT NULL,
  `aml_label_entry` varchar(255) DEFAULT NULL,
  `aml_ref` varchar(100) DEFAULT NULL,
  `aml_date` date DEFAULT NULL,
  `aml_credit` decimal(12,2) DEFAULT NULL,
  `aml_debit` decimal(12,2) DEFAULT NULL,
  `aml_lettering_code` varchar(10) DEFAULT NULL,
  `aml_lettering_date` date DEFAULT NULL,
  `fk_abr_id` int(11) DEFAULT NULL,
  `aml_abr_code` varchar(10) DEFAULT NULL,
  `aml_abr_date` date DEFAULT NULL,
  `fk_source_line_id` int(10) unsigned DEFAULT NULL COMMENT 'ID de la ligne source (inl_id, exl_id…) ayant généré cette AML. Permet identification déterministe pour le tagging.',
  `fk_tax_id` int(11) DEFAULT NULL COMMENT 'Taxe ayant généré cette ligne. NULL pour les lignes sans TVA.',
  `aml_is_tax_line` tinyint(4) DEFAULT NULL,
  `fk_parent_aml_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`aml_id`) USING BTREE,
  KEY `FK_t_account_journal_ael_tr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_account_journal_ael_tr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_t_account_move_line_aml_t_account_entry_aen` (`fk_amo_id`) USING BTREE,
  KEY `FK_account_move_line_aml_account_account_acc` (`fk_acc_id`),
  KEY `FK_account_move_line_aml_account_bank_reconciliation_abr` (`fk_abr_id`),
  KEY `FK_account_move_line_aml_account_journal_ajl` (`fk_ajl_id`),
  KEY `FK_aml_tax` (`fk_tax_id`),
  KEY `idx_aml_tagging` (`fk_amo_id`,`fk_tax_id`,`fk_source_line_id`),
  KEY `FK_account_move_line_aml_account_move_line_aml` (`fk_parent_aml_id`),
  CONSTRAINT `FK_account_move_line_aml_account_account_acc` FOREIGN KEY (`fk_acc_id`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_account_move_line_aml_account_bank_reconciliation_abr` FOREIGN KEY (`fk_abr_id`) REFERENCES `account_bank_reconciliation_abr` (`abr_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_account_move_line_aml_account_journal_ajl` FOREIGN KEY (`fk_ajl_id`) REFERENCES `account_journal_ajl` (`ajl_id`),
  CONSTRAINT `FK_account_move_line_aml_account_move_amo` FOREIGN KEY (`fk_amo_id`) REFERENCES `account_move_amo` (`amo_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_account_move_line_aml_account_move_line_aml` FOREIGN KEY (`fk_parent_aml_id`) REFERENCES `account_move_line_aml` (`aml_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_move_line_aml_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_move_line_aml_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_aml_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=44398 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_move_line_tag_rel_amr
CREATE TABLE IF NOT EXISTS `account_move_line_tag_rel_amr` (
  `amr_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `amr_created` timestamp NULL DEFAULT current_timestamp(),
  `fk_aml_id` int(10) NOT NULL COMMENT 'Lien vers la ligne d''écriture (account_move_line)',
  `fk_ttg_id` int(10) unsigned NOT NULL COMMENT 'Lien vers le tag fiscal (account_tax_tag_ttg)',
  `fk_trl_id` int(10) unsigned DEFAULT NULL COMMENT 'Répartition source ayant produit ce tag — porte fk_acc_id fiable pour la génération des écritures de validation TVA',
  `amr_status` enum('active','pending','excluded') NOT NULL DEFAULT 'active',
  `fk_vdl_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`amr_id`) USING BTREE,
  KEY `IDX_amr_tag` (`fk_ttg_id`) USING BTREE,
  KEY `IDX_amr_aml` (`fk_aml_id`) USING BTREE,
  KEY `FK_amr_trl` (`fk_trl_id`),
  KEY `FK__amr_vdl` (`fk_vdl_id`),
  CONSTRAINT `FK__amr_vdl` FOREIGN KEY (`fk_vdl_id`) REFERENCES `account_tax_declaration_line_vdl` (`vdl_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_amr_aml` FOREIGN KEY (`fk_aml_id`) REFERENCES `account_move_line_aml` (`aml_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_amr_trl` FOREIGN KEY (`fk_trl_id`) REFERENCES `account_tax_repartition_line_trl` (`trl_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_amr_ttg` FOREIGN KEY (`fk_ttg_id`) REFERENCES `account_tax_tag_ttg` (`ttg_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=307 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_declaration_line_vdl
CREATE TABLE IF NOT EXISTS `account_tax_declaration_line_vdl` (
  `vdl_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vdl_created` timestamp NULL DEFAULT NULL,
  `vdl_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `fk_vdc_id` int(10) unsigned NOT NULL,
  `vdl_box` varchar(10) DEFAULT NULL,
  `vdl_row_type` enum('TITLE','SUBTITLE','SUBTITLE2','DATA','FORMULA') DEFAULT NULL,
  `vdl_dgfip_code` varchar(10) DEFAULT NULL,
  `vdl_label` varchar(255) DEFAULT NULL,
  `vdl_base_ht` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vdl_amount_tva` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vdl_has_base_ht` tinyint(1) NOT NULL DEFAULT 0,
  `vdl_has_tax_amt` tinyint(1) NOT NULL DEFAULT 0,
  `vdl_order` smallint(6) NOT NULL DEFAULT 0,
  `vdl_special_type` enum('PREVIOUS_CREDIT','CURRENT_CREDIT','TOTAL_TO_PAY','REFUND_REQUESTED') DEFAULT NULL,
  PRIMARY KEY (`vdl_id`),
  KEY `FK_vdl_vdc` (`fk_vdc_id`),
  KEY `FK_vdl_author` (`fk_usr_id_author`),
  KEY `FK_vdl_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_account_tax_declaration_line_vdl_account_tax_declaration_vdc` FOREIGN KEY (`fk_vdc_id`) REFERENCES `account_tax_declaration_vdc` (`vdc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_tax_declaration_line_vdl_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_tax_declaration_line_vdl_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1839 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_declaration_vdc
CREATE TABLE IF NOT EXISTS `account_tax_declaration_vdc` (
  `vdc_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vdc_created` timestamp NULL DEFAULT NULL,
  `vdc_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(10) unsigned DEFAULT NULL,
  `fk_usr_id_updater` int(10) unsigned DEFAULT NULL,
  `vdc_period_start` date NOT NULL,
  `vdc_period_end` date NOT NULL,
  `vdc_type` enum('monthly','quarterly') NOT NULL,
  `vdc_system` enum('reel','simplifie') NOT NULL DEFAULT 'reel',
  `vdc_regime` enum('debits','encaissements') NOT NULL,
  `vdc_label` varchar(50) DEFAULT NULL,
  `vdc_status` enum('draft','closed') NOT NULL DEFAULT 'draft',
  `vdc_validated_at` timestamp NULL DEFAULT NULL,
  `vdc_closed_at` timestamp NULL DEFAULT NULL,
  `vdc_credit_previous` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vdc_prorata` decimal(5,2) DEFAULT NULL,
  `fk_amo_id` int(10) unsigned DEFAULT NULL,
  `fk_aex_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`vdc_id`),
  KEY `FK_vdc_author` (`fk_usr_id_author`),
  KEY `FK_vdc_updater` (`fk_usr_id_updater`),
  KEY `FK_vdc_amo` (`fk_amo_id`),
  KEY `FK_vdc_aex` (`fk_aex_id`)
) ENGINE=InnoDB AUTO_INCREMENT=284 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_position_correspondence_tac
CREATE TABLE IF NOT EXISTS `account_tax_position_correspondence_tac` (
  `tac_id` int(11) NOT NULL AUTO_INCREMENT,
  `tac_updated` timestamp NULL DEFAULT NULL,
  `tac_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_tap_id` int(11) DEFAULT NULL,
  `fk_tax_id_source` int(11) DEFAULT NULL,
  `fk_tax_id_target` int(11) DEFAULT NULL,
  PRIMARY KEY (`tac_id`) USING BTREE,
  UNIQUE KEY `fk_tap_id_fk_tax_id_source_fk_tax_id_target` (`fk_tap_id`,`fk_tax_id_source`,`fk_tax_id_target`) USING BTREE,
  KEY `FK_tax_position__correspondence_tac_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_tax_position__correspondence_tac_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_tax_position__correspondence_tac_tax_tax_source` (`fk_tax_id_source`) USING BTREE,
  KEY `FK_tax_position__correspondence_tac_tax_tax_target` (`fk_tax_id_target`) USING BTREE,
  CONSTRAINT `FK_tax_position__correspondence_tac_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_tax_position__correspondence_tac_tax_tax_source` FOREIGN KEY (`fk_tax_id_source`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_tax_position__correspondence_tac_tax_tax_target` FOREIGN KEY (`fk_tax_id_target`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_tax_position__correspondence_tac_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_tax_position__correspondence_tac_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_position_tap
CREATE TABLE IF NOT EXISTS `account_tax_position_tap` (
  `tap_id` int(11) NOT NULL AUTO_INCREMENT,
  `tap_updated` timestamp NULL DEFAULT NULL,
  `tap_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tap_label` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`tap_id`) USING BTREE,
  KEY `FK_tax_position_tap_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_tax_position_tap_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_tax_position_tap_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_tax_position_tap_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_repartition_line_tag_rel_rtr
CREATE TABLE IF NOT EXISTS `account_tax_repartition_line_tag_rel_rtr` (
  `fk_trl_id` int(10) unsigned NOT NULL COMMENT 'Lien vers account_tax_repartition_line_trl',
  `fk_ttg_id` int(10) unsigned NOT NULL COMMENT 'Lien vers account_tax_tag_ttg',
  PRIMARY KEY (`fk_trl_id`,`fk_ttg_id`),
  KEY `fk_rtr_ttg` (`fk_ttg_id`),
  CONSTRAINT `fk_rtr_trl` FOREIGN KEY (`fk_trl_id`) REFERENCES `account_tax_repartition_line_trl` (`trl_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rtr_ttg` FOREIGN KEY (`fk_ttg_id`) REFERENCES `account_tax_tag_ttg` (`ttg_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Lien plusieurs-à-plusieurs entre répartition de taxe et tags DGFIP';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_repartition_line_trl
CREATE TABLE IF NOT EXISTS `account_tax_repartition_line_trl` (
  `trl_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `fk_tax_id` int(10) NOT NULL COMMENT 'Taxe parente',
  `trl_document_type` enum('out_invoice','out_refund','in_invoice','in_refund') DEFAULT NULL,
  `trl_repartition_type` enum('base','tax') NOT NULL COMMENT 'base = ligne montant HT, tax = ligne montant TVA',
  `trl_factor_percent` decimal(7,4) NOT NULL DEFAULT 100.0000 COMMENT '% de la TVA alloué ici (100 = totalité, 80 = prorata 80%)',
  `fk_acc_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`trl_id`),
  UNIQUE KEY `uk_trl_tax_doc_type_acc_factor` (`fk_tax_id`,`trl_document_type`,`trl_repartition_type`,`fk_acc_id`,`trl_factor_percent`),
  KEY `FK_account_tax_repartition_line_trl_account_account_acc` (`fk_acc_id`),
  CONSTRAINT `FK_account_tax_repartition_line_trl_account_account_acc` FOREIGN KEY (`fk_acc_id`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_account_tax_repartition_line_trl_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1151 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_report_mapping_trm
CREATE TABLE IF NOT EXISTS `account_tax_report_mapping_trm` (
  `trm_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fk_ttg_id_base` int(10) unsigned DEFAULT NULL,
  `fk_ttg_id_tax` int(10) unsigned DEFAULT NULL,
  `fk_trm_id_parent` int(10) unsigned DEFAULT NULL,
  `trm_regime` enum('CA3','CA12') NOT NULL DEFAULT 'CA3',
  `trm_row_type` enum('TITLE','SUBTITLE','SUBTITLE2','DATA','FORMULA') NOT NULL DEFAULT 'DATA',
  `trm_box` varchar(10) NOT NULL,
  `trm_dgfip_code` varchar(10) DEFAULT NULL,
  `trm_label` varchar(255) NOT NULL DEFAULT '' COMMENT 'Libellé officiel DGFiP de la case',
  `trm_order` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Ordre d''affichage dans la section',
  `trm_tax_rate` decimal(6,3) DEFAULT NULL,
  `trm_formula` longtext DEFAULT NULL CHECK (json_valid(`trm_formula`)),
  `trm_has_base_ht` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Affiche la colonne Base HT',
  `trm_has_tax_amt` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Affiche la colonne Montant TVA',
  `trm_special_type` enum('PREVIOUS_CREDIT','CURRENT_CREDIT','TOTAL_TO_PAY','REFUND_REQUESTED') DEFAULT NULL,
  PRIMARY KEY (`trm_id`),
  UNIQUE KEY `trm_regime_trm_special_type` (`trm_regime`,`trm_special_type`),
  KEY `idx_regime` (`trm_regime`),
  KEY `fk_trm_ttg_base` (`fk_ttg_id_base`) USING BTREE,
  KEY `fk_trm_ttg_tax` (`fk_ttg_id_tax`) USING BTREE,
  KEY `fk_trm_parent` (`fk_trm_id_parent`) USING BTREE,
  CONSTRAINT `fk_trm_parent` FOREIGN KEY (`fk_trm_id_parent`) REFERENCES `account_tax_report_mapping_trm` (`trm_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trm_ttg_base` FOREIGN KEY (`fk_ttg_id_base`) REFERENCES `account_tax_tag_ttg` (`ttg_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trm_ttg_tax` FOREIGN KEY (`fk_ttg_id_tax`) REFERENCES `account_tax_tag_ttg` (`ttg_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=350 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Cette table sert de moteur de traduction (Dictionnaire) entre la comptabilité technique et la liasse fiscale. Elle permet de découpler totalement les écritures comptables (liées à des Tags métiers stables) de la présentation visuelle sur les formulaires Cerfa (qui varient selon le régime et les mises à jour de l''État).';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_tag_ttg
CREATE TABLE IF NOT EXISTS `account_tax_tag_ttg` (
  `ttg_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `ttg_created` timestamp NULL DEFAULT NULL,
  `ttg_updated` timestamp NULL DEFAULT NULL,
  `ttg_code` varchar(30) NOT NULL COMMENT 'Clé machine unique, ex. "FR_TVA_COLL_20"',
  `ttg_name` varchar(120) NOT NULL COMMENT 'Libellé affiché, ex. "TVA collectée 20%"',
  PRIMARY KEY (`ttg_id`),
  UNIQUE KEY `tax_tag_ttg_ttg_code_unique` (`ttg_code`)
) ENGINE=InnoDB AUTO_INCREMENT=597 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_tax_tax
CREATE TABLE IF NOT EXISTS `account_tax_tax` (
  `tax_id` int(11) NOT NULL AUTO_INCREMENT,
  `tax_created` timestamp NULL DEFAULT NULL,
  `tax_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tax_label` varchar(50) DEFAULT NULL,
  `tax_print_label` varchar(50) DEFAULT NULL,
  `tax_rate` double NOT NULL DEFAULT 0,
  `tax_use` enum('sale','purchase') NOT NULL DEFAULT 'purchase',
  `tax_is_default` tinyint(4) NOT NULL DEFAULT 0,
  `tax_exigibility` enum('on_invoice','on_payment') NOT NULL DEFAULT 'on_invoice',
  `tax_scope` enum('conso','service','all') NOT NULL DEFAULT 'all',
  `tax_is_active` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tax_id`) USING BTREE,
  UNIQUE KEY `tva_label` (`tax_label`) USING BTREE,
  KEY `FK_tva_tva_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_tva_tva_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_tva_tva_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_tva_tva_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=135 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. account_transfer_atr
CREATE TABLE IF NOT EXISTS `account_transfer_atr` (
  `atr_id` int(11) NOT NULL AUTO_INCREMENT,
  `atr_updated` timestamp NULL DEFAULT NULL,
  `atr_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `atr_transfer_start` date DEFAULT NULL,
  `atr_transfer_end` date DEFAULT NULL,
  `atr_moves` mediumtext DEFAULT NULL,
  `atr_moves_number` int(11) DEFAULT NULL,
  PRIMARY KEY (`atr_id`) USING BTREE,
  KEY `FK_account_transfer_atr_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_account_transfer_atr_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_account_transfer_atr_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_account_transfer_atr_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. application_app
CREATE TABLE IF NOT EXISTS `application_app` (
  `app_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `app_lib` varchar(100) NOT NULL,
  `app_slug` varchar(50) NOT NULL,
  `app_icon` varchar(255) NOT NULL,
  `app_color` varchar(20) DEFAULT NULL,
  `app_description` text DEFAULT NULL,
  `app_order` int(11) NOT NULL DEFAULT 0,
  `app_permission` varchar(191) DEFAULT NULL COMMENT 'NULL = accessible si authentifié',
  `app_root_href` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`app_id`) USING BTREE,
  UNIQUE KEY `application_app_app_slug_unique` (`app_slug`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. bank_details_bts
CREATE TABLE IF NOT EXISTS `bank_details_bts` (
  `bts_id` int(11) NOT NULL AUTO_INCREMENT,
  `bts_created` timestamp NULL DEFAULT NULL,
  `bts_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `bts_label` varchar(100) DEFAULT NULL,
  `bts_bank_code` varchar(100) DEFAULT NULL,
  `bts_sort_code` varchar(100) DEFAULT NULL,
  `bts_account_nbr` varchar(100) DEFAULT NULL,
  `bts_bban_key` varchar(100) DEFAULT NULL,
  `bts_bic` varchar(100) DEFAULT NULL,
  `bts_iban` varchar(100) DEFAULT NULL,
  `bts_bnal_address` varchar(100) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_acc_id` int(11) DEFAULT NULL,
  `fk_cop_id` int(11) DEFAULT NULL,
  `bts_is_default` tinyint(4) NOT NULL DEFAULT 0,
  `bts_is_active` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`bts_id`) USING BTREE,
  KEY `FK_t_bank_details_bts_tr_user_usr` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_bank_details_bts_tr_user_usr_2` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_t_bank_details_bts_t_partner_clt` (`fk_ptr_id`) USING BTREE,
  KEY `FK_bank_details_bts_account_account_acc` (`fk_acc_id`),
  KEY `FK_bank_details_bts_company_cop` (`fk_cop_id`),
  CONSTRAINT `FK_bank_details_bts_account_account_acc` FOREIGN KEY (`fk_acc_id`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_bank_details_bts_company_cop` FOREIGN KEY (`fk_cop_id`) REFERENCES `company_cop` (`cop_id`),
  CONSTRAINT `FK_bank_details_bts_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_bank_details_bts_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_bank_details_bts_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. cache
CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(191) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. cache_locks
CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(191) NOT NULL,
  `owner` varchar(191) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. charge_che
CREATE TABLE IF NOT EXISTS `charge_che` (
  `che_id` int(11) NOT NULL AUTO_INCREMENT,
  `che_created` timestamp NULL DEFAULT NULL,
  `che_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `che_number` varchar(30) DEFAULT NULL,
  `che_date` date NOT NULL,
  `che_label` varchar(50) NOT NULL,
  `che_status` int(11) DEFAULT NULL,
  `che_totalttc` double DEFAULT NULL,
  `che_amount_remaining` double DEFAULT NULL,
  `che_balance` double DEFAULT NULL,
  `che_payment_progress` int(11) DEFAULT NULL,
  `fk_cht_id` int(11) DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`che_id`) USING BTREE,
  UNIQUE KEY `che_number` (`che_number`) USING BTREE,
  KEY `FK_tc_propal_ppr_tr_user_usr` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_tc_propal_ppr_tr_user_usr_2` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_charge_che_charge_type_cht` (`fk_cht_id`) USING BTREE,
  KEY `FK_charge_che_payment_mode_pam` (`fk_pam_id`) USING BTREE,
  CONSTRAINT `FK_charge_che_charge_type_cht` FOREIGN KEY (`fk_cht_id`) REFERENCES `charge_type_cht` (`cht_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_charge_che_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_charge_sce_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_charge_sce_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. charge_type_cht
CREATE TABLE IF NOT EXISTS `charge_type_cht` (
  `cht_id` int(11) NOT NULL AUTO_INCREMENT,
  `cht_updated` timestamp NULL DEFAULT NULL,
  `cht_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `cht_label` varchar(50) DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `cht_order` int(11) DEFAULT NULL,
  `fk_acc_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`cht_id`) USING BTREE,
  KEY `FK_charge_type_cht_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_charge_type_cht_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_charge_type_cht_account_account_acc` (`fk_acc_id`) USING BTREE,
  KEY `charge_type_cht_fk_pam_id_foreign` (`fk_pam_id`),
  CONSTRAINT `FK_charge_type_cht_account_account_acc` FOREIGN KEY (`fk_acc_id`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_charge_type_cht_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_charge_type_cht_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `charge_type_cht_fk_pam_id_foreign` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. company_cop
CREATE TABLE IF NOT EXISTS `company_cop` (
  `cop_id` int(11) NOT NULL AUTO_INCREMENT,
  `cop_created` timestamp NULL DEFAULT NULL,
  `cop_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `cop_label` varchar(100) NOT NULL,
  `cop_address` varchar(500) NOT NULL,
  `cop_zip` varchar(10) NOT NULL,
  `cop_city` varchar(45) NOT NULL,
  `cop_country_code` varchar(2) NOT NULL DEFAULT 'FR',
  `cop_phone` varchar(20) DEFAULT NULL,
  `cop_url_site` varchar(255) DEFAULT NULL,
  `cop_registration_code` varchar(50) DEFAULT NULL,
  `cop_legal_status` varchar(50) DEFAULT NULL,
  `cop_rcs` varchar(50) DEFAULT NULL,
  `cop_capital` varchar(50) DEFAULT NULL,
  `cop_naf_code` varchar(50) DEFAULT NULL,
  `cop_tva_code` varchar(50) DEFAULT NULL,
  `fk_eml_id_sale` int(11) DEFAULT NULL,
  `fk_doc_id_logo_large` int(11) DEFAULT NULL,
  `fk_doc_id_logo_square` int(11) DEFAULT NULL,
  `fk_doc_id_logo_printable` int(11) DEFAULT NULL,
  `cop_cgv` varchar(255) DEFAULT NULL,
  `fk_emt_id_reset_password` int(11) DEFAULT NULL,
  `fk_emt_id_changed_password` int(11) DEFAULT NULL,
  `fk_eml_id_default` int(11) DEFAULT NULL,
  `cop_mail_parser` varchar(255) DEFAULT NULL,
  `cop_veryfi_client_id` varchar(255) DEFAULT NULL,
  `cop_veryfi_client_secret` varchar(255) DEFAULT NULL,
  `cop_veryfi_username` varchar(255) DEFAULT NULL,
  `cop_veryfi_api_key` varchar(255) DEFAULT NULL,
  `cop_siret` varchar(14) DEFAULT NULL COMMENT 'Numéro SIRET de l''entreprise (14 chiffres)',
  PRIMARY KEY (`cop_id`) USING BTREE,
  KEY `FK_company_cop_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_company_cop_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_company_cop_message_email_account_eml` (`fk_eml_id_sale`),
  KEY `FK_company_cop_document_doc_logo_square` (`fk_doc_id_logo_square`),
  KEY `FK_company_cop_document_doc_logo_dark` (`fk_doc_id_logo_large`) USING BTREE,
  KEY `FK_company_cop_document_doc_logo_printable` (`fk_doc_id_logo_printable`),
  KEY `FK_company_cop_message_template_emt` (`fk_emt_id_reset_password`),
  KEY `FK_company_cop_message_email_account_eml_2` (`fk_eml_id_default`),
  KEY `FK_company_cop_message_template_emt_changed_password` (`fk_emt_id_changed_password`),
  CONSTRAINT `FK_company_cop_document_doc_logo_large` FOREIGN KEY (`fk_doc_id_logo_large`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_company_cop_document_doc_logo_printable` FOREIGN KEY (`fk_doc_id_logo_printable`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_company_cop_document_doc_logo_square` FOREIGN KEY (`fk_doc_id_logo_square`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL,
  CONSTRAINT `FK_company_cop_message_email_account_eml` FOREIGN KEY (`fk_eml_id_sale`) REFERENCES `message_email_account_eml` (`eml_id`),
  CONSTRAINT `FK_company_cop_message_email_account_eml_2` FOREIGN KEY (`fk_eml_id_default`) REFERENCES `message_email_account_eml` (`eml_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_company_cop_message_template_emt` FOREIGN KEY (`fk_emt_id_reset_password`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_company_cop_message_template_emt_changed_password` FOREIGN KEY (`fk_emt_id_changed_password`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_company_cop_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_company_cop_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contact_ctc
CREATE TABLE IF NOT EXISTS `contact_ctc` (
  `ctc_id` int(11) NOT NULL AUTO_INCREMENT,
  `ctc_created` timestamp NULL DEFAULT NULL,
  `ctc_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `ctc_firstname` varchar(100) DEFAULT NULL,
  `ctc_lastname` varchar(100) DEFAULT NULL,
  `ctc_email` varchar(320) NOT NULL,
  `ctc_phone` varchar(20) DEFAULT NULL,
  `ctc_mobile` varchar(20) DEFAULT NULL,
  `ctc_job_title` varchar(50) DEFAULT NULL,
  `ctc_receive_invoice` tinyint(4) NOT NULL DEFAULT 0,
  `ctc_receive_saleorder` tinyint(4) NOT NULL DEFAULT 0,
  `ctc_is_active` tinyint(4) NOT NULL DEFAULT 0,
  `ctc_linkedin_url` varchar(2048) DEFAULT NULL,
  PRIMARY KEY (`ctc_id`) USING BTREE,
  UNIQUE KEY `usr_email` (`ctc_email`) USING BTREE,
  KEY `FK_contact_ctc_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_contact_ctc_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_contact_ctc_partner_ptr` (`fk_ptr_id`),
  CONSTRAINT `FK_contact_ctc_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_contact_ctc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contact_ctc_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3849 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci ROW_FORMAT=DYNAMIC;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contact_device_ctd
CREATE TABLE IF NOT EXISTS `contact_device_ctd` (
  `ctd_id` int(11) NOT NULL AUTO_INCREMENT,
  `ctd_updated` timestamp NULL DEFAULT NULL,
  `ctd_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_ctc_id` int(11) NOT NULL,
  `fk_dev_id` int(11) NOT NULL DEFAULT 0,
  `ctd_note` varchar(500) DEFAULT NULL,
  `ctd_valid` date DEFAULT NULL COMMENT 'Acquittement de l''écart',
  PRIMARY KEY (`ctd_id`) USING BTREE,
  UNIQUE KEY `fk_ctc_id_fk_dev_id` (`fk_ctc_id`,`fk_dev_id`),
  KEY `FK_tl_usrlic_usd_tr_user_usr` (`fk_ctc_id`) USING BTREE,
  KEY `FK_tl_usrdev_usd_tc_device_dev` (`fk_dev_id`) USING BTREE,
  KEY `FK_contact_device_ctd_user_usr` (`fk_usr_id_author`),
  KEY `FK_contact_device_ctd_user_usr_2` (`fk_usr_id_updater`),
  CONSTRAINT `FK_contact_device_ctd_user_usr` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contact_device_ctd_user_usr_2` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_tl_ctcdev_ctd_tc_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_tl_ctcdev_usd_tc_device_dev` FOREIGN KEY (`fk_dev_id`) REFERENCES `device_dev` (`dev_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=917 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contact_partner_ctp
CREATE TABLE IF NOT EXISTS `contact_partner_ctp` (
  `ctp_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fk_ctc_id` int(10) unsigned NOT NULL,
  `fk_ptr_id` int(10) unsigned NOT NULL,
  `ctp_created` timestamp NULL DEFAULT current_timestamp(),
  `ctp_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ctp_id`) USING BTREE,
  UNIQUE KEY `uq_ctc_ptr` (`fk_ctc_id`,`fk_ptr_id`) USING BTREE,
  KEY `fk_ptr_id` (`fk_ptr_id`) USING BTREE
) ENGINE=MyISAM AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contract_con
CREATE TABLE IF NOT EXISTS `contract_con` (
  `con_id` int(11) NOT NULL AUTO_INCREMENT,
  `con_created` timestamp NULL DEFAULT NULL,
  `con_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `con_label` varchar(255) NOT NULL,
  `con_operation` int(11) NOT NULL DEFAULT 0,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `con_ptr_address` varchar(255) DEFAULT NULL,
  `fk_ctc_id` int(11) DEFAULT NULL,
  `con_number` varchar(50) NOT NULL DEFAULT '0',
  `con_status` int(11) DEFAULT NULL,
  `con_being_edited` int(11) DEFAULT NULL,
  `con_note` varchar(255) DEFAULT '0',
  `con_date` date DEFAULT NULL,
  `con_end_commitment` date DEFAULT NULL,
  `con_is_invoicing_mgmt` tinyint(4) NOT NULL DEFAULT 0,
  `con_is_bulk_invoicing` tinyint(4) NOT NULL DEFAULT 0,
  `fk_ord_id` int(11) DEFAULT NULL,
  `fk_dur_id_commitment` int(11) DEFAULT NULL,
  `fk_dur_id_renew` int(11) DEFAULT NULL,
  `fk_dur_id_notice` int(11) DEFAULT NULL,
  `fk_dur_id_invoicing` int(11) DEFAULT NULL,
  `con_next_invoice_date` date DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition` int(11) DEFAULT NULL,
  `con_externalreference` varchar(50) DEFAULT NULL,
  `con_totalht` decimal(12,3) DEFAULT NULL,
  `con_totalhtcomm` decimal(12,3) DEFAULT NULL,
  `con_totalhtsub` decimal(12,3) DEFAULT NULL,
  `con_totaltax` decimal(12,3) DEFAULT NULL,
  `con_totalttc` decimal(12,3) DEFAULT NULL,
  `fk_usr_id_seller` int(11) DEFAULT NULL,
  `con_terminated_date` date DEFAULT NULL,
  `con_terminated_reason` varchar(255) DEFAULT NULL,
  `con_terminated_invoice_date` date DEFAULT NULL,
  `con_validation_data` mediumtext DEFAULT NULL,
  `fk_tap_id` int(11) DEFAULT NULL,
  `fk_doc_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`con_id`) USING BTREE,
  UNIQUE KEY `contract_con_con_number_unique` (`con_number`),
  KEY `FK_contract_con_sale_order_ord` (`fk_ord_id`),
  KEY `FK_contract_con_partner_ptr` (`fk_ptr_id`) USING BTREE,
  KEY `FK_contract_con_payment_mode_pam` (`fk_pam_id`),
  KEY `FK_contract_con_duration_dur_commitment` (`fk_dur_id_commitment`),
  KEY `FK_contract_con_duration_dur__renew` (`fk_dur_id_renew`),
  KEY `FK_contract_con_duration_dur_notice` (`fk_dur_id_notice`),
  KEY `FK_contract_con_duration_dur_invoicing` (`fk_dur_id_invoicing`),
  KEY `FK_contract_con_contact_ctc` (`fk_ctc_id`),
  KEY `FK_contract_con_duration_dur_payment_condition` (`fk_dur_id_payment_condition`),
  KEY `FK_contract_con_user_usr_seller` (`fk_usr_id_seller`),
  KEY `FK_contract_con_tax_position_tap` (`fk_tap_id`),
  KEY `FK_contract_con_document_doc` (`fk_doc_id`),
  KEY `FK_contract_con_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_contract_con_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_contract_con_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_contract_con_document_doc` FOREIGN KEY (`fk_doc_id`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_contract_con_duration_dur__renew` FOREIGN KEY (`fk_dur_id_renew`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_contract_con_duration_dur_commitment` FOREIGN KEY (`fk_dur_id_commitment`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_contract_con_duration_dur_invoicing` FOREIGN KEY (`fk_dur_id_invoicing`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_contract_con_duration_dur_notice` FOREIGN KEY (`fk_dur_id_notice`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_contract_con_duration_dur_payment_condition` FOREIGN KEY (`fk_dur_id_payment_condition`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_contract_con_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_contract_con_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_contract_con_sale_order_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`),
  CONSTRAINT `FK_contract_con_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_contract_con_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_contract_con_user_usr_seller` FOREIGN KEY (`fk_usr_id_seller`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contract_con_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contract_config_cco
CREATE TABLE IF NOT EXISTS `contract_config_cco` (
  `cco_id` int(11) NOT NULL AUTO_INCREMENT,
  `cco_updated` timestamp NOT NULL,
  `cco_created` timestamp NOT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_emt_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`cco_id`) USING BTREE,
  KEY `FK_contract_config_cco_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_contract_config_cco_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_contract_config_cco_message_template_emt` (`fk_emt_id`) USING BTREE,
  CONSTRAINT `FK_contract_config_cco_message_template_emt` FOREIGN KEY (`fk_emt_id`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_contract_config_cco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contract_config_cco_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contract_invoice_coi
CREATE TABLE IF NOT EXISTS `contract_invoice_coi` (
  `coi_id` int(11) NOT NULL AUTO_INCREMENT,
  `coi_updated` timestamp NULL DEFAULT NULL,
  `coi_created` timestamp NOT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_con_id` int(11) DEFAULT NULL,
  `fk_inv_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`coi_id`) USING BTREE,
  KEY `FK_contract_invoice_coi_coi_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_contract_invoice_coi_coi_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_contract_invoice_coi_contract_con` (`fk_con_id`),
  KEY `FK_contract_invoice_coi_invoice_inv` (`fk_inv_id`),
  CONSTRAINT `FK_contract_invoice_coi_contract_con` FOREIGN KEY (`fk_con_id`) REFERENCES `contract_con` (`con_id`),
  CONSTRAINT `FK_contract_invoice_coi_invoice_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_contract_invoice_coi_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contract_invoice_coi_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. contract_line_col
CREATE TABLE IF NOT EXISTS `contract_line_col` (
  `col_id` int(11) NOT NULL AUTO_INCREMENT,
  `col_created` timestamp NULL DEFAULT NULL,
  `col_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_con_id` int(11) DEFAULT NULL,
  `col_prtlib` varchar(150) NOT NULL DEFAULT '',
  `col_prtdesc` mediumtext DEFAULT NULL,
  `col_prttype` enum('conso','service') DEFAULT NULL,
  `col_note` varchar(100) DEFAULT NULL,
  `col_qty` decimal(12,2) DEFAULT NULL,
  `col_priceunitht` decimal(12,3) DEFAULT NULL,
  `col_discount` decimal(12,2) DEFAULT NULL,
  `col_is_subscription` tinyint(4) NOT NULL DEFAULT 0,
  `col_mtht` decimal(12,3) DEFAULT NULL,
  `fk_prt_id` int(11) DEFAULT NULL,
  `col_order` int(11) DEFAULT NULL,
  `col_type` int(11) DEFAULT NULL,
  `col_purchasepriceunitht` decimal(12,3) DEFAULT NULL,
  `col_tax_rate` decimal(5,2) DEFAULT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`col_id`) USING BTREE,
  KEY `FK_t_contract_line_col_product_prt` (`fk_prt_id`) USING BTREE,
  KEY `FK_contract_line_col_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_contract_line_col_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_contract_line_col_contract_con` (`fk_con_id`),
  KEY `FK_contract_line_col_tva_tva` (`fk_tax_id`) USING BTREE,
  CONSTRAINT `FK_contract_line_col_contract_con` FOREIGN KEY (`fk_con_id`) REFERENCES `contract_con` (`con_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_contract_line_col_product_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_contract_line_col_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_contract_line_col_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_contract_line_col_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=709 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. country_cty
CREATE TABLE IF NOT EXISTS `country_cty` (
  `cty_code` char(2) NOT NULL COMMENT 'Code ISO 3166-1 alpha-2',
  `cty_name` varchar(100) NOT NULL COMMENT 'Nom du pays en français',
  `cty_is_eu` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 si membre de l''UE',
  PRIMARY KEY (`cty_code`),
  KEY `idx_cty_name` (`cty_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Référentiel des pays ISO 3166-1 alpha-2';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. cron_task_cta
CREATE TABLE IF NOT EXISTS `cron_task_cta` (
  `cta_id` int(11) NOT NULL AUTO_INCREMENT,
  `cta_created` timestamp NULL DEFAULT NULL COMMENT 'Date de création',
  `cta_updated` timestamp NULL DEFAULT NULL COMMENT 'Date de dernière modification',
  `fk_usr_id_author` int(11) DEFAULT NULL COMMENT 'Utilisateur créateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL COMMENT 'Utilisateur modificateur',
  `cta_label` varchar(255) DEFAULT NULL COMMENT 'Libellé de la tâche',
  `cta_is_active` tinyint(4) NOT NULL DEFAULT 0,
  `cta_description` text DEFAULT NULL COMMENT 'Description détaillée de la tâche',
  `cta_task_class` varchar(255) NOT NULL COMMENT 'Nom complet de la classe (namespace + classe)',
  `cta_interval_seconds` int(11) NOT NULL DEFAULT 3600 COMMENT 'Intervalle en secondes',
  `cta_last_execution` datetime DEFAULT NULL COMMENT 'Date et heure de la dernière exécution',
  `cta_last_status` varchar(50) DEFAULT NULL COMMENT 'Statut de la dernière exécution (success/failure)',
  `cta_last_message` text DEFAULT NULL COMMENT 'Message de la dernière exécution',
  PRIMARY KEY (`cta_id`) USING BTREE,
  KEY `fk_usr_id_author` (`fk_usr_id_author`) USING BTREE,
  KEY `fk_usr_id_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `cron_task_cta_ibfk_1` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cron_task_cta_ibfk_2` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Tâches planifiées';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. delivery_note_dln
CREATE TABLE IF NOT EXISTS `delivery_note_dln` (
  `dln_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID du bon de livraison',
  `dln_created` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Date de création',
  `dln_updated` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() COMMENT 'Date de dernière modification',
  `fk_usr_id_author` int(11) NOT NULL COMMENT 'ID utilisateur créateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL COMMENT 'ID utilisateur modificateur',
  `dln_number` varchar(50) NOT NULL COMMENT 'Numéro du bon de livraison',
  `dln_operation` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Client (livraison), 2=Fournisseur (réception)',
  `dln_date` date NOT NULL COMMENT 'Date du bon de livraison',
  `dln_expected_date` date DEFAULT NULL COMMENT 'Date de livraison prévue',
  `dln_externalreference` varchar(100) DEFAULT NULL COMMENT 'Référence externe (ex: N° commande client)',
  `fk_ptr_id` int(11) NOT NULL COMMENT 'ID du tiers (client ou fournisseur)',
  `dln_ptr_name` varchar(255) DEFAULT NULL COMMENT 'Nom du partenaire (snapshot)',
  `dln_ptr_address` text DEFAULT NULL COMMENT 'Adresse du partenaire (snapshot)',
  `dln_ptr_zip` varchar(10) DEFAULT NULL COMMENT 'Code postal du partenaire (snapshot)',
  `dln_ptr_city` varchar(100) DEFAULT NULL COMMENT 'Ville du partenaire (snapshot)',
  `dln_ptr_country` varchar(100) DEFAULT NULL COMMENT 'Pays du partenaire (snapshot)',
  `fk_ctc_id` int(11) DEFAULT NULL COMMENT 'ID du contact',
  `fk_ord_id` int(11) DEFAULT NULL COMMENT 'ID de la commande client liée',
  `fk_por_id` int(11) DEFAULT NULL COMMENT 'ID de la commande fournisseur liée',
  `dln_status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=Brouillon, 1=Validé, 2=Expédié, 3=Livré, 4=Annulé',
  `dln_being_edited` tinyint(4) NOT NULL DEFAULT 0,
  `dln_carrier` varchar(100) DEFAULT NULL COMMENT 'Nom du transporteur',
  `dln_tracking_number` varchar(100) DEFAULT NULL COMMENT 'Numéro de suivi',
  `dln_delivery_address` text DEFAULT NULL COMMENT 'Adresse de livraison',
  `dln_note` text DEFAULT NULL COMMENT 'Notes internes',
  `dln_validation_token` varchar(64) DEFAULT NULL COMMENT 'Token pour signature électronique',
  `dln_token_expiry` datetime DEFAULT NULL COMMENT 'Date d''expiration du token',
  `dln_signed_at` datetime DEFAULT NULL COMMENT 'Date de signature',
  `dln_signed_by` varchar(100) DEFAULT NULL COMMENT 'Signataire',
  `fk_whs_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`dln_id`) USING BTREE,
  UNIQUE KEY `uk_dln_number` (`dln_number`) USING BTREE,
  KEY `idx_dln_operation` (`dln_operation`) USING BTREE,
  KEY `idx_dln_status` (`dln_status`) USING BTREE,
  KEY `idx_dln_date` (`dln_date`) USING BTREE,
  KEY `idx_dln_ptr` (`fk_ptr_id`) USING BTREE,
  KEY `idx_dln_ord` (`fk_ord_id`) USING BTREE,
  KEY `idx_dln_por` (`fk_por_id`) USING BTREE,
  KEY `idx_dln_validation_token` (`dln_validation_token`) USING BTREE,
  KEY `fk_dln_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `idx_dln_expected_date` (`dln_expected_date`) USING BTREE,
  KEY `fk_dln_ctc` (`fk_ctc_id`) USING BTREE,
  KEY `fk_dln_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `idx_dln_created` (`dln_created`) USING BTREE,
  KEY `FK_delivery_note_dln_warehouse_whs` (`fk_whs_id`),
  CONSTRAINT `FK_delivery_note_dln_warehouse_whs` FOREIGN KEY (`fk_whs_id`) REFERENCES `warehouse_whs` (`whs_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_dln_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`),
  CONSTRAINT `fk_dln_por` FOREIGN KEY (`fk_por_id`) REFERENCES `purchase_order_por` (`por_id`),
  CONSTRAINT `fk_dln_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `fk_dln_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `fk_dln_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Bons de livraison client et bons de réception fournisseur';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. delivery_note_line_dnl
CREATE TABLE IF NOT EXISTS `delivery_note_line_dnl` (
  `dnl_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID de la ligne',
  `dnl_created` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Date de création',
  `dnl_updated` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp() COMMENT 'Date de dernière modification',
  `fk_usr_id_author` int(11) NOT NULL COMMENT 'ID utilisateur créateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL COMMENT 'ID utilisateur modificateur',
  `fk_dln_id` int(11) NOT NULL COMMENT 'ID du bon de livraison',
  `dnl_type` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=Ligne produit, 1=Titre, 2=Sous-total',
  `dnl_order` int(11) NOT NULL DEFAULT 0 COMMENT 'Ordre d''affichage',
  `fk_prt_id` int(11) DEFAULT NULL COMMENT 'ID du produit',
  `dnl_prtlib` varchar(255) DEFAULT NULL COMMENT 'Libellé du produit',
  `dnl_prtdesc` text DEFAULT NULL COMMENT 'Description du produit',
  `dnl_prttype` enum('conso','service') DEFAULT NULL,
  `dnl_qty` decimal(15,2) NOT NULL DEFAULT 1.00 COMMENT 'Quantité',
  `dnl_qty_unit` varchar(20) DEFAULT 'pce' COMMENT 'Unité de mesure',
  `dnl_lot_number` varchar(255) DEFAULT NULL COMMENT 'Numéro de lot',
  `dnl_serial_number` varchar(255) DEFAULT NULL COMMENT 'Numéro de série',
  `dnl_expiry_date` date DEFAULT NULL COMMENT 'Date de péremption',
  `fk_orl_id` int(11) DEFAULT NULL COMMENT 'ID de la ligne de commande client',
  `fk_pol_id` int(11) DEFAULT NULL COMMENT 'ID de la ligne de commande fournisseur',
  `dnl_note` text DEFAULT NULL COMMENT 'Note sur la ligne',
  PRIMARY KEY (`dnl_id`) USING BTREE,
  KEY `idx_dnl_dln` (`fk_dln_id`) USING BTREE,
  KEY `idx_dnl_prt` (`fk_prt_id`) USING BTREE,
  KEY `idx_dnl_order` (`dnl_order`) USING BTREE,
  KEY `idx_dnl_orl` (`fk_orl_id`) USING BTREE,
  KEY `idx_dnl_pol` (`fk_pol_id`) USING BTREE,
  KEY `fk_dnl_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `idx_dnl_type` (`dnl_type`) USING BTREE,
  KEY `idx_dnl_lot` (`dnl_lot_number`) USING BTREE,
  KEY `idx_dnl_serial` (`dnl_serial_number`) USING BTREE,
  KEY `fk_dnl_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `fk_dnl_dln` FOREIGN KEY (`fk_dln_id`) REFERENCES `delivery_note_dln` (`dln_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dnl_orl` FOREIGN KEY (`fk_orl_id`) REFERENCES `sale_order_line_orl` (`orl_id`),
  CONSTRAINT `fk_dnl_pol` FOREIGN KEY (`fk_pol_id`) REFERENCES `purchase_order_line_pol` (`pol_id`),
  CONSTRAINT `fk_dnl_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `fk_dnl_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `fk_dnl_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Lignes des bons de livraison';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. device_dev
CREATE TABLE IF NOT EXISTS `device_dev` (
  `dev_id` int(11) NOT NULL AUTO_INCREMENT,
  `dev_created` timestamp NULL DEFAULT NULL,
  `dev_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `dev_hostname` varchar(50) NOT NULL COMMENT 'Libelle',
  `dev_serial` varchar(255) DEFAULT NULL,
  `dev_dattoid` int(11) DEFAULT NULL,
  `dev_lastloggedinuser` varchar(320) DEFAULT NULL,
  `dev_dattowebremoteurl` varchar(320) DEFAULT NULL,
  `dev_os` varchar(320) DEFAULT NULL,
  `dev_localisation` varchar(100) DEFAULT NULL,
  `dev_lastseen` datetime DEFAULT NULL,
  `dev_is_active` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`dev_id`) USING BTREE,
  UNIQUE KEY `dev_dattoid` (`dev_dattoid`),
  KEY `FK_device_dev_partner_ptr` (`fk_ptr_id`),
  KEY `FK_device_dev_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_device_dev_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_device_dev_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_device_dev_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_device_dev_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4810 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Devices';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. document_doc
CREATE TABLE IF NOT EXISTS `document_doc` (
  `doc_id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_created` timestamp NULL DEFAULT NULL,
  `doc_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `doc_filename` varchar(255) NOT NULL,
  `doc_securefilename` varchar(255) DEFAULT NULL,
  `doc_filetype` varchar(150) DEFAULT NULL,
  `doc_filesize` double DEFAULT NULL,
  `doc_filepath` varchar(255) DEFAULT NULL,
  `doc_filecontent` mediumtext DEFAULT NULL,
  `fk_inv_id` int(11) DEFAULT NULL,
  `fk_ord_id` int(11) DEFAULT NULL,
  `fk_por_id` int(11) DEFAULT NULL,
  `fk_con_id` int(11) DEFAULT NULL,
  `fk_tka_id` int(11) DEFAULT NULL,
  `fk_aba_id` int(11) DEFAULT NULL,
  `fk_aex_id` int(11) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_aie_id` int(11) DEFAULT NULL,
  `fk_che_id` int(11) DEFAULT NULL,
  `fk_abr_id` int(11) DEFAULT NULL,
  `fk_dln_id` int(11) DEFAULT NULL,
  `fk_exp_id` bigint(20) unsigned DEFAULT NULL,
  `fk_vhc_id` bigint(20) unsigned DEFAULT NULL,
  `fk_opp_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`doc_id`) USING BTREE,
  KEY `FK_document_doc_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_document_doc_user_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_document_doc_invoice_inv` (`fk_inv_id`),
  KEY `FK_document_doc_purchase_order_por` (`fk_por_id`),
  KEY `FK_document_doc_sale_order_ord` (`fk_ord_id`),
  KEY `FK_document_doc_contract_con` (`fk_con_id`),
  KEY `FK_document_doc_ticket_article_tka` (`fk_tka_id`),
  KEY `FK_document_doc_account_backup_aba` (`fk_aba_id`),
  KEY `FK_document_doc_account_exercise_aex` (`fk_aex_id`),
  KEY `FK_document_doc_partner_ptr` (`fk_ptr_id`),
  KEY `FK_document_doc_account_import_export_aie` (`fk_aie_id`),
  KEY `FK_document_doc_charge_che` (`fk_che_id`),
  KEY `FK_document_doc_account_bank_reconciliation_abr` (`fk_abr_id`),
  KEY `FK_document_doc_delivery_note_dln` (`fk_dln_id`),
  KEY `FK_document_doc_expenses_exp` (`fk_exp_id`),
  KEY `idx_doc_vhc` (`fk_vhc_id`),
  KEY `document_doc_fk_opp_id_index` (`fk_opp_id`),
  FULLTEXT KEY `doc_filecontent` (`doc_filecontent`),
  CONSTRAINT `FK_document_doc_account_backup_aba` FOREIGN KEY (`fk_aba_id`) REFERENCES `account_backup_aba` (`aba_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_account_bank_reconciliation_abr` FOREIGN KEY (`fk_abr_id`) REFERENCES `account_bank_reconciliation_abr` (`abr_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_document_doc_account_exercise_aex` FOREIGN KEY (`fk_aex_id`) REFERENCES `account_exercise_aex` (`aex_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_account_import_export_aie` FOREIGN KEY (`fk_aie_id`) REFERENCES `account_import_export_aie` (`aie_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_charge_che` FOREIGN KEY (`fk_che_id`) REFERENCES `charge_che` (`che_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_document_doc_contract_con` FOREIGN KEY (`fk_con_id`) REFERENCES `contract_con` (`con_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_delivery_note_dln` FOREIGN KEY (`fk_dln_id`) REFERENCES `delivery_note_dln` (`dln_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_document_doc_expenses_exp` FOREIGN KEY (`fk_exp_id`) REFERENCES `expenses_exp` (`exp_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_document_doc_invoice_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_purchase_order_por` FOREIGN KEY (`fk_por_id`) REFERENCES `purchase_order_por` (`por_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_sale_order_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_ticket_article_tka` FOREIGN KEY (`fk_tka_id`) REFERENCES `ticket_article_tka` (`tka_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_document_doc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_document_doc_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_document_doc_vehicle_vhc` FOREIGN KEY (`fk_vhc_id`) REFERENCES `vehicle_vhc` (`vhc_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `document_doc_fk_opp_id_foreign` FOREIGN KEY (`fk_opp_id`) REFERENCES `prospect_opportunity_opp` (`opp_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=918 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. duration_dur
CREATE TABLE IF NOT EXISTS `duration_dur` (
  `dur_id` int(11) NOT NULL AUTO_INCREMENT,
  `dur_created` timestamp NULL DEFAULT NULL,
  `dur_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `dur_reference` int(11) DEFAULT NULL COMMENT '1: Durée abonnement\r\n2: Durée de préavis contrat\r\n3: Durée de renouvellement contrat\r\n4: Fréquence de facturation contrat\r\n5: Condition de Reglement \r\n6: Durée de validité d''un devis',
  `dur_label` varchar(150) NOT NULL,
  `dur_order` int(11) DEFAULT NULL,
  `dur_value` int(11) DEFAULT NULL,
  `dur_time_unit` varchar(50) NOT NULL,
  `dur_mode` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`dur_id`) USING BTREE,
  KEY `FK_duration_dur_duration_dur_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_duration_dur_dur_updater` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_duration_dur_user_usr` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_duration_dur_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_duration_dur_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. einvoicing_config_eic
CREATE TABLE IF NOT EXISTS `einvoicing_config_eic` (
  `eic_id` int(11) NOT NULL AUTO_INCREMENT,
  `eic_created` timestamp NULL DEFAULT NULL,
  `eic_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `eic_pdp_profile` varchar(50) NOT NULL DEFAULT 'custom' COMMENT 'Profil de connexion PA (custom)',
  `eic_pdp_adapter` varchar(50) NOT NULL DEFAULT 'generic' COMMENT 'Adaptateur PHP résolu par PdpClientFactory',
  `eic_api_url` varchar(255) DEFAULT NULL COMMENT 'URL de base de l''API PA ',
  `eic_token_url` varchar(255) DEFAULT NULL COMMENT 'URL du serveur OAuth2 — endpoint /token',
  `eic_client_id` varchar(255) DEFAULT NULL COMMENT 'API Client ID OAuth2 fourni par le PA',
  `eic_client_secret` text DEFAULT NULL COMMENT 'API Client Secret OAuth2 fourni par le PA',
  `eic_customer_id` varchar(100) DEFAULT NULL COMMENT 'Identifiant client (CustomerId)',
  `eic_oauth_token` text DEFAULT NULL COMMENT 'Cache du Bearer token OAuth2 (géré automatiquement, ne pas modifier)',
  `eic_oauth_expires_at` timestamp NULL DEFAULT NULL COMMENT 'Date d''expiration du token OAuth2 mis en cache',
  `eic_webhook_secret` varchar(255) DEFAULT NULL COMMENT 'Secret Webhook — HMAC partagé avec le PA pour valider les callbacks',
  `eic_business_entity_id` varchar(100) DEFAULT NULL COMMENT 'Identifiant de l''entité enregistrée chez le PA',
  `eic_entity_registered` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = entreprise enregistrée chez le PA',
  `eic_auto_transmit` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = transmission automatique à la validation de la facture',
  `eic_validate_before_send` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = valider le format Facture-X avant envoi',
  `eic_facturex_profile` varchar(20) NOT NULL DEFAULT 'EN16931' COMMENT 'Profil Facture-X (MINIMUM, BASIC, EN16931, EXTENDED)',
  PRIMARY KEY (`eic_id`),
  KEY `FK_einvoicing_config_usr_author` (`fk_usr_id_author`),
  KEY `FK_einvoicing_config_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_einvoicing_config_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_einvoicing_config_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Configuration du PA/PDP pour la facturation électronique';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. einvoicing_ereporting_eer
CREATE TABLE IF NOT EXISTS `einvoicing_ereporting_eer` (
  `eer_id` int(11) NOT NULL AUTO_INCREMENT,
  `eer_created` timestamp NULL DEFAULT NULL,
  `eer_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `eer_period` varchar(7) NOT NULL COMMENT 'Période au format YYYY-MM',
  `eer_type` enum('B2C','B2B_INTL') NOT NULL COMMENT 'Type de transaction',
  `eer_status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, TRANSMITTED, ERROR',
  `eer_pa_declaration_id` varchar(100) DEFAULT NULL COMMENT 'Identifiant de la déclaration chez le PA',
  `eer_amount_ht` decimal(15,3) DEFAULT NULL COMMENT 'Total HT agrégé sur la période',
  `eer_amount_ttc` decimal(15,3) DEFAULT NULL COMMENT 'Total TTC agrégé sur la période',
  `eer_transmitted_at` timestamp NULL DEFAULT NULL,
  `eer_pa_response` text DEFAULT NULL,
  `eer_invoice_ids` text DEFAULT NULL COMMENT 'JSON: liste des inv_id inclus dans cet e-reporting',
  PRIMARY KEY (`eer_id`),
  UNIQUE KEY `uk_eer_period_type` (`eer_period`,`eer_type`),
  KEY `FK_einvoicing_ereporting_usr` (`fk_usr_id_author`),
  CONSTRAINT `FK_einvoicing_ereporting_usr` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Données d''e-reporting à transmettre au PA';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. einvoicing_received_eir
CREATE TABLE IF NOT EXISTS `einvoicing_received_eir` (
  `eir_id` int(11) NOT NULL AUTO_INCREMENT,
  `eir_created` timestamp NULL DEFAULT NULL,
  `eir_updated` timestamp NULL DEFAULT NULL,
  `eir_pa_invoice_id` varchar(100) NOT NULL COMMENT 'ID unique de la facture chez le PA',
  `eir_our_status` varchar(50) NOT NULL DEFAULT 'PENDING' COMMENT 'Statut que nous déclarons: PENDING, ACCEPTEE, REFUSEE, EN_PAIEMENT, PAYEE',
  `eir_pa_status` varchar(50) DEFAULT NULL COMMENT 'Statut reçu du PA',
  `eir_sender_siren` varchar(14) DEFAULT NULL,
  `eir_sender_siret` varchar(14) DEFAULT NULL,
  `eir_sender_name` varchar(255) DEFAULT NULL,
  `eir_sender_vat_number` varchar(20) DEFAULT NULL,
  `eir_invoice_number` varchar(50) DEFAULT NULL,
  `eir_invoice_date` date DEFAULT NULL,
  `eir_due_date` date DEFAULT NULL,
  `eir_amount_ht` decimal(12,3) DEFAULT NULL,
  `eir_amount_ttc` decimal(12,3) DEFAULT NULL,
  `eir_currency` char(3) DEFAULT 'EUR',
  `eir_facturex_path` varchar(500) DEFAULT NULL COMMENT 'Chemin relatif du fichier Facture-X reçu et stocké',
  `eir_raw_payload` mediumtext DEFAULT NULL COMMENT 'Payload JSON complet du webhook',
  `eir_imported_at` timestamp NULL DEFAULT NULL COMMENT 'Date d''import comme facture fournisseur (NULL si non importé)',
  `fk_inv_id` int(11) DEFAULT NULL COMMENT 'Lien vers la facture fournisseur créée après import',
  PRIMARY KEY (`eir_id`),
  UNIQUE KEY `uk_eir_pa_invoice_id` (`eir_pa_invoice_id`),
  KEY `FK_einvoicing_received_inv` (`fk_inv_id`),
  KEY `idx_eir_status` (`eir_our_status`),
  CONSTRAINT `FK_einvoicing_received_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Factures électroniques reçues via le PA/PDP';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. einvoicing_transmission_eit
CREATE TABLE IF NOT EXISTS `einvoicing_transmission_eit` (
  `eit_id` int(11) NOT NULL AUTO_INCREMENT,
  `eit_created` timestamp NULL DEFAULT NULL,
  `eit_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_inv_id` int(11) NOT NULL,
  `eit_pa_file_id` varchar(100) DEFAULT NULL COMMENT 'ID fichier retourné par le PA après génération Facture-X',
  `eit_pa_invoice_id` varchar(100) DEFAULT NULL COMMENT 'ID facture retourné par le PA après envoi PDP',
  `eit_status` varchar(50) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, DEPOSEE, QUALIFIEE, MISE_A_DISPO, ACCEPTEE, REFUSEE, EN_PAIEMENT, PAYEE, LITIGE, ERROR',
  `eit_transmitted_at` timestamp NULL DEFAULT NULL,
  `eit_last_event_at` timestamp NULL DEFAULT NULL,
  `eit_facturex_path` varchar(500) DEFAULT NULL COMMENT 'Chemin relatif du fichier Facture-X stocké',
  `eit_error_message` text DEFAULT NULL,
  `eit_pa_response` text DEFAULT NULL COMMENT 'Dernière réponse JSON brute du PA',
  PRIMARY KEY (`eit_id`),
  KEY `FK_einvoicing_transmission_inv` (`fk_inv_id`),
  KEY `FK_einvoicing_transmission_usr` (`fk_usr_id_author`),
  KEY `idx_eit_status` (`eit_status`),
  KEY `idx_eit_pa_invoice_id` (`eit_pa_invoice_id`),
  CONSTRAINT `FK_einvoicing_transmission_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_einvoicing_transmission_usr` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Journal des factures transmises au PA/PDP';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. expense_categories_exc
CREATE TABLE IF NOT EXISTS `expense_categories_exc` (
  `exc_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exc_created_at` timestamp NULL DEFAULT current_timestamp(),
  `exc_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `exc_name` varchar(100) NOT NULL,
  `exc_code` varchar(50) NOT NULL,
  `exc_description` text DEFAULT NULL,
  `exc_icon` varchar(50) DEFAULT NULL,
  `exc_color` varchar(20) DEFAULT NULL,
  `exc_is_active` tinyint(4) NOT NULL DEFAULT 1,
  `exc_requires_receipt` tinyint(4) NOT NULL DEFAULT 1,
  `exc_max_amount` decimal(10,2) DEFAULT NULL,
  `fk_acc_id` int(11) NOT NULL,
  `exc_type` enum('conso','service') NOT NULL DEFAULT 'conso',
  PRIMARY KEY (`exc_id`),
  UNIQUE KEY `expense_categories_exc_exc_code_unique` (`exc_code`),
  KEY `idx_exc_code` (`exc_code`),
  KEY `idx_exc_is_active` (`exc_is_active`),
  KEY `FK_expense_categories_exc_account_account_acc` (`fk_acc_id`),
  CONSTRAINT `FK_expense_categories_exc_account_account_acc` FOREIGN KEY (`fk_acc_id`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. expense_config_eco
CREATE TABLE IF NOT EXISTS `expense_config_eco` (
  `eco_id` int(11) NOT NULL AUTO_INCREMENT,
  `eco_updated` timestamp NULL DEFAULT NULL,
  `eco_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `eco_ocr_enable` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`eco_id`),
  KEY `FK_expense_config_eco_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_expense_config_eco_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_expense_config_eco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_expense_config_eco_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. expense_lines_exl
CREATE TABLE IF NOT EXISTS `expense_lines_exl` (
  `exl_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exl_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `exl_created_at` timestamp NULL DEFAULT current_timestamp(),
  `fk_exp_id` bigint(20) unsigned NOT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  `exl_tax_rate` decimal(10,2) DEFAULT NULL,
  `exl_amount_ht` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exl_amount_tva` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exl_amount_ttc` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`exl_id`),
  KEY `idx_exl_expense_id` (`fk_exp_id`),
  KEY `FK_expense_lines_exl_tax_tax` (`fk_tax_id`),
  CONSTRAINT `FK_expense_lines_exl_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_exl_expense_id` FOREIGN KEY (`fk_exp_id`) REFERENCES `expenses_exp` (`exp_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. expense_reports_exr
CREATE TABLE IF NOT EXISTS `expense_reports_exr` (
  `exr_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exr_created_at` timestamp NULL DEFAULT current_timestamp(),
  `exr_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_usr_id` int(11) NOT NULL DEFAULT 0,
  `exr_number` varchar(50) NOT NULL,
  `exr_title` varchar(255) DEFAULT NULL,
  `exr_description` text DEFAULT NULL,
  `exr_period_from` date DEFAULT NULL,
  `exr_period_to` date DEFAULT NULL,
  `exr_status` enum('draft','submitted','approved','rejected','accounted') NOT NULL DEFAULT 'draft',
  `exr_submission_date` datetime DEFAULT NULL,
  `exr_approval_date` datetime DEFAULT NULL,
  `fk_usr_id_approved_by` int(11) DEFAULT NULL,
  `exr_rejection_reason` text DEFAULT NULL,
  `exr_total_amount_ht` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exr_total_amount_ttc` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exr_total_tva` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exr_amount_remaining` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exr_payment_progress` int(11) NOT NULL DEFAULT 0,
  `exr_deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`exr_id`),
  UNIQUE KEY `expense_reports_exr_exr_number_unique` (`exr_number`),
  KEY `idx_exr_status` (`exr_status`),
  KEY `idx_exr_submission_date` (`exr_submission_date`),
  KEY `idx_exr_user_id` (`fk_usr_id`),
  KEY `idx_exr_approved_by` (`fk_usr_id_approved_by`),
  KEY `idx_exr_reference` (`exr_number`),
  CONSTRAINT `FK_expense_reports_exr_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_expense_reports_exr_user_usr_2` FOREIGN KEY (`fk_usr_id_approved_by`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. expenses_exp
CREATE TABLE IF NOT EXISTS `expenses_exp` (
  `exp_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exp_created_at` timestamp NULL DEFAULT current_timestamp(),
  `exp_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_exr_id` bigint(20) unsigned NOT NULL,
  `fk_exc_id` bigint(20) unsigned NOT NULL,
  `exp_date` date NOT NULL,
  `exp_merchant` varchar(255) NOT NULL,
  `exp_total_amount_ht` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exp_total_amount_ttc` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exp_total_tva` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exp_notes` text DEFAULT NULL,
  PRIMARY KEY (`exp_id`),
  KEY `idx_exp_date` (`exp_date`),
  KEY `idx_exp_expense_report_id` (`fk_exr_id`),
  KEY `idx_exp_expense_category_id` (`fk_exc_id`),
  CONSTRAINT `fk_exp_expense_category_id` FOREIGN KEY (`fk_exc_id`) REFERENCES `expense_categories_exc` (`exc_id`),
  CONSTRAINT `fk_exp_expense_report_id` FOREIGN KEY (`fk_exr_id`) REFERENCES `expense_reports_exr` (`exr_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. failed_jobs
CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(191) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. invoice_config_ico
CREATE TABLE IF NOT EXISTS `invoice_config_ico` (
  `ico_id` int(11) NOT NULL AUTO_INCREMENT,
  `ico_updated` timestamp NOT NULL,
  `ico_created` timestamp NOT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_emt_id_invoice` int(11) DEFAULT NULL,
  `fk_eml_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`ico_id`) USING BTREE,
  KEY `FK_invoice_config_ico_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_invoice_config_ico_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_invoice_config_ico_message_email_account_eml` (`fk_eml_id`),
  KEY `FK_invoice_config_ico_message_template_emt` (`fk_emt_id_invoice`) USING BTREE,
  CONSTRAINT `FK_invoice_config_ico_message_email_account_eml` FOREIGN KEY (`fk_eml_id`) REFERENCES `message_email_account_eml` (`eml_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_invoice_config_ico_message_template_emt` FOREIGN KEY (`fk_emt_id_invoice`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_invoice_config_ico_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_invoice_config_ico_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. invoice_inv
CREATE TABLE IF NOT EXISTS `invoice_inv` (
  `inv_id` int(11) NOT NULL AUTO_INCREMENT,
  `inv_created` timestamp NULL DEFAULT NULL,
  `inv_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `inv_operation` int(11) NOT NULL COMMENT '1 => custinvoice, 2 => custrefund, 3 => supplierinvoice, 4 => supplierrefund, 5 => custdeposit, 6 => supplierdeposit',
  `inv_number` varchar(30) NOT NULL,
  `inv_externalreference` varchar(50) DEFAULT NULL,
  `inv_date` date NOT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_ctc_id` int(11) DEFAULT NULL,
  `inv_ptr_address` varchar(255) DEFAULT NULL,
  `inv_duedate` date NOT NULL,
  `inv_status` int(11) DEFAULT NULL,
  `inv_totalht` decimal(12,3) DEFAULT NULL,
  `inv_totaltax` decimal(12,3) DEFAULT NULL,
  `inv_totalttc` decimal(12,3) DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition` int(11) DEFAULT NULL,
  `inv_amount_remaining` decimal(12,3) DEFAULT NULL,
  `inv_payment_progress` int(11) DEFAULT NULL,
  `fk_ord_id` int(11) DEFAULT NULL,
  `fk_por_id` int(11) DEFAULT NULL,
  `inv_note` varchar(255) DEFAULT NULL,
  `fk_inv_id` int(11) DEFAULT NULL,
  `fk_usr_id_seller` int(11) DEFAULT NULL,
  `fk_tap_id` int(11) DEFAULT NULL,
  `fk_doc_id` int(11) DEFAULT NULL,
  `inv_being_edited` tinyint(4) NOT NULL DEFAULT 0,
  `inv_delivery_address` text DEFAULT NULL,
  PRIMARY KEY (`inv_id`) USING BTREE,
  UNIQUE KEY `inv_number` (`inv_number`) USING BTREE,
  KEY `FK_tc_propal_ppr_tr_user_usr` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_invoice_inv_t_payment_mode_pam` (`fk_pam_id`) USING BTREE,
  KEY `FK_tc_propal_ppr_tr_user_usr_2` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_tc_propal_ppr_tc_client_clt` (`fk_ptr_id`) USING BTREE,
  KEY `FK_invoice_inv_contact_ctc` (`fk_ctc_id`),
  KEY `FK_invoice_inv_purchase_order_por` (`fk_por_id`),
  KEY `FK_invoice_inv_sale_order_ord` (`fk_ord_id`),
  KEY `FK_invoice_inv_invoice_inv_refund` (`fk_inv_id`),
  KEY `FK_invoice_inv_duration_dur_payment_condition` (`fk_dur_id_payment_condition`) USING BTREE,
  KEY `FK_invoice_inv_user_usr_seller` (`fk_usr_id_seller`),
  KEY `FK_invoice_inv_tax_position_tap` (`fk_tap_id`),
  KEY `FK_invoice_inv_document_doc` (`fk_doc_id`),
  CONSTRAINT `FK_invoice_inv_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_invoice_inv_document_doc` FOREIGN KEY (`fk_doc_id`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_invoice_inv_duration_dur_payment_condition` FOREIGN KEY (`fk_dur_id_payment_condition`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_invoice_inv_invoice_inv_refund` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`),
  CONSTRAINT `FK_invoice_inv_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_invoice_inv_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_invoice_inv_purchase_order_por` FOREIGN KEY (`fk_por_id`) REFERENCES `purchase_order_por` (`por_id`),
  CONSTRAINT `FK_invoice_inv_sale_order_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`),
  CONSTRAINT `FK_invoice_inv_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`),
  CONSTRAINT `FK_invoice_inv_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_invoice_inv_user_usr_seller` FOREIGN KEY (`fk_usr_id_seller`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_invoice_inv_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=456 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. invoice_line_inl
CREATE TABLE IF NOT EXISTS `invoice_line_inl` (
  `inl_id` int(11) NOT NULL AUTO_INCREMENT,
  `inl_created` timestamp NULL DEFAULT NULL,
  `inl_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_inv_id` int(11) DEFAULT NULL,
  `inl_prtlib` varchar(150) NOT NULL DEFAULT '',
  `inl_prtdesc` mediumtext DEFAULT NULL,
  `inl_prttype` enum('conso','service') DEFAULT NULL,
  `inl_is_subscription` tinyint(4) NOT NULL DEFAULT 0,
  `inl_note` varchar(100) DEFAULT NULL,
  `inl_qty` decimal(12,2) DEFAULT NULL,
  `inl_priceunitht` decimal(12,3) DEFAULT NULL,
  `inl_discount` decimal(12,2) DEFAULT NULL,
  `inl_mtht` decimal(12,3) DEFAULT NULL,
  `fk_prt_id` int(11) DEFAULT NULL,
  `inl_order` int(11) DEFAULT NULL,
  `inl_type` int(11) DEFAULT NULL,
  `inl_purchasepriceunitht` decimal(12,3) DEFAULT NULL,
  `fk_orl_id` int(11) DEFAULT NULL,
  `fk_pol_id` int(11) DEFAULT NULL,
  `fk_inl_id` int(11) DEFAULT NULL,
  `fk_col_id` int(11) DEFAULT NULL,
  `inl_tax_rate` decimal(5,2) DEFAULT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`inl_id`) USING BTREE,
  KEY `FK_t_invoice_line_inl_tr_product_prt` (`fk_prt_id`) USING BTREE,
  KEY `FK_invoice_line_inl_purchase_order_pol` (`fk_pol_id`),
  KEY `FK_invoice_line_inl_sale_order_line_orl` (`fk_orl_id`),
  KEY `FK_invoice_line_inl_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_invoice_line_inl_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_invoice_line_inl_invoice_inv` (`fk_inv_id`),
  KEY `FK_invoice_line_inl_invoice_line_inl_refund` (`fk_inl_id`) USING BTREE,
  KEY `FK_invoice_line_inl_contract_line_col` (`fk_col_id`),
  KEY `FK_invoice_line_inl_tva_tva` (`fk_tax_id`) USING BTREE,
  CONSTRAINT `FK_invoice_line_inl_contract_line_col` FOREIGN KEY (`fk_col_id`) REFERENCES `contract_line_col` (`col_id`),
  CONSTRAINT `FK_invoice_line_inl_invoice_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_invoice_line_inl_invoice_line_inl_refund` FOREIGN KEY (`fk_inl_id`) REFERENCES `invoice_line_inl` (`inl_id`),
  CONSTRAINT `FK_invoice_line_inl_product_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_invoice_line_inl_purchase_order_pol` FOREIGN KEY (`fk_pol_id`) REFERENCES `purchase_order_line_pol` (`pol_id`),
  CONSTRAINT `FK_invoice_line_inl_sale_order_line_orl` FOREIGN KEY (`fk_orl_id`) REFERENCES `sale_order_line_orl` (`orl_id`),
  CONSTRAINT `FK_invoice_line_inl_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_invoice_line_inl_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_invoice_line_inl_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=847 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. job_batches
CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. jobs
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(191) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. logs_log
CREATE TABLE IF NOT EXISTS `logs_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `log_updated` timestamp NULL DEFAULT NULL,
  `log_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `log_ip_address` varchar(45) DEFAULT NULL,
  `log_user_agent` text DEFAULT NULL,
  `log_details` text DEFAULT NULL COMMENT '''Détails supplémentaires en JSON''',
  `log_action` varchar(100) DEFAULT NULL,
  `fk_usr_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`log_id`) USING BTREE,
  KEY `FK_logs_log_usr_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_logs_log_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_logs_log_user_usr` (`fk_usr_id`) USING BTREE,
  CONSTRAINT `FK_logs_log_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_logs_log_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_logs_log_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. menu_mnu
CREATE TABLE IF NOT EXISTS `menu_mnu` (
  `mnu_id` int(11) NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `mnu_lib` varchar(100) NOT NULL,
  `mnu_parent` int(11) DEFAULT NULL,
  `mnu_order` int(11) NOT NULL DEFAULT 0 COMMENT 'Ordre',
  `mnu_href` varchar(255) DEFAULT NULL,
  `mnu_mif` varchar(255) DEFAULT NULL,
  `mnu_name` varchar(255) DEFAULT NULL,
  `fk_app_id` int(10) unsigned DEFAULT NULL,
  `mnu_display_mode` enum('DESKTOP','MOBILE','BOTH') NOT NULL,
  `mnu_type` varchar(20) NOT NULL DEFAULT 'item',
  `fk_permission_name` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`mnu_id`) USING BTREE,
  KEY `FK_menu_mnu_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_menu_mnu_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_menu_mnu_application_app` (`fk_app_id`) USING BTREE,
  CONSTRAINT `FK_menu_mnu_application_app` FOREIGN KEY (`fk_app_id`) REFERENCES `application_app` (`app_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_menu_mnu_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_menu_mnu_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `fk_menu_app` FOREIGN KEY (`fk_app_id`) REFERENCES `application_app` (`app_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=209 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. message_email_account_eml
CREATE TABLE IF NOT EXISTS `message_email_account_eml` (
  `eml_id` int(11) NOT NULL AUTO_INCREMENT,
  `eml_created` timestamp NULL DEFAULT NULL,
  `eml_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `eml_label` varchar(100) NOT NULL COMMENT 'Email',
  `eml_address` varchar(320) DEFAULT NULL,
  `eml_secure_mode` varchar(50) DEFAULT NULL,
  `eml_imap_host` varchar(100) DEFAULT NULL,
  `eml_imap_port` int(11) DEFAULT 0,
  `eml_validate_cert` tinyint(4) NOT NULL DEFAULT 0,
  `eml_imap_folder` varchar(100) DEFAULT NULL,
  `eml_password` varchar(320) DEFAULT NULL,
  `eml_tenant_id` varchar(100) DEFAULT NULL,
  `eml_client_id` varchar(100) DEFAULT NULL,
  `eml_client_secret` varchar(500) DEFAULT NULL,
  `eml_sender_alias` varchar(320) DEFAULT NULL,
  `eml_refresh_token` longtext DEFAULT NULL,
  `eml_access_token` longtext DEFAULT NULL,
  `eml_access_token_expires_at` int(11) DEFAULT NULL,
  `eml_smtp_host` varchar(100) DEFAULT NULL,
  `eml_smtp_port` int(11) DEFAULT NULL,
  `eml_smtpsecure` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`eml_id`),
  UNIQUE KEY `eml_label` (`eml_label`),
  KEY `FK_message_email_account_eml_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_message_email_account_eml_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_message_email_account_eml_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_message_email_account_eml_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. message_mes
CREATE TABLE IF NOT EXISTS `message_mes` (
  `mes_id` int(11) NOT NULL AUTO_INCREMENT,
  `mes_created` timestamp NULL DEFAULT NULL,
  `mes_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_eml_id` int(11) DEFAULT NULL,
  `mes_status` int(11) DEFAULT NULL,
  `mes_status_desc` varchar(255) DEFAULT NULL,
  `mes_error_count` int(11) DEFAULT NULL,
  `mes_subject` varchar(255) DEFAULT NULL,
  `mes_body` mediumtext DEFAULT NULL,
  `mes_to` varchar(255) DEFAULT NULL,
  `mes_cc` varchar(255) DEFAULT NULL,
  `mes_att_files` mediumtext DEFAULT NULL,
  PRIMARY KEY (`mes_id`) USING BTREE,
  KEY `FK_t_message_mes_tr_email_eml` (`fk_eml_id`),
  KEY `FK_message_mes_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_message_mes_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_message_mes_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_message_mes_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_t_message_mes_tr_email_eml` FOREIGN KEY (`fk_eml_id`) REFERENCES `message_email_account_eml` (`eml_id`)
) ENGINE=InnoDB AUTO_INCREMENT=208 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. message_template_emt
CREATE TABLE IF NOT EXISTS `message_template_emt` (
  `emt_id` int(11) NOT NULL AUTO_INCREMENT,
  `emt_created` timestamp NULL DEFAULT NULL,
  `emt_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `emt_label` varchar(50) NOT NULL,
  `emt_subject` varchar(255) NOT NULL,
  `emt_body` mediumtext NOT NULL,
  `emt_category` enum('ticket_reply','system') NOT NULL DEFAULT 'ticket_reply',
  PRIMARY KEY (`emt_id`) USING BTREE,
  KEY `FK_message_template_emt_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_message_template_emt_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_message_template_emt_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_message_template_emt_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Email type';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. migrations
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(191) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. mileage_expense_mex
CREATE TABLE IF NOT EXISTS `mileage_expense_mex` (
  `mex_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `mex_created_at` timestamp NULL DEFAULT current_timestamp(),
  `mex_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_exr_id` bigint(20) unsigned NOT NULL,
  `fk_vhc_id` bigint(20) unsigned NOT NULL,
  `mex_date` date NOT NULL,
  `mex_departure` varchar(255) NOT NULL,
  `mex_destination` varchar(255) NOT NULL,
  `mex_distance_km` decimal(8,1) NOT NULL,
  `mex_is_round_trip` tinyint(4) NOT NULL DEFAULT 0,
  `mex_fiscal_power` smallint(6) NOT NULL,
  `mex_vehicle_type` enum('car','motorcycle','moped') NOT NULL DEFAULT 'car',
  `mex_rate_coefficient` decimal(10,4) NOT NULL,
  `mex_rate_constant` decimal(10,2) NOT NULL DEFAULT 0.00,
  `mex_calculated_amount` decimal(10,2) NOT NULL,
  `mex_notes` text DEFAULT NULL,
  PRIMARY KEY (`mex_id`),
  KEY `idx_mex_exr` (`fk_exr_id`),
  KEY `idx_mex_vhc` (`fk_vhc_id`),
  KEY `idx_mex_date` (`mex_date`),
  CONSTRAINT `FK_mileage_expense_mex_expense_reports_exr` FOREIGN KEY (`fk_exr_id`) REFERENCES `expense_reports_exr` (`exr_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_mileage_expense_mex_vehicle_vhc` FOREIGN KEY (`fk_vhc_id`) REFERENCES `vehicle_vhc` (`vhc_id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. mileage_scale_msc
CREATE TABLE IF NOT EXISTS `mileage_scale_msc` (
  `msc_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `msc_created_at` timestamp NULL DEFAULT current_timestamp(),
  `msc_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `msc_year` smallint(6) NOT NULL,
  `msc_vehicle_type` enum('car','motorcycle','moped') NOT NULL DEFAULT 'car',
  `msc_fiscal_power` varchar(10) NOT NULL,
  `msc_min_distance` int(11) NOT NULL,
  `msc_max_distance` int(11) DEFAULT NULL,
  `msc_coefficient` decimal(10,4) NOT NULL,
  `msc_constant` decimal(10,2) NOT NULL DEFAULT 0.00,
  `msc_is_active` tinyint(4) NOT NULL DEFAULT 1,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  PRIMARY KEY (`msc_id`),
  UNIQUE KEY `uq_msc_year_type_power_dist` (`msc_year`,`msc_vehicle_type`,`msc_fiscal_power`,`msc_min_distance`),
  KEY `idx_msc_year` (`msc_year`),
  KEY `idx_msc_active` (`msc_is_active`),
  KEY `FK_mileage_scale_msc_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_mileage_scale_msc_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_mileage_scale_msc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_mileage_scale_msc_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. model_has_permissions
CREATE TABLE IF NOT EXISTS `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(191) NOT NULL,
  `fk_usr_id` int(11) NOT NULL,
  PRIMARY KEY (`permission_id`,`fk_usr_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`fk_usr_id`,`model_type`),
  CONSTRAINT `FK_model_has_permissions_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. model_has_roles
CREATE TABLE IF NOT EXISTS `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(191) NOT NULL,
  `fk_usr_id` int(11) NOT NULL,
  PRIMARY KEY (`role_id`,`fk_usr_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`fk_usr_id`,`model_type`),
  CONSTRAINT `FK_model_has_roles_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. partner_ptr
CREATE TABLE IF NOT EXISTS `partner_ptr` (
  `ptr_id` int(11) NOT NULL AUTO_INCREMENT,
  `insert_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `ptr_name` varchar(100) NOT NULL,
  `ptr_address` varchar(500) DEFAULT NULL,
  `ptr_zip` varchar(10) DEFAULT NULL,
  `ptr_city` varchar(45) DEFAULT NULL,
  `ptr_country` varchar(45) DEFAULT NULL,
  `ptr_phone` varchar(20) DEFAULT NULL,
  `ptr_email` varchar(320) DEFAULT NULL,
  `fk_usr_id_seller` int(11) DEFAULT NULL COMMENT 'Référent commercial',
  `ptr_is_active` tinyint(4) NOT NULL DEFAULT 0,
  `ptr_is_customer` tinyint(4) NOT NULL DEFAULT 0,
  `ptr_is_supplier` tinyint(4) NOT NULL DEFAULT 0,
  `ptr_is_prospect` tinyint(4) NOT NULL DEFAULT 0,
  `ptr_notes` varchar(255) DEFAULT NULL,
  `ptr_vat_number` varchar(20) DEFAULT NULL COMMENT 'Numéro de TVA intracommunautaire',
  `ptr_siren` varchar(14) DEFAULT NULL COMMENT 'Numéro SIREN (9 chiffres) ou SIRET (14 chiffres)',
  `usr_id_referenttech` int(11) DEFAULT NULL COMMENT 'Référent technique',
  `fk_pam_id_customer` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition_customer` int(11) DEFAULT NULL,
  `fk_pam_id_supplier` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition_supplier` int(11) DEFAULT NULL,
  `fk_acc_id_customer` int(11) DEFAULT NULL,
  `fk_acc_id_supplier` int(11) DEFAULT NULL,
  `ptr_account_auxiliary_customer` varchar(8) DEFAULT NULL,
  `ptr_account_auxiliary_supplier` varchar(8) DEFAULT NULL,
  `ptr_customer_note` varchar(255) DEFAULT NULL,
  `fk_tap_id` int(11) DEFAULT NULL,
  `ptr_prospect_description` text DEFAULT NULL,
  `ptr_linkedin_url` varchar(2048) DEFAULT NULL,
  `ptr_pappers_url` varchar(2048) DEFAULT NULL,
  `ptr_headcount` varchar(100) DEFAULT NULL,
  `ptr_activity` varchar(255) DEFAULT NULL,
  `ptr_customer_delivery_address` text DEFAULT NULL,
  `ptr_supplier_delivery_address` text DEFAULT NULL,
  `ptr_siret` varchar(14) DEFAULT NULL COMMENT 'Numéro SIRET (14 chiffres) — SIREN + NIC',
  `ptr_country_code` char(2) DEFAULT NULL COMMENT 'Code pays ISO 3166-1 alpha-2 (ex: FR) pour le XML Facture-X',
  PRIMARY KEY (`ptr_id`) USING BTREE,
  UNIQUE KEY `clt_lib` (`ptr_name`) USING BTREE,
  UNIQUE KEY `ptr_account_auxiliary_supplier` (`ptr_account_auxiliary_supplier`),
  UNIQUE KEY `ptr_account_auxiliary_customer` (`ptr_account_auxiliary_customer`) USING BTREE,
  KEY `FK_tc_client_clt_tr_user_usr_2` (`usr_id_referenttech`),
  KEY `FK_partner_ptr_t_payment_mode_pam` (`fk_pam_id_customer`) USING BTREE,
  KEY `FK_partner_ptr_payment_mode_pam_supplier` (`fk_pam_id_supplier`),
  KEY `FK_partner_ptr_account_account_acc_customer` (`fk_acc_id_customer`),
  KEY `FK_partner_ptr_account_account_acc_supplier` (`fk_acc_id_supplier`),
  KEY `FK_partner_ptr_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_partner_ptr_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_partner_ptr_t_payment_condition_pac` (`fk_dur_id_payment_condition_customer`) USING BTREE,
  KEY `FK_partner_ptr_payment_condition_pac_supplier` (`fk_dur_id_payment_condition_supplier`) USING BTREE,
  KEY `FK_tc_client_clt_tr_user_usr` (`fk_usr_id_seller`) USING BTREE,
  KEY `FK_partner_ptr_tax_position_tap` (`fk_tap_id`),
  CONSTRAINT `FK_partner_ptr_account_account_acc_customer` FOREIGN KEY (`fk_acc_id_customer`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_partner_ptr_account_account_acc_supplier` FOREIGN KEY (`fk_acc_id_supplier`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_partner_ptr_duration_dur_payment_condition_customer` FOREIGN KEY (`fk_dur_id_payment_condition_customer`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_partner_ptr_duration_dur_payment_condition_supplierr` FOREIGN KEY (`fk_dur_id_payment_condition_supplier`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_partner_ptr_payment_mode_pam_customer` FOREIGN KEY (`fk_pam_id_customer`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_partner_ptr_payment_mode_pam_supplier` FOREIGN KEY (`fk_pam_id_supplier`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_partner_ptr_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_partner_ptr_user_usr` FOREIGN KEY (`usr_id_referenttech`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_partner_ptr_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_partner_ptr_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=249 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. payment_allocation_pal
CREATE TABLE IF NOT EXISTS `payment_allocation_pal` (
  `pal_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID de l allocation',
  `pay_created` timestamp NULL DEFAULT NULL COMMENT 'Date de création',
  `pal_updated` timestamp NULL DEFAULT NULL COMMENT 'Date de dernière modification',
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_pay_id` int(11) NOT NULL COMMENT 'Règlement concerné',
  `fk_inv_id` int(11) DEFAULT NULL COMMENT 'Facture concernée (si applicable)',
  `fk_che_id` int(11) DEFAULT NULL COMMENT 'Charge concernée (si applicable)',
  `fk_exr_id` bigint(20) unsigned DEFAULT NULL,
  `pal_amount` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Montant alloué à cette facture/charge',
  `fk_pay_id_source` int(11) DEFAULT NULL,
  PRIMARY KEY (`pal_id`),
  KEY `idx_pal_pay_id` (`fk_pay_id`),
  KEY `idx_pal_inv_id` (`fk_inv_id`),
  KEY `idx_pal_che_id` (`fk_che_id`),
  KEY `FK_payment_allocation_pal_user_usr` (`fk_usr_id_author`),
  KEY `FK_payment_allocation_pal_user_usr_2` (`fk_usr_id_updater`),
  KEY `FK_payment_allocation_pal_expense_reports_exr` (`fk_exr_id`),
  CONSTRAINT `FK_payment_allocation_pal_expense_reports_exr` FOREIGN KEY (`fk_exr_id`) REFERENCES `expense_reports_exr` (`exr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_payment_allocation_pal_user_usr` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_payment_allocation_pal_user_usr_2` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_payment_allocation_che` FOREIGN KEY (`fk_che_id`) REFERENCES `charge_che` (`che_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocation_inv` FOREIGN KEY (`fk_inv_id`) REFERENCES `invoice_inv` (`inv_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocation_pay` FOREIGN KEY (`fk_pay_id`) REFERENCES `payment_pay` (`pay_id`),
  CONSTRAINT `payment_allocation_pal_fk_exr_id_foreign` FOREIGN KEY (`fk_exr_id`) REFERENCES `expense_reports_exr` (`exr_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=364 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Table d allocation des règlements aux factures (permet règlements multi-factures)';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. payment_mode_pam
CREATE TABLE IF NOT EXISTS `payment_mode_pam` (
  `pam_id` int(11) NOT NULL AUTO_INCREMENT,
  `pam_created` timestamp NULL DEFAULT NULL,
  `pam_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `pam_label` varchar(100) NOT NULL,
  PRIMARY KEY (`pam_id`) USING BTREE,
  UNIQUE KEY `pam_lib` (`pam_label`) USING BTREE,
  KEY `FK_payment_mode_pam_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_payment_mode_pam_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_payment_mode_pam_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_payment_mode_pam_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. payment_pay
CREATE TABLE IF NOT EXISTS `payment_pay` (
  `pay_id` int(11) NOT NULL AUTO_INCREMENT,
  `pay_created` timestamp NULL DEFAULT NULL,
  `pay_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `pay_date` date NOT NULL,
  `pay_number` varchar(30) DEFAULT NULL,
  `pay_amount` double(15,2) NOT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `fk_cop_id` int(11) DEFAULT NULL,
  `fk_usr_id` int(11) DEFAULT NULL,
  `pay_amount_available` double DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_bts_id` int(11) DEFAULT NULL,
  `pay_operation` int(11) NOT NULL COMMENT '1 =cust,  2 = supplier , 3 =charge',
  `pay_reference` varchar(50) DEFAULT NULL COMMENT 'Numéro de chèque, virement ou référence bancaire',
  `pay_status` int(11) DEFAULT NULL,
  `fk_inv_id_deposit` int(11) DEFAULT NULL,
  `fk_inv_id_refund` int(11) DEFAULT NULL,
  `fk_inv_id_credit_generated` int(11) DEFAULT NULL COMMENT 'Avoir automatiquement généré',
  PRIMARY KEY (`pay_id`) USING BTREE,
  UNIQUE KEY `pay_number` (`pay_number`),
  KEY `FK_invoice_payment_inp_bank_details_bts` (`fk_bts_id`),
  KEY `FK_invoice_payment_inp_payment_mode_pam` (`fk_pam_id`),
  KEY `FK_invoice_payment_inp_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_invoice_payment_inp_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_invoice_payment_inp_invoice_inv_deposit` (`fk_inv_id_deposit`),
  KEY `FK_invoice_payment_inp_invoice_inv_refund` (`fk_inv_id_refund`),
  KEY `payment_pay_fk_inv_id_credit_generated_foreign` (`fk_inv_id_credit_generated`),
  KEY `FK_payment_pay_partner_ptr` (`fk_ptr_id`),
  KEY `FK_payment_pay_company_cop` (`fk_cop_id`),
  KEY `FK_payment_pay_user_usr` (`fk_usr_id`),
  CONSTRAINT `FK_invoice_payment_inp_bank_details_bts` FOREIGN KEY (`fk_bts_id`) REFERENCES `bank_details_bts` (`bts_id`),
  CONSTRAINT `FK_invoice_payment_inp_invoice_inv_deposit` FOREIGN KEY (`fk_inv_id_deposit`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_invoice_payment_inp_invoice_inv_refund` FOREIGN KEY (`fk_inv_id_refund`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_invoice_payment_inp_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_invoice_payment_inp_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_invoice_payment_inp_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_payment_pay_company_cop` FOREIGN KEY (`fk_cop_id`) REFERENCES `company_cop` (`cop_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_payment_pay_invoice_inv` FOREIGN KEY (`fk_inv_id_credit_generated`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_payment_pay_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_payment_pay_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `payment_pay_fk_inv_id_credit_generated_foreign` FOREIGN KEY (`fk_inv_id_credit_generated`) REFERENCES `invoice_inv` (`inv_id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=201 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. permissions
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `guard_name` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=210 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. personal_access_tokens
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(191) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. product_commissioning_prc
CREATE TABLE IF NOT EXISTS `product_commissioning_prc` (
  `prc_id` int(11) NOT NULL AUTO_INCREMENT,
  `prc_created` timestamp NULL DEFAULT NULL,
  `prc_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_prt_id_parent` int(11) DEFAULT NULL,
  `fk_prt_id` int(11) DEFAULT NULL,
  `prc_qte` double DEFAULT NULL,
  `prc_priceunitht` double DEFAULT NULL,
  `prc_tax` double DEFAULT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`prc_id`) USING BTREE,
  KEY `FK_tr_productcommissioning_prc_tr_product_prt` (`fk_prt_id`),
  KEY `FK_tr_productcommissioning_prc_tr_product_prt_2` (`fk_prt_id_parent`),
  KEY `FK_product_commissioning_prc_tax_tax` (`fk_tax_id`),
  KEY `FK_product_commissioning_prc_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_product_commissioning_prc_user_usr` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_product_commissioning_prc_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_product_commissioning_prc_user_usr` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_product_commissioning_prc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_tr_productcommissioning_prc_tr_product_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_tr_productcommissioning_prc_tr_product_prt_parent` FOREIGN KEY (`fk_prt_id_parent`) REFERENCES `product_prt` (`prt_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. product_prt
CREATE TABLE IF NOT EXISTS `product_prt` (
  `prt_id` int(11) NOT NULL AUTO_INCREMENT,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `prt_updated` timestamp NULL DEFAULT NULL,
  `prt_created` timestamp NULL DEFAULT NULL,
  `prt_ref` varchar(100) NOT NULL,
  `prt_label` varchar(150) NOT NULL,
  `prt_desc` mediumtext DEFAULT NULL,
  `prt_priceunitht` decimal(12,2) DEFAULT NULL,
  `prt_pricehtcost` decimal(12,2) DEFAULT NULL,
  `prt_type` enum('conso','service') NOT NULL DEFAULT 'conso',
  `fk_tax_id_sale` int(11) DEFAULT NULL,
  `fk_tax_id_purchase` int(11) DEFAULT NULL,
  `prt_subscription` tinyint(4) NOT NULL DEFAULT 0,
  `fk_acc_id_sale` int(11) DEFAULT NULL,
  `fk_acc_id_purchase` int(11) DEFAULT NULL,
  `prt_is_active` tinyint(4) NOT NULL DEFAULT 0,
  `prt_is_purchasable` tinyint(4) NOT NULL DEFAULT 0,
  `prt_is_sellable` tinyint(4) NOT NULL DEFAULT 0,
  `prt_stock_alert_threshold` decimal(15,2) DEFAULT NULL COMMENT 'Seuil d''alerte de stock (quantité minimale avant alerte)',
  `prt_stockable` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`prt_id`) USING BTREE,
  UNIQUE KEY `prt_ref` (`prt_ref`),
  UNIQUE KEY `prt_lib` (`prt_label`) USING BTREE,
  KEY `FK_product_prt_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_product_prt_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_product_prt_account_account_acc_purchase` (`fk_acc_id_purchase`),
  KEY `FK_product_prt_account_account_acc_sale` (`fk_acc_id_sale`),
  KEY `FK_product_prt_tva_tva_sale` (`fk_tax_id_sale`) USING BTREE,
  KEY `FK_product_prt_tva_tva_purchase` (`fk_tax_id_purchase`) USING BTREE,
  FULLTEXT KEY `ft_prt_label` (`prt_label`),
  CONSTRAINT `FK_product_prt_account_account_acc_purchase` FOREIGN KEY (`fk_acc_id_purchase`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_product_prt_account_account_acc_sale` FOREIGN KEY (`fk_acc_id_sale`) REFERENCES `account_account_acc` (`acc_id`),
  CONSTRAINT `FK_product_prt_tax_tax_purchase` FOREIGN KEY (`fk_tax_id_purchase`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_product_prt_tax_tax_sale` FOREIGN KEY (`fk_tax_id_sale`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_product_prt_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_product_prt_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. product_stock_psk
CREATE TABLE IF NOT EXISTS `product_stock_psk` (
  `psk_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID du stock',
  `psk_created` datetime NOT NULL DEFAULT current_timestamp(),
  `psk_updated` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `fk_usr_id_author` int(11) DEFAULT NULL COMMENT 'Utilisateur créateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL COMMENT 'Utilisateur ayant fait la dernière modification',
  `fk_prt_id` int(11) NOT NULL COMMENT 'ID du produit',
  `fk_whs_id` int(11) DEFAULT 1 COMMENT 'ID de l''entrepôt/emplacement',
  `psk_qty_physical` decimal(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Quantité physique en stock',
  `psk_qty_virtual` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `psk_min_qty` decimal(15,4) DEFAULT 0.0000 COMMENT 'Stock minimum (alerte)',
  `psk_max_qty` decimal(15,4) DEFAULT NULL COMMENT 'Stock maximum',
  `psk_reorder_qty` decimal(15,4) DEFAULT NULL COMMENT 'Quantité de réapprovisionnement',
  `psk_last_purchase_price` decimal(15,4) DEFAULT 0.0000 COMMENT 'Dernier prix d''achat',
  `psk_average_price` decimal(15,4) DEFAULT 0.0000 COMMENT 'Prix moyen pondéré (PMP)',
  `psk_total_value` decimal(15,2) GENERATED ALWAYS AS (`psk_qty_physical` * `psk_average_price`) STORED COMMENT 'Valeur totale du stock',
  `psk_last_movement_date` datetime DEFAULT NULL COMMENT 'Date du dernier mouvement',
  `psk_last_inventory_date` datetime DEFAULT NULL COMMENT 'Date du dernier inventaire',
  PRIMARY KEY (`psk_id`) USING BTREE,
  UNIQUE KEY `uk_psk_prt_whs` (`fk_prt_id`,`fk_whs_id`) USING BTREE,
  KEY `idx_psk_whs` (`fk_whs_id`) USING BTREE,
  KEY `idx_psk_alert` (`psk_min_qty`) USING BTREE,
  KEY `product_stock_psk_ibfk_1` (`fk_usr_id_author`) USING BTREE,
  KEY `product_stock_psk_ibfk_2` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `fk_psk_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_psk_whs` FOREIGN KEY (`fk_whs_id`) REFERENCES `warehouse_whs` (`whs_id`),
  CONSTRAINT `product_stock_psk_ibfk_1` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON UPDATE CASCADE,
  CONSTRAINT `product_stock_psk_ibfk_2` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Stocks par produit et emplacement';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. prospect_activity_pac
CREATE TABLE IF NOT EXISTS `prospect_activity_pac` (
  `pac_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `pac_created` datetime DEFAULT NULL,
  `pac_updated` datetime DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `pac_type` varchar(20) NOT NULL,
  `pac_subject` varchar(255) NOT NULL,
  `pac_description` text DEFAULT NULL,
  `pac_date` datetime NOT NULL,
  `pac_due_date` datetime DEFAULT NULL,
  `pac_is_done` tinyint(4) NOT NULL DEFAULT 0,
  `pac_done_date` datetime DEFAULT NULL,
  `pac_duration` int(11) DEFAULT NULL,
  `fk_opp_id` int(10) unsigned DEFAULT NULL,
  `fk_ptr_id` int(11) NOT NULL,
  `fk_ctc_id` int(10) DEFAULT NULL,
  `fk_usr_id_seller` int(10) NOT NULL,
  PRIMARY KEY (`pac_id`),
  KEY `prospect_activity_pac_fk_opp_id_index` (`fk_opp_id`),
  KEY `prospect_activity_pac_fk_ptr_id_index` (`fk_ptr_id`),
  KEY `prospect_activity_pac_fk_usr_id_seller_index` (`fk_usr_id_seller`),
  KEY `prospect_activity_pac_pac_type_index` (`pac_type`),
  KEY `prospect_activity_pac_pac_done_index` (`pac_is_done`),
  KEY `prospect_activity_pac_pac_date_index` (`pac_date`),
  KEY `FK_prospect_activity_pac_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_prospect_activity_pac_user_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_prospect_activity_pac_contact_ctc` (`fk_ctc_id`),
  CONSTRAINT `FK_prospect_activity_pac_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_activity_pac_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_activity_pac_user_usr_seller` FOREIGN KEY (`fk_usr_id_seller`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_activity_pac_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `prospect_activity_pac_fk_opp_id_foreign` FOREIGN KEY (`fk_opp_id`) REFERENCES `prospect_opportunity_opp` (`opp_id`) ON DELETE CASCADE,
  CONSTRAINT `prospect_activity_pac_fk_ptr_id_foreign` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. prospect_lost_reason_plr
CREATE TABLE IF NOT EXISTS `prospect_lost_reason_plr` (
  `plr_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `plr_created` datetime DEFAULT NULL,
  `plr_updated` datetime DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `plr_label` varchar(100) NOT NULL,
  `plr_is_active` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`plr_id`),
  UNIQUE KEY `plr_label` (`plr_label`),
  KEY `prospect_lost_reason_plr_plr_active_index` (`plr_is_active`),
  KEY `FK_prospect_lost_reason_plr_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_prospect_lost_reason_plr_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_prospect_lost_reason_plr_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_lost_reason_plr_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. prospect_opportunity_opp
CREATE TABLE IF NOT EXISTS `prospect_opportunity_opp` (
  `opp_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `opp_created` datetime DEFAULT NULL,
  `opp_updated` datetime DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `opp_label` varchar(255) NOT NULL,
  `opp_description` text DEFAULT NULL,
  `opp_amount` decimal(15,2) DEFAULT NULL,
  `opp_probability` int(11) NOT NULL DEFAULT 0,
  `opp_close_date` date DEFAULT NULL,
  `opp_closed_date` date DEFAULT NULL,
  `opp_notes` text DEFAULT NULL,
  `fk_pps_id` int(10) unsigned NOT NULL,
  `fk_ptr_id` int(10) NOT NULL,
  `fk_ctc_id` int(10) DEFAULT NULL,
  `fk_usr_id_seller` int(10) NOT NULL,
  `fk_pso_id` int(10) unsigned DEFAULT NULL,
  `fk_plr_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`opp_id`),
  KEY `prospect_opportunity_opp_fk_pps_id_index` (`fk_pps_id`),
  KEY `prospect_opportunity_opp_fk_ptr_id_index` (`fk_ptr_id`),
  KEY `prospect_opportunity_opp_fk_usr_id_seller_index` (`fk_usr_id_seller`),
  KEY `prospect_opportunity_opp_fk_pso_id_index` (`fk_pso_id`),
  KEY `prospect_opportunity_opp_fk_plr_id_index` (`fk_plr_id`),
  KEY `prospect_opportunity_opp_opp_close_date_index` (`opp_close_date`),
  KEY `FK_prospect_opportunity_opp_contact_ctc` (`fk_ctc_id`),
  KEY `FK_prospect_opportunity_opp_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_prospect_opportunity_opp_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_prospect_opportunity_opp_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_opportunity_opp_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_opportunity_opp_user_usr` FOREIGN KEY (`fk_usr_id_seller`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_opportunity_opp_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_opportunity_opp_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `prospect_opportunity_opp_fk_pps_id_foreign` FOREIGN KEY (`fk_pps_id`) REFERENCES `prospect_pipeline_stage_pps` (`pps_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. prospect_pipeline_stage_pps
CREATE TABLE IF NOT EXISTS `prospect_pipeline_stage_pps` (
  `pps_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `pps_created` datetime DEFAULT NULL,
  `pps_updated` datetime DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `pps_label` varchar(100) NOT NULL,
  `pps_order` int(11) NOT NULL DEFAULT 0,
  `pps_color` varchar(20) NOT NULL DEFAULT '#1677ff',
  `pps_is_won` tinyint(4) NOT NULL DEFAULT 0,
  `pps_is_lost` tinyint(4) NOT NULL DEFAULT 0,
  `pps_default_probability` int(11) NOT NULL DEFAULT 0,
  `pps_is_active` tinyint(4) NOT NULL DEFAULT 1,
  `pps_is_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`pps_id`),
  KEY `prospect_pipeline_stage_pps_pps_is_active_index` (`pps_is_active`),
  KEY `prospect_pipeline_stage_pps_pps_order_index` (`pps_order`),
  KEY `FK_prospect_pipeline_stage_pps_user_author` (`fk_usr_id_author`),
  KEY `FK_prospect_pipeline_stage_pps_user_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_prospect_pipeline_stage_pps_user_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_pipeline_stage_pps_user_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. prospect_source_pso
CREATE TABLE IF NOT EXISTS `prospect_source_pso` (
  `pso_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `pso_created` datetime DEFAULT NULL,
  `pso_updated` datetime DEFAULT NULL,
  `fk_usr_id_author` int(10) DEFAULT NULL,
  `fk_usr_id_updater` int(10) DEFAULT NULL,
  `pso_label` varchar(100) NOT NULL,
  `pso_is_active` tinyint(4) NOT NULL DEFAULT 1,
  `pso_is_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`pso_id`),
  UNIQUE KEY `pso_label` (`pso_label`),
  KEY `prospect_source_pso_pso_is_active_index` (`pso_is_active`),
  KEY `FK_prospect_source_pso_user_author` (`fk_usr_id_author`),
  KEY `FK_prospect_source_pso_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_prospect_source_pso_user_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_prospect_source_pso_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. purchase_order_config_pco
CREATE TABLE IF NOT EXISTS `purchase_order_config_pco` (
  `pco_id` int(11) NOT NULL AUTO_INCREMENT,
  `pco_updated` timestamp NULL DEFAULT NULL,
  `pco_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_emt_id` int(11) DEFAULT NULL,
  `fk_prt_id_default` int(11) DEFAULT NULL,
  PRIMARY KEY (`pco_id`) USING BTREE,
  KEY `FK_purchase_order_config_pco_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_purchase_order_config_pco_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_purchase_order_config_pco_message_template_emt` (`fk_emt_id`) USING BTREE,
  KEY `FK_purchase_order_config_pco_product_prt_default` (`fk_prt_id_default`) USING BTREE,
  CONSTRAINT `FK_purchase_order_config_pco_message_template_emt` FOREIGN KEY (`fk_emt_id`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_purchase_order_config_pco_product_prt_default` FOREIGN KEY (`fk_prt_id_default`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_purchase_order_config_pco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_purchase_order_config_pco_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. purchase_order_line_pol
CREATE TABLE IF NOT EXISTS `purchase_order_line_pol` (
  `pol_id` int(11) NOT NULL AUTO_INCREMENT,
  `pol_created` timestamp NULL DEFAULT NULL,
  `pol_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_por_id` int(11) DEFAULT NULL,
  `pol_prtlib` varchar(150) NOT NULL DEFAULT '',
  `pol_prtdesc` mediumtext DEFAULT NULL,
  `pol_prttype` enum('conso','service') DEFAULT NULL,
  `pol_qty` decimal(12,2) DEFAULT NULL,
  `pol_priceunitht` decimal(12,3) DEFAULT NULL,
  `pol_discount` decimal(12,2) DEFAULT NULL,
  `pol_mtht` decimal(12,3) DEFAULT NULL,
  `fk_prt_id` int(11) DEFAULT NULL,
  `pol_order` int(11) DEFAULT NULL,
  `pol_type` int(11) DEFAULT NULL,
  `pol_note` varchar(255) DEFAULT NULL,
  `pol_tax_rate` decimal(5,3) DEFAULT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  `pol_is_subscription` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`pol_id`) USING BTREE,
  KEY `FK_tc_propalline_ppl_tr_product_prt` (`fk_prt_id`) USING BTREE,
  KEY `FK_tc_propalline_ppl_tc_propal_ppr` (`fk_por_id`) USING BTREE,
  KEY `FK_purchase_order_pol_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_purchase_order_pol_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_purchase_order_pol_tva_tva` (`fk_tax_id`) USING BTREE,
  CONSTRAINT `FK_purchase_order_pol_product_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_purchase_order_pol_purchase_order_por` FOREIGN KEY (`fk_por_id`) REFERENCES `purchase_order_por` (`por_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_purchase_order_pol_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_purchase_order_pol_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_purchase_order_pol_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=231 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. purchase_order_por
CREATE TABLE IF NOT EXISTS `purchase_order_por` (
  `por_id` int(11) NOT NULL AUTO_INCREMENT,
  `por_created` timestamp NULL DEFAULT NULL,
  `por_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `por_createdate` datetime DEFAULT NULL,
  `por_number` varchar(30) NOT NULL,
  `por_externalreference` varchar(30) DEFAULT NULL,
  `por_date` date NOT NULL,
  `por_valid` date DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `por_estimatedreceiptdate` date DEFAULT NULL,
  `por_status` int(11) DEFAULT NULL,
  `por_totalht` decimal(12,3) DEFAULT NULL,
  `por_totaltax` decimal(12,3) DEFAULT NULL,
  `por_totalttc` decimal(12,3) DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `fk_ord_id` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition` int(11) DEFAULT NULL,
  `por_being_edited` tinyint(4) NOT NULL DEFAULT 0,
  `por_invoicing_state` int(11) DEFAULT NULL,
  `por_delivery_state` int(11) DEFAULT NULL,
  `fk_usr_id_seller` int(11) DEFAULT NULL,
  `fk_ctc_id` int(11) DEFAULT NULL,
  `por_note` varchar(255) DEFAULT NULL,
  `fk_tap_id` int(11) DEFAULT NULL,
  `fk_doc_id` int(11) DEFAULT NULL,
  `fk_whs_id` int(11) DEFAULT NULL,
  `por_cancel_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`por_id`) USING BTREE,
  UNIQUE KEY `pro_number` (`por_number`) USING BTREE,
  KEY `FK_t_purchase_order_por_tr_user_usr` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_t_purchase_order_por_t_payment_mode_pam` (`fk_pam_id`) USING BTREE,
  KEY `FK_t_purchase_order_por_tr_user_usr_2` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_t_purchase_order_por_tc_client_clt` (`fk_ptr_id`) USING BTREE,
  KEY `FK_purchase_order_por_sale_order_ord` (`fk_ord_id`),
  KEY `FK_purchase_order_por_duration_dur_payment_condition` (`fk_dur_id_payment_condition`),
  KEY `FK_purchase_order_por_tax_position_tap` (`fk_tap_id`),
  KEY `FK_purchase_order_por_document_doc` (`fk_doc_id`),
  KEY `FK_purchase_order_por_warehouse_whs` (`fk_whs_id`),
  CONSTRAINT `FK_purchase_order_por_document_doc` FOREIGN KEY (`fk_doc_id`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_purchase_order_por_duration_dur_payment_condition` FOREIGN KEY (`fk_dur_id_payment_condition`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_purchase_order_por_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_purchase_order_por_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_purchase_order_por_sale_order_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`),
  CONSTRAINT `FK_purchase_order_por_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_purchase_order_por_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_purchase_order_por_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_purchase_order_por_warehouse_whs` FOREIGN KEY (`fk_whs_id`) REFERENCES `warehouse_whs` (`whs_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=388 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. role_has_permissions
CREATE TABLE IF NOT EXISTS `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `guard_name` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. sale_config_sco
CREATE TABLE IF NOT EXISTS `sale_config_sco` (
  `sco_id` int(11) NOT NULL AUTO_INCREMENT,
  `sco_updated` timestamp NOT NULL,
  `sco_created` timestamp NOT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `sco_sale_legal_notice` mediumtext DEFAULT NULL,
  `fk_emt_id_sale_validation` int(11) DEFAULT NULL,
  `fk_emt_id_sale` int(11) DEFAULT NULL,
  `fk_emt_id_token_renew` int(11) DEFAULT NULL COMMENT 'Envoi du mail contenant le token',
  `fk_emt_id_sale_confirmation` int(11) DEFAULT NULL COMMENT 'Confirmation de commande envoyée au client aprés validation de la commande',
  `fk_emt_id_seller_alert` int(11) DEFAULT NULL COMMENT 'Alerte le commercial de la validation de commande',
  `sco_qutote_default_validity` int(11) DEFAULT NULL,
  `fk_eml_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`sco_id`) USING BTREE,
  KEY `FK_sale_config_sco_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_sale_config_sco_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_sale_config_sco_message_template_emt_sale_validation` (`fk_emt_id_sale_validation`),
  KEY `FK_sale_config_sco_message_template_emt` (`fk_emt_id_sale`),
  KEY `FK_sale_config_sco_message_template_emt_token_renew` (`fk_emt_id_token_renew`),
  KEY `FK_sale_config_sco_message_template_emt_sale_confirmation` (`fk_emt_id_sale_confirmation`),
  KEY `FK_sale_config_sco_message_template_emt_seller_alert` (`fk_emt_id_seller_alert`),
  KEY `FK_sale_config_sco_message_email_account_eml` (`fk_eml_id`),
  CONSTRAINT `FK_sale_config_sco_message_email_account_eml` FOREIGN KEY (`fk_eml_id`) REFERENCES `message_email_account_eml` (`eml_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_sale_config_sco_message_template_emt` FOREIGN KEY (`fk_emt_id_sale`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_sale_config_sco_message_template_emt_sale_confirmation` FOREIGN KEY (`fk_emt_id_sale_confirmation`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_sale_config_sco_message_template_emt_sale_validation` FOREIGN KEY (`fk_emt_id_sale_validation`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_sale_config_sco_message_template_emt_seller_alert` FOREIGN KEY (`fk_emt_id_seller_alert`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_sale_config_sco_message_template_emt_token_renew` FOREIGN KEY (`fk_emt_id_token_renew`) REFERENCES `message_template_emt` (`emt_id`),
  CONSTRAINT `FK_sale_config_sco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sale_config_sco_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. sale_order_line_orl
CREATE TABLE IF NOT EXISTS `sale_order_line_orl` (
  `orl_id` int(11) NOT NULL AUTO_INCREMENT,
  `orl_created` timestamp NULL DEFAULT NULL,
  `orl_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_ord_id` int(11) DEFAULT NULL,
  `orl_prtlib` varchar(150) NOT NULL DEFAULT '',
  `orl_prtdesc` mediumtext DEFAULT NULL,
  `orl_prttype` enum('conso','service') DEFAULT NULL,
  `orl_note` varchar(100) DEFAULT NULL,
  `orl_qty` double DEFAULT NULL,
  `orl_priceunitht` double DEFAULT NULL,
  `orl_discount` double DEFAULT NULL,
  `orl_mtht` double DEFAULT NULL,
  `fk_prt_id` int(11) DEFAULT NULL,
  `orl_order` int(11) DEFAULT NULL,
  `orl_type` int(11) DEFAULT NULL,
  `orl_purchasepriceunitht` double DEFAULT NULL,
  `orl_tax_rate` double DEFAULT NULL,
  `fk_tax_id` int(11) DEFAULT NULL,
  `orl_is_subscription` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`orl_id`) USING BTREE,
  KEY `FK_sale_order_line_orl_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_sale_order_line_orl_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_sale_order_line_orl_sale_order_ord` (`fk_ord_id`) USING BTREE,
  KEY `FK_sale_order_line_orl_product_prt` (`fk_prt_id`) USING BTREE,
  KEY `FK_sale_order_line_orl_tva_tva` (`fk_tax_id`) USING BTREE,
  CONSTRAINT `FK_sale_order_line_orl_product_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `FK_sale_order_line_orl_sale_order_ord` FOREIGN KEY (`fk_ord_id`) REFERENCES `sale_order_ord` (`ord_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_sale_order_line_orl_tax_tax` FOREIGN KEY (`fk_tax_id`) REFERENCES `account_tax_tax` (`tax_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_sale_order_line_orl_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sale_order_line_orl_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=863 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. sale_order_ord
CREATE TABLE IF NOT EXISTS `sale_order_ord` (
  `ord_id` int(11) NOT NULL AUTO_INCREMENT,
  `ord_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `ord_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `ord_date` date NOT NULL,
  `ord_valid` date NOT NULL,
  `ord_number` varchar(30) NOT NULL,
  `ord_refclient` varchar(50) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_ctc_id` int(11) DEFAULT NULL,
  `ord_ptr_address` varchar(255) DEFAULT NULL,
  `ord_delivery_address` text DEFAULT NULL,
  `ord_status` int(11) DEFAULT NULL,
  `ord_refusal_reason` text DEFAULT NULL COMMENT 'Motif du refus du devis ou de la commande',
  `ord_totalht` decimal(12,3) DEFAULT NULL,
  `ord_totalhtsub` decimal(12,3) DEFAULT NULL,
  `ord_totalhtcomm` decimal(12,3) DEFAULT NULL,
  `ord_totaltax` decimal(12,3) DEFAULT NULL,
  `ord_totalttc` decimal(12,3) DEFAULT NULL,
  `fk_pam_id` int(11) DEFAULT NULL,
  `fk_dur_id_payment_condition` int(11) DEFAULT NULL,
  `ord_being_edited` tinyint(4) NOT NULL DEFAULT 0,
  `fk_dur_id` int(11) DEFAULT NULL COMMENT 'Engagement',
  `ord_invoicing_state` int(11) DEFAULT NULL,
  `ord_delivery_state` int(11) DEFAULT NULL,
  `ord_note` varchar(255) DEFAULT NULL,
  `fk_usr_id_seller` int(11) DEFAULT NULL,
  `ord_validation_token` varchar(255) DEFAULT NULL,
  `ord_validation_mails` mediumtext DEFAULT NULL,
  `ord_validation_data` mediumtext DEFAULT NULL COMMENT 'json format',
  `fk_tap_id` int(11) DEFAULT NULL,
  `fk_doc_id` int(11) DEFAULT NULL,
  `fk_whs_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`ord_id`) USING BTREE,
  UNIQUE KEY `ord_number` (`ord_number`),
  KEY `FK_tc_propal_ppr_tr_user_usr` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_tc_propal_ppr_tr_user_usr_2` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_tc_propal_ppr_tc_client_clt` (`fk_ptr_id`) USING BTREE,
  KEY `FK_sale_order_ord_contact_ctc` (`fk_ctc_id`),
  KEY `FK_sale_order_ord_payment_mode_pam` (`fk_pam_id`),
  KEY `FK_sale_order_ord_t_duration_dur` (`fk_dur_id`),
  KEY `FK_sale_order_ord_duration_dur_payment_condition` (`fk_dur_id_payment_condition`),
  KEY `FK_sale_order_ord_user_usr_seller` (`fk_usr_id_seller`),
  KEY `FK_sale_order_ord_tax_position_tap` (`fk_tap_id`),
  KEY `FK_sale_order_ord_document_doc` (`fk_doc_id`),
  KEY `FK_sale_order_ord_warehouse_whs` (`fk_whs_id`),
  CONSTRAINT `FK_sale_order_ord_contact_ctc` FOREIGN KEY (`fk_ctc_id`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_sale_order_ord_document_doc` FOREIGN KEY (`fk_doc_id`) REFERENCES `document_doc` (`doc_id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `FK_sale_order_ord_duration_dur_payment_condition` FOREIGN KEY (`fk_dur_id_payment_condition`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_sale_order_ord_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_sale_order_ord_payment_mode_pam` FOREIGN KEY (`fk_pam_id`) REFERENCES `payment_mode_pam` (`pam_id`),
  CONSTRAINT `FK_sale_order_ord_t_duration_dur` FOREIGN KEY (`fk_dur_id`) REFERENCES `duration_dur` (`dur_id`),
  CONSTRAINT `FK_sale_order_ord_tax_position_tap` FOREIGN KEY (`fk_tap_id`) REFERENCES `account_tax_position_tap` (`tap_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_sale_order_ord_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sale_order_ord_user_usr_seller` FOREIGN KEY (`fk_usr_id_seller`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sale_order_ord_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sale_order_ord_warehouse_whs` FOREIGN KEY (`fk_whs_id`) REFERENCES `warehouse_whs` (`whs_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=407 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. sequence_seq
CREATE TABLE IF NOT EXISTS `sequence_seq` (
  `seq_id` int(11) NOT NULL AUTO_INCREMENT,
  `seq_created` timestamp NULL DEFAULT NULL,
  `seq_updated` timestamp NULL DEFAULT NULL,
  `fk_seq_id_author` int(11) DEFAULT NULL,
  `fk_seq_id_updater` int(11) DEFAULT NULL,
  `seq_label` varchar(100) NOT NULL,
  `seq_pattern` varchar(40) NOT NULL,
  `seq_yearly_reset` tinyint(4) NOT NULL DEFAULT 0,
  `seq_module` varchar(50) NOT NULL DEFAULT '',
  `seq_submodule` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`seq_id`) USING BTREE,
  UNIQUE KEY `seq_pattern` (`seq_pattern`),
  UNIQUE KEY `seq_module_seqq_submodule` (`seq_module`,`seq_submodule`) USING BTREE,
  KEY `FK_sequence_seq_user_usr_author` (`fk_seq_id_author`),
  KEY `FK_sequence_seq_user_usr_update` (`fk_seq_id_updater`),
  CONSTRAINT `FK_sequence_seq_user_usr_author` FOREIGN KEY (`fk_seq_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_sequence_seq_user_usr_update` FOREIGN KEY (`fk_seq_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. sessions
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(191) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. stock_movement_stm
CREATE TABLE IF NOT EXISTS `stock_movement_stm` (
  `stm_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID du mouvement',
  `stm_created` datetime NOT NULL DEFAULT current_timestamp(),
  `stm_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Date de dernière modification',
  `fk_usr_id_author` int(11) NOT NULL COMMENT 'ID utilisateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL COMMENT 'Utilisateur ayant fait la dernière modification',
  `stm_ref` varchar(50) DEFAULT NULL COMMENT 'Référence du mouvement',
  `fk_prt_id` int(11) NOT NULL COMMENT 'ID du produit',
  `fk_whs_id` int(11) NOT NULL COMMENT 'ID de l''entrepôt',
  `stm_qty` decimal(15,2) NOT NULL COMMENT 'Quantité',
  `stm_direction` tinyint(1) NOT NULL COMMENT '1=Entrée, -1=Sortie',
  `stm_date` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Date du mouvement',
  `stm_origin_doc_type` varchar(50) DEFAULT NULL COMMENT 'stm_origin_doc_type',
  `stm_origin_doc_id` int(11) DEFAULT NULL COMMENT 'ID du document origine',
  `stm_origin_doc_ref` varchar(50) DEFAULT NULL COMMENT 'Référence du document origine',
  `stm_label` varchar(50) NOT NULL,
  `stm_notes` text DEFAULT NULL COMMENT 'Note sur le mouvement',
  `stm_unit_price` decimal(15,4) DEFAULT 0.0000 COMMENT 'Prix unitaire',
  `stm_total_value` decimal(15,2) GENERATED ALWAYS AS (`stm_qty` * `stm_unit_price`) STORED COMMENT 'Valeur totale',
  `stm_lot_number` varchar(50) DEFAULT NULL COMMENT 'Numéro de lot',
  `stm_serial_number` varchar(50) DEFAULT NULL COMMENT 'Numéro de série',
  `stm_expiry_date` date DEFAULT NULL COMMENT 'Date de péremption',
  `stm_source_type` varchar(30) DEFAULT NULL COMMENT 'Type document: DELIVERY_NOTE, PURCHASE_ORDER, SALE_ORDER, etc.',
  `stm_source_id` int(11) DEFAULT NULL COMMENT 'ID du document source',
  `fk_dln_id` int(11) DEFAULT NULL COMMENT 'ID du bon de livraison/réception lié',
  `fk_ord_id` int(11) DEFAULT NULL COMMENT 'ID commande client liée',
  `fk_por_id` int(11) DEFAULT NULL COMMENT 'ID commande fournisseur liée',
  `fk_whs_dest_id` int(11) DEFAULT NULL COMMENT 'Entrepôt destination (transferts)',
  `fk_stm_paired_id` int(11) DEFAULT NULL COMMENT 'ID du mouvement jumelé (transfert)',
  PRIMARY KEY (`stm_id`) USING BTREE,
  KEY `idx_stm_date` (`stm_date`) USING BTREE,
  KEY `idx_stm_prt` (`fk_prt_id`) USING BTREE,
  KEY `idx_stm_whs` (`fk_whs_id`) USING BTREE,
  KEY `idx_stm_source` (`stm_source_type`,`stm_source_id`) USING BTREE,
  KEY `idx_stm_dln` (`fk_dln_id`) USING BTREE,
  KEY `idx_stm_lot` (`stm_lot_number`) USING BTREE,
  KEY `idx_stm_serial` (`stm_serial_number`) USING BTREE,
  KEY `fk_stm_whs_dest` (`fk_whs_dest_id`) USING BTREE,
  KEY `fk_stm_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `stock_movement_stm_ibfk_1` (`fk_usr_id_updater`) USING BTREE,
  KEY `idx_stm_reference` (`stm_ref`) USING BTREE,
  CONSTRAINT `fk_stm_dln` FOREIGN KEY (`fk_dln_id`) REFERENCES `delivery_note_dln` (`dln_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stm_prt` FOREIGN KEY (`fk_prt_id`) REFERENCES `product_prt` (`prt_id`),
  CONSTRAINT `fk_stm_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `fk_stm_whs` FOREIGN KEY (`fk_whs_id`) REFERENCES `warehouse_whs` (`whs_id`),
  CONSTRAINT `fk_stm_whs_dest` FOREIGN KEY (`fk_whs_dest_id`) REFERENCES `warehouse_whs` (`whs_id`) ON DELETE SET NULL,
  CONSTRAINT `stock_movement_stm_ibfk_1` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Mouvements de stock (traçabilité complète)';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_article_tka
CREATE TABLE IF NOT EXISTS `ticket_article_tka` (
  `tka_id` int(11) NOT NULL AUTO_INCREMENT,
  `tka_created` timestamp NULL DEFAULT NULL,
  `tka_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tkt_id` int(11) NOT NULL,
  `fk_ctc_id_from` int(11) DEFAULT NULL,
  `fk_ctc_id_to` int(11) DEFAULT NULL,
  `tka_cc` mediumtext DEFAULT NULL,
  `tka_message` mediumtext DEFAULT NULL,
  `tka_date` datetime DEFAULT NULL,
  `tka_tps` int(11) NOT NULL DEFAULT 0,
  `tka_is_note` tinyint(4) NOT NULL DEFAULT 0,
  `fk_eml_id` int(11) DEFAULT NULL,
  `fk_usr_id` int(11) DEFAULT NULL,
  `tka_is_request` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tka_id`),
  KEY `FK_tc_ticket_article_tka_tc_ticket_tkt` (`tkt_id`),
  KEY `FK_tc_ticket_article_tka_tr_user_usr_to` (`fk_ctc_id_to`) USING BTREE,
  KEY `FK_tc_ticket_article_tka_tr_user_usr` (`fk_usr_id`),
  KEY `FK_tc_ticket_article_tka_contact_ctc` (`fk_ctc_id_from`),
  KEY `FK_tc_ticket_article_tka_tr_email_eml` (`fk_eml_id`),
  KEY `FK_ticket_article_tka_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_article_tka_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_article_tka_contact_ctc_from` FOREIGN KEY (`fk_ctc_id_from`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_ticket_article_tka_contact_ctc_to` FOREIGN KEY (`fk_ctc_id_to`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_ticket_article_tka_tc_ticket_tkt` FOREIGN KEY (`tkt_id`) REFERENCES `ticket_tkt` (`tkt_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ticket_article_tka_tr_email_eml` FOREIGN KEY (`fk_eml_id`) REFERENCES `message_email_account_eml` (`eml_id`),
  CONSTRAINT `FK_ticket_article_tka_tr_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_article_tka_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_article_tka_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_category_tkc
CREATE TABLE IF NOT EXISTS `ticket_category_tkc` (
  `tkc_id` int(11) NOT NULL AUTO_INCREMENT,
  `tkc_created` timestamp NULL DEFAULT NULL,
  `tkc_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tkc_label` varchar(50) NOT NULL,
  PRIMARY KEY (`tkc_id`) USING BTREE,
  UNIQUE KEY `tkc_label` (`tkc_label`),
  KEY `FK_ticket_category_tkc_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_category_tkc_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_category_tkc_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_category_tkc_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Ticket Priorité';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_config_tco
CREATE TABLE IF NOT EXISTS `ticket_config_tco` (
  `tco_id` int(11) NOT NULL AUTO_INCREMENT,
  `tco_updated` timestamp NOT NULL,
  `tco_created` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `fk_eml_id` int(11) DEFAULT NULL,
  `fk_emt_id_affectation` int(11) DEFAULT NULL,
  `fk_emt_id_answer` int(11) DEFAULT NULL,
  `fk_emt_id_acknowledgment` int(11) DEFAULT NULL,
  `tco_send_acknowledgment` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Envoyer un accusé de réception automatique à la création d''un ticket',
  PRIMARY KEY (`tco_id`) USING BTREE,
  KEY `FK_ticket_config_tco_user_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_ticket_config_tco_user_usr_updater` (`fk_usr_id_updater`) USING BTREE,
  KEY `FK_ticket_config_tco_message_email_account_eml` (`fk_eml_id`),
  KEY `FK_ticket_config_tco_message_template_emt_affectation` (`fk_emt_id_affectation`),
  KEY `FK_ticket_config_tco_message_template_emt_answer` (`fk_emt_id_answer`),
  KEY `FK_ticket_config_tco_message_template_emt_acknowledgment` (`fk_emt_id_acknowledgment`),
  CONSTRAINT `FK_ticket_config_tco_message_email_account_eml` FOREIGN KEY (`fk_eml_id`) REFERENCES `message_email_account_eml` (`eml_id`),
  CONSTRAINT `FK_ticket_config_tco_message_template_emt_acknowledgment` FOREIGN KEY (`fk_emt_id_acknowledgment`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_ticket_config_tco_message_template_emt_affectation` FOREIGN KEY (`fk_emt_id_affectation`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_ticket_config_tco_message_template_emt_answer` FOREIGN KEY (`fk_emt_id_answer`) REFERENCES `message_template_emt` (`emt_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_ticket_config_tco_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_config_tco_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_grade_tkg
CREATE TABLE IF NOT EXISTS `ticket_grade_tkg` (
  `tkg_id` int(11) NOT NULL AUTO_INCREMENT,
  `tkg_created` timestamp NULL DEFAULT NULL,
  `tkg_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tkg_label` varchar(50) NOT NULL COMMENT 'Libelle',
  `tkg_order` int(11) NOT NULL,
  `tkg_color` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`tkg_id`),
  UNIQUE KEY `tkg_label` (`tkg_label`),
  KEY `FK_ticket_grade_tkg_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_grade_tkg_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_grade_tkg_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_grade_tkg_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Ticket type';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_history_tkh
CREATE TABLE IF NOT EXISTS `ticket_history_tkh` (
  `tkh_id` int(11) NOT NULL AUTO_INCREMENT,
  `fk_tkt_id` int(11) NOT NULL,
  `fk_usr_id` int(11) DEFAULT NULL,
  `tkh_field` varchar(100) NOT NULL,
  `tkh_old_value` text DEFAULT NULL,
  `tkh_new_value` text DEFAULT NULL,
  `tkh_created` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`tkh_id`),
  KEY `idx_tkh_tkt` (`fk_tkt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_link_tkl
CREATE TABLE IF NOT EXISTS `ticket_link_tkl` (
  `tkl_id` int(11) NOT NULL AUTO_INCREMENT,
  `fk_tkt_id_from` int(11) NOT NULL,
  `fk_tkt_id_to` int(11) NOT NULL,
  `tkl_type` varchar(50) NOT NULL DEFAULT 'related',
  `tkl_created` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`tkl_id`),
  UNIQUE KEY `uq_tkl_pair` (`fk_tkt_id_from`,`fk_tkt_id_to`),
  KEY `idx_tkl_from` (`fk_tkt_id_from`),
  KEY `idx_tkl_to` (`fk_tkt_id_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_priority_tkp
CREATE TABLE IF NOT EXISTS `ticket_priority_tkp` (
  `tkp_id` int(11) NOT NULL AUTO_INCREMENT,
  `tkp_created` timestamp NULL DEFAULT NULL,
  `tkp_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tkp_label` varchar(50) NOT NULL,
  `tkp_order` int(11) DEFAULT 0,
  `tkp_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tkp_id`),
  UNIQUE KEY `tkp_label` (`tkp_label`),
  KEY `FK_ticket_priority_tkp_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_priority_tkp_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_priority_tkp_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_priority_tkp_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Ticket Priorité';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_source_tks
CREATE TABLE IF NOT EXISTS `ticket_source_tks` (
  `tks_id` int(11) NOT NULL AUTO_INCREMENT,
  `tks_created` timestamp NULL DEFAULT NULL,
  `tks_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tks_label` varchar(50) NOT NULL COMMENT 'Libelle',
  `tks_order` int(11) DEFAULT NULL COMMENT 'Ordre',
  `tks_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tks_id`),
  UNIQUE KEY `tks_label` (`tks_label`),
  KEY `FK_ticket_source_tks_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_source_tks_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_source_tks_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_source_tks_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_status_tke
CREATE TABLE IF NOT EXISTS `ticket_status_tke` (
  `tke_id` int(11) NOT NULL AUTO_INCREMENT,
  `tke_created` timestamp NULL DEFAULT NULL,
  `tke_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tke_label` varchar(50) NOT NULL COMMENT 'Libelle',
  `tke_order` int(11) NOT NULL COMMENT 'Ordre',
  `tke_color` varchar(50) NOT NULL DEFAULT '',
  `tke_icon` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`tke_id`),
  UNIQUE KEY `tke_label` (`tke_label`),
  KEY `FK_ticket_status_tke_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_status_tke_user_usr_updater` (`fk_usr_id_updater`),
  CONSTRAINT `FK_ticket_status_tke_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_status_tke_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Ticket Etat';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. ticket_tkt
CREATE TABLE IF NOT EXISTS `ticket_tkt` (
  `tkt_id` int(11) NOT NULL AUTO_INCREMENT,
  `tkt_number` varchar(20) DEFAULT NULL,
  `tkt_created` timestamp NULL DEFAULT NULL,
  `tkt_updated` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `tkt_label` varchar(300) NOT NULL,
  `fk_tke_id` int(11) NOT NULL,
  `fk_tkp_id` int(11) DEFAULT NULL,
  `fk_ptr_id` int(11) DEFAULT NULL,
  `fk_tkg_id` int(11) DEFAULT NULL,
  `tkt_tps` int(11) DEFAULT NULL,
  `fk_con_id` int(11) DEFAULT NULL,
  `fk_tks_id` int(11) DEFAULT NULL,
  `fk_tkc_id` int(11) DEFAULT NULL COMMENT 'Catégorie',
  `fk_usr_id_assignedto` int(11) DEFAULT NULL COMMENT 'Intervenant',
  `fk_ctc_id_opento` int(11) DEFAULT NULL,
  `fk_ctc_id_openby` int(11) DEFAULT NULL,
  `tkt_opendate` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `tkt_openbydatas` mediumtext DEFAULT NULL,
  `tkt_opdentodatas` mediumtext DEFAULT NULL,
  `tkt_closeby` varchar(320) DEFAULT NULL,
  `tkt_scheduled` datetime DEFAULT NULL,
  `tkt_merged_into` int(11) DEFAULT NULL,
  `tkt_merged_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tkt_id`),
  KEY `FK_tc_ticket_tkt_tr_user_usr` (`fk_usr_id_assignedto`) USING BTREE,
  KEY `FK_tc_ticket_tkt_tr_user_usr_openby` (`fk_ctc_id_openby`) USING BTREE,
  KEY `FK_tc_ticket_tkt_tr_user_usr_opento` (`fk_ctc_id_opento`) USING BTREE,
  KEY `FK_tc_ticket_tkt_tc_client_clt` (`fk_ptr_id`) USING BTREE,
  KEY `FK_ticket_tkt_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_ticket_tkt_user_usr_updater` (`fk_usr_id_updater`),
  KEY `FK_tc_ticket_tkt_tr_ticketetat_tke` (`fk_tke_id`) USING BTREE,
  KEY `FK_tc_ticket_tkt_tr_ticketpriorite_tkp` (`fk_tkp_id`) USING BTREE,
  KEY `FK_tc_ticket_tkt_tr_ticketsource_tks` (`fk_tks_id`) USING BTREE,
  KEY `FK_ticket_tkt_ticket_category_tkc` (`fk_tkc_id`),
  KEY `FK_ticket_tkt_ticket_grade_tkg` (`fk_tkg_id`),
  KEY `FK_ticket_tkt_contract_con` (`fk_con_id`),
  CONSTRAINT `FK_ticket_tkt_contract_con` FOREIGN KEY (`fk_con_id`) REFERENCES `contract_con` (`con_id`),
  CONSTRAINT `FK_ticket_tkt_partner_ptr` FOREIGN KEY (`fk_ptr_id`) REFERENCES `partner_ptr` (`ptr_id`),
  CONSTRAINT `FK_ticket_tkt_tc_contact_ctc_openby` FOREIGN KEY (`fk_ctc_id_openby`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_ticket_tkt_tc_contact_ctc_opento` FOREIGN KEY (`fk_ctc_id_opento`) REFERENCES `contact_ctc` (`ctc_id`),
  CONSTRAINT `FK_ticket_tkt_ticket_category_tkc` FOREIGN KEY (`fk_tkc_id`) REFERENCES `ticket_category_tkc` (`tkc_id`),
  CONSTRAINT `FK_ticket_tkt_ticket_grade_tkg` FOREIGN KEY (`fk_tkg_id`) REFERENCES `ticket_grade_tkg` (`tkg_id`),
  CONSTRAINT `FK_ticket_tkt_tr_ticketetat_tke` FOREIGN KEY (`fk_tke_id`) REFERENCES `ticket_status_tke` (`tke_id`),
  CONSTRAINT `FK_ticket_tkt_tr_ticketpriorite_tkp` FOREIGN KEY (`fk_tkp_id`) REFERENCES `ticket_priority_tkp` (`tkp_id`),
  CONSTRAINT `FK_ticket_tkt_tr_ticketsource_tks` FOREIGN KEY (`fk_tks_id`) REFERENCES `ticket_source_tks` (`tks_id`),
  CONSTRAINT `FK_ticket_tkt_tr_user_usr` FOREIGN KEY (`fk_usr_id_assignedto`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_tkt_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_ticket_tkt_user_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=42633 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Tickets';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. time_config_tmc
CREATE TABLE IF NOT EXISTS `time_config_tmc` (
  `tmc_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fk_prt_id` int(10) unsigned DEFAULT NULL COMMENT 'Produit utilisé pour la génération des factures depuis les saisies de temps',
  `tmc_created` timestamp NULL DEFAULT NULL,
  `tmc_updated` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`tmc_id`) USING BTREE,
  KEY `time_config_tmc_fk_prt_id_foreign` (`fk_prt_id`) USING BTREE
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. time_entry_ten
CREATE TABLE IF NOT EXISTS `time_entry_ten` (
  `ten_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `ten_date` date NOT NULL,
  `ten_start_time` time DEFAULT NULL,
  `ten_end_time` time DEFAULT NULL,
  `ten_duration` int(11) NOT NULL DEFAULT 0 COMMENT 'Durée en minutes',
  `ten_description` text DEFAULT NULL,
  `ten_tags` longtext DEFAULT NULL COMMENT 'Ex: ["réunion","développement","support"]' CHECK (json_valid(`ten_tags`)),
  `ten_status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=BROUILLON,1=SOUMIS,2=APPROUVÉ,3=FACTURÉ,4=REJETÉ',
  `ten_rejection_reason` text DEFAULT NULL COMMENT 'Motif de rejet par le manager',
  `ten_is_billable` tinyint(4) NOT NULL DEFAULT 1,
  `ten_hourly_rate` decimal(10,2) DEFAULT NULL COMMENT 'Taux override (null = taux projet)',
  `fk_ptr_id` int(10) unsigned DEFAULT NULL,
  `fk_tpr_id` int(10) unsigned DEFAULT NULL,
  `fk_usr_id` int(10) unsigned NOT NULL,
  `fk_inv_id` int(10) unsigned DEFAULT NULL COMMENT 'Facture liée si facturé',
  `ten_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `ten_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ten_id`),
  KEY `idx_ten_date` (`ten_date`),
  KEY `idx_ten_usr` (`fk_usr_id`),
  KEY `idx_ten_ptr` (`fk_ptr_id`),
  KEY `idx_ten_tpr` (`fk_tpr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. time_project_tpr
CREATE TABLE IF NOT EXISTS `time_project_tpr` (
  `tpr_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tpr_lib` varchar(255) NOT NULL,
  `tpr_description` text DEFAULT NULL,
  `tpr_status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=ACTIF, 1=ARCHIVÉ',
  `tpr_color` varchar(7) DEFAULT NULL COMMENT 'Couleur hex (#7c3aed) pour la vue semaine',
  `tpr_budget_hours` decimal(8,2) DEFAULT NULL COMMENT 'Budget heures (null = illimité)',
  `tpr_deadline` date DEFAULT NULL COMMENT 'Date limite du projet',
  `tpr_hourly_rate` decimal(10,2) DEFAULT NULL COMMENT 'Taux horaire HT par défaut',
  `fk_ptr_id` int(10) unsigned DEFAULT NULL,
  `fk_ord_id` int(10) unsigned DEFAULT NULL COMMENT 'Commande client liée (optionnel)',
  `tpr_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `tpr_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tpr_id`),
  KEY `idx_tpr_ptr` (`fk_ptr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. tr_signature_sig
CREATE TABLE IF NOT EXISTS `tr_signature_sig` (
  `sig_id` int(11) NOT NULL AUTO_INCREMENT,
  `sig_update` timestamp NOT NULL DEFAULT current_timestamp(),
  `sig_upby` varchar(320) NOT NULL,
  `sig_body` mediumtext NOT NULL COMMENT 'Signature',
  `clt_id` int(11) NOT NULL COMMENT 'Client',
  `sig_lib` varchar(50) NOT NULL COMMENT 'Libelle',
  PRIMARY KEY (`sig_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Signature';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. tr_ticketrecurrents_tkr
CREATE TABLE IF NOT EXISTS `tr_ticketrecurrents_tkr` (
  `tkr_id` int(11) NOT NULL AUTO_INCREMENT,
  `tkr_update` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tkr_upby` varchar(320) DEFAULT NULL,
  `tkr_lib` varchar(255) DEFAULT NULL,
  `tkr_isactive` int(11) NOT NULL DEFAULT 0,
  `tkr_datebegin` datetime NOT NULL,
  `tkr_dateend` datetime NOT NULL,
  `tkr_subject` varchar(255) NOT NULL,
  `tkr_message` mediumtext NOT NULL,
  `tkp_id` int(11) DEFAULT NULL,
  `tkr_periodicity` varchar(255) DEFAULT NULL COMMENT 'en seconde',
  `tkr_nextcreation` datetime DEFAULT NULL,
  `tkg_id` int(11) DEFAULT NULL,
  `clt_id` int(11) DEFAULT NULL,
  `clp_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tkr_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Tickets récurrents|loop2';

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. user_usr
CREATE TABLE IF NOT EXISTS `user_usr` (
  `usr_id` int(11) NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `fk_usr_id_author` int(11) DEFAULT NULL,
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `usr_login` varchar(320) NOT NULL,
  `usr_password` varchar(100) DEFAULT NULL,
  `usr_firstname` varchar(100) DEFAULT NULL,
  `usr_lastname` varchar(100) DEFAULT NULL,
  `usr_tel` varchar(20) DEFAULT NULL,
  `usr_gridsettings` mediumtext DEFAULT NULL,
  `usr_mobile` varchar(20) DEFAULT NULL,
  `usr_jobtitle` varchar(50) DEFAULT NULL,
  `clts_id` mediumtext DEFAULT NULL,
  `cltsexclu_id` mediumtext DEFAULT NULL,
  `usr_is_active` tinyint(4) NOT NULL DEFAULT 0,
  `usr_pic` blob DEFAULT NULL,
  `usr_is_seller` tinyint(4) NOT NULL DEFAULT 0,
  `usr_is_technician` tinyint(4) NOT NULL DEFAULT 0,
  `usr_is_employee` tinyint(4) NOT NULL DEFAULT 0,
  `fk_acc_id_employe` int(11) DEFAULT NULL,
  `fk_usr_id_manager` int(11) DEFAULT NULL,
  `usr_password_updated_at` datetime DEFAULT NULL COMMENT 'Date de dernière modification du mot de passe',
  `usr_failed_login_attempts` int(11) NOT NULL COMMENT '''Nombre de tentatives de connexion échouées consécutives''',
  `usr_locked_until` timestamp NULL DEFAULT NULL COMMENT '''Date/heure de fin de verrouillage temporaire''',
  `usr_permanent_lock` tinyint(4) NOT NULL DEFAULT 0,
  `usr_password_reset_token` varchar(64) DEFAULT NULL COMMENT 'Token hashé en SHA256',
  `usr_password_reset_token_expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`usr_id`),
  UNIQUE KEY `login_user` (`usr_login`),
  KEY `FK_user_usr_user_usr_author` (`fk_usr_id_author`),
  KEY `FK_user_usr_usr_updater` (`fk_usr_id_updater`),
  KEY `idx_usr_login_active` (`usr_login`,`usr_is_active`),
  KEY `FK_user_usr_account_account_acc` (`fk_acc_id_employe`),
  KEY `user_usr_fk_usr_id_manager_foreign` (`fk_usr_id_manager`),
  CONSTRAINT `FK_user_usr_account_account_acc` FOREIGN KEY (`fk_acc_id_employe`) REFERENCES `account_account_acc` (`acc_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_user_usr_user_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `FK_user_usr_usr_updater` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`),
  CONSTRAINT `user_usr_fk_usr_id_manager_foreign` FOREIGN KEY (`fk_usr_id_manager`) REFERENCES `user_usr` (`usr_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3831 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. vehicle_vhc
CREATE TABLE IF NOT EXISTS `vehicle_vhc` (
  `vhc_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vhc_created_at` timestamp NULL DEFAULT current_timestamp(),
  `vhc_updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_usr_id` int(11) NOT NULL,
  `vhc_name` varchar(100) NOT NULL,
  `vhc_registration` varchar(20) DEFAULT NULL,
  `vhc_fiscal_power` smallint(6) NOT NULL,
  `vhc_type` enum('car','motorcycle','moped') NOT NULL DEFAULT 'car',
  `vhc_is_active` tinyint(4) NOT NULL DEFAULT 1,
  `vhc_is_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`vhc_id`),
  KEY `idx_vhc_user` (`fk_usr_id`),
  KEY `idx_vhc_active` (`vhc_is_active`),
  CONSTRAINT `FK_vehicle_vhc_user_usr` FOREIGN KEY (`fk_usr_id`) REFERENCES `user_usr` (`usr_id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Les données exportées n'étaient pas sélectionnées.

-- Listage de la structure de table fr_skuria_sksuite-skuria. warehouse_whs
CREATE TABLE IF NOT EXISTS `warehouse_whs` (
  `whs_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID de l''entrepôt',
  `whs_created` datetime NOT NULL DEFAULT current_timestamp(),
  `whs_updated` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `fk_usr_id_author` int(11) NOT NULL COMMENT 'ID utilisateur créateur',
  `fk_usr_id_updater` int(11) DEFAULT NULL,
  `whs_code` varchar(20) NOT NULL COMMENT 'Code entrepôt',
  `whs_label` varchar(100) NOT NULL COMMENT 'Nom de l''entrepôt',
  `whs_type` tinyint(1) DEFAULT 1 COMMENT '1=Entrepôt principal, 2=Zone, 3=Emplacement, 4=Virtuel',
  `fk_parent_whs_id` int(11) DEFAULT NULL COMMENT 'ID de l''entrepôt parent (hiérarchie)',
  `whs_address` varchar(255) DEFAULT NULL COMMENT 'Adresse',
  `whs_city` varchar(100) DEFAULT NULL COMMENT 'Ville',
  `whs_zipcode` varchar(20) DEFAULT NULL COMMENT 'Code postal',
  `whs_country` varchar(50) DEFAULT 'France' COMMENT 'Pays',
  `whs_is_active` tinyint(1) DEFAULT 1 COMMENT '1=Actif, 0=Inactif',
  `whs_is_default` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`whs_id`) USING BTREE,
  UNIQUE KEY `uk_whs_code` (`whs_code`) USING BTREE,
  KEY `idx_whs_active` (`whs_is_active`) USING BTREE,
  KEY `idx_whs_parent` (`fk_parent_whs_id`) USING BTREE,
  KEY `fk_whs_usr_author` (`fk_usr_id_author`) USING BTREE,
  KEY `FK_warehouse_whs_user_usr` (`fk_usr_id_updater`) USING BTREE,
  CONSTRAINT `FK_warehouse_whs_user_usr` FOREIGN KEY (`fk_usr_id_updater`) REFERENCES `user_usr` (`usr_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_whs_parent` FOREIGN KEY (`fk_parent_whs_id`) REFERENCES `warehouse_whs` (`whs_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_whs_usr_author` FOREIGN KEY (`fk_usr_id_author`) REFERENCES `user_usr` (`usr_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='Entrepôts et emplacements de stockage';

-- Les données exportées n'étaient pas sélectionnées.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
