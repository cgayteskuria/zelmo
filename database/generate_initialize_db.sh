#!/bin/bash
# =============================================================
# generate_initialize_db.sh
# Génère initialize_db.sql — snapshot des tables de référence
#
# Usage : bash generate_initialize_db.sh [tenant]
#   tenant : clé dans backend/config/tenants.php
#            défaut : skuria-sksuite.local
#
# Exemple : bash generate_initialize_db.sh skuria-sksuite.local
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/backend/config/tenants.php"
OUTPUT_FILE="$SCRIPT_DIR/initialize_db.sql"
TENANT="${1:-skuria-sksuite.local}"

# ---- Binaires MariaDB (WAMP64) ----
MARIADB_BIN="/c/wamp64/bin/mariadb/mariadb11.4.9/bin"
MYSQL_BIN="$MARIADB_BIN/mariadb.exe"
MYSQLDUMP_BIN="$MARIADB_BIN/mariadb-dump.exe"
# Fallback sur les commandes PATH si WAMP introuvable
if [ ! -f "$MYSQL_BIN" ]; then
    MYSQL_BIN=$(which mysql 2>/dev/null || which mariadb 2>/dev/null || echo "mysql")
    MYSQLDUMP_BIN=$(which mysqldump 2>/dev/null || which mariadb-dump 2>/dev/null || echo "mysqldump")
fi

# ---- Lecture des credentials via PHP ----
if [ ! -f "$TENANTS_FILE" ]; then
    echo "❌ Fichier introuvable : $TENANTS_FILE"
    exit 1
fi

# Convertit le chemin Git Bash (/c/Users/...) en chemin Windows (C:/Users/...)
# pour que PHP puisse ouvrir le fichier sous Windows
_to_win_path() {
    local p="$1"
    # /c/... → C:/...
    echo "$p" | sed -E 's|^/([a-zA-Z])/|\1:/|'
}
TENANTS_WIN="$(_to_win_path "$TENANTS_FILE")"

_php_get() {
    php -r "\$t = include('$TENANTS_WIN'); echo \$t['$TENANT']['database']['$1'] ?? '';"
}

DB_HOST="$(_php_get host)"
DB_PORT="$(_php_get port)"
DB_NAME="$(_php_get database)"
DB_USER="$(_php_get username)"
DB_PASS="$(_php_get password)"

if [ -z "$DB_NAME" ]; then
    echo "❌ Tenant '$TENANT' introuvable dans tenants.php"
    echo "   Tenants disponibles :"
    php -r "\$t = include('$TENANTS_WIN'); foreach(array_keys(\$t) as \$k) echo '   - '.\$k.PHP_EOL;"
    exit 1
fi

echo "→ Tenant  : $TENANT"
echo "→ Base    : $DB_NAME"
echo "→ Serveur : $DB_USER@$DB_HOST:$DB_PORT"

# ---- Options mysqldump ----
_CONN=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
if [ -n "$DB_PASS" ]; then
    _CONN+=("-p$DB_PASS")
fi

# ---- Tables à exporter ----
EXPORT_TABLES=(
    user_usr
    sequence_seq
    roles
    role_has_permissions
    permissions
    model_has_roles
    model_has_permissions
    mileage_scale_msc
    message_template_emt
    menu_mnu
    expense_config_eco
    expense_categories_exc
    duration_dur
    contract_config_cco
    charge_type_cht
    company_cop
    account_tax_tax
    account_tax_tag_ttg
    account_tax_report_mapping_trm
    account_tax_repartition_line_trl
    account_tax_repartition_line_tag_rel_rtr
    account_tax_position_tap
    account_tax_position_correspondence_tac
    account_journal_ajl
    account_exercise_aex
    account_config_aco
    account_account_acc
)

# ---- En-tête ----
cat > "$OUTPUT_FILE" << HEADER
-- =============================================================
-- initialize_db.sql
-- Tenant  : $TENANT
-- Base    : $DB_NAME
-- Généré  : $(date '+%Y-%m-%d %H:%M:%S')
-- NE PAS MODIFIER MANUELLEMENT — relancer generate_initialize_db.sh
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = '';

-- =============================================================
-- PARTIE 1 — TRUNCATE COMPLET DE TOUTES LES TABLES
-- =============================================================

-- Permissions & rôles
TRUNCATE TABLE \`model_has_permissions\`;
TRUNCATE TABLE \`model_has_roles\`;
TRUNCATE TABLE \`role_has_permissions\`;
TRUNCATE TABLE \`permissions\`;
TRUNCATE TABLE \`roles\`;
TRUNCATE TABLE \`personal_access_tokens\`;

-- Utilisateurs
TRUNCATE TABLE \`user_usr\`;

-- Partenaires & contacts
TRUNCATE TABLE \`partner_ptr\`;
TRUNCATE TABLE \`contact_ctc\`;
TRUNCATE TABLE \`contact_partner_ctp\`;
TRUNCATE TABLE \`contact_device_ctd\`;
TRUNCATE TABLE \`bank_details_bts\`;
TRUNCATE TABLE \`device_dev\`;

-- Produits & stocks
TRUNCATE TABLE \`product_prt\`;
TRUNCATE TABLE \`product_stock_psk\`;
TRUNCATE TABLE \`product_commissioning_prc\`;
TRUNCATE TABLE \`stock_movement_stm\`;
TRUNCATE TABLE \`warehouse_whs\`;

-- Ventes
TRUNCATE TABLE \`sale_order_line_orl\`;
TRUNCATE TABLE \`sale_order_ord\`;
TRUNCATE TABLE \`sale_config_sco\`;

-- Achats
TRUNCATE TABLE \`purchase_order_line_pol\`;
TRUNCATE TABLE \`purchase_order_por\`;
TRUNCATE TABLE \`purchase_order_config_pco\`;

-- Facturation
TRUNCATE TABLE \`invoice_line_inl\`;
TRUNCATE TABLE \`invoice_inv\`;
TRUNCATE TABLE \`invoice_config_ico\`;
TRUNCATE TABLE \`payment_allocation_pal\`;
TRUNCATE TABLE \`payment_pay\`;
TRUNCATE TABLE \`payment_mode_pam\`;

-- Contrats
TRUNCATE TABLE \`contract_line_col\`;
TRUNCATE TABLE \`contract_invoice_coi\`;
TRUNCATE TABLE \`contract_con\`;
TRUNCATE TABLE \`contract_config_cco\`;

-- Livraisons
TRUNCATE TABLE \`delivery_note_line_dnl\`;
TRUNCATE TABLE \`delivery_note_dln\`;

-- Comptabilité
TRUNCATE TABLE \`account_transfer_atr\`;
TRUNCATE TABLE \`account_bank_reconciliation_abr\`;
TRUNCATE TABLE \`account_backup_aba\`;
TRUNCATE TABLE \`account_import_export_aie\`;
TRUNCATE TABLE \`account_exercise_aex\`;
TRUNCATE TABLE \`account_account_acc\`;
TRUNCATE TABLE \`account_config_aco\`;
TRUNCATE TABLE \`account_journal_ajl\`;
TRUNCATE TABLE \`account_move_amo\`;
TRUNCATE TABLE \`account_move_line_aml\`;
TRUNCATE TABLE \`account_tax_declaration_line_vdl\`;
TRUNCATE TABLE \`account_tax_declaration_vdc\`;
TRUNCATE TABLE \`account_tax_position_correspondence_tac\`;
TRUNCATE TABLE \`account_tax_position_tap\`;
TRUNCATE TABLE \`account_tax_repartition_line_tag_rel_rtr\`;
TRUNCATE TABLE \`account_tax_repartition_line_trl\`;
TRUNCATE TABLE \`account_tax_report_mapping_trm\`;
TRUNCATE TABLE \`account_tax_tag_ttg\`;
TRUNCATE TABLE \`account_tax_tax\`;

-- Documents
TRUNCATE TABLE \`document_doc\`;
TRUNCATE TABLE \`tr_signature_sig\`;

-- Assistance
TRUNCATE TABLE \`ticket_article_tka\`;
TRUNCATE TABLE \`ticket_tkt\`;
TRUNCATE TABLE \`ticket_config_tco\`;
TRUNCATE TABLE \`ticket_category_tkc\`;
TRUNCATE TABLE \`ticket_grade_tkg\`;
TRUNCATE TABLE \`ticket_priority_tkp\`;
TRUNCATE TABLE \`ticket_source_tks\`;
TRUNCATE TABLE \`ticket_status_tke\`;
TRUNCATE TABLE \`tr_ticketrecurrents_tkr\`;

-- Notes de frais
TRUNCATE TABLE \`expense_lines_exl\`;
TRUNCATE TABLE \`expense_reports_exr\`;
TRUNCATE TABLE \`expenses_exp\`;
TRUNCATE TABLE \`expense_categories_exc\`;
TRUNCATE TABLE \`expense_config_eco\`;

-- Charges
TRUNCATE TABLE \`charge_che\`;
TRUNCATE TABLE \`charge_type_cht\`;

-- Séquences & configuration
TRUNCATE TABLE \`sequence_seq\`;
TRUNCATE TABLE \`duration_dur\`;

-- Messagerie & templates
TRUNCATE TABLE \`message_mes\`;
TRUNCATE TABLE \`message_email_account_eml\`;
TRUNCATE TABLE \`message_template_emt\`;

-- Entreprise
TRUNCATE TABLE \`company_cop\`;

-- Logs & tâches
TRUNCATE TABLE \`logs_log\`;
TRUNCATE TABLE \`cron_task_cta\`;

-- Prospect
TRUNCATE TABLE \`prospect_activity_pac\`;
TRUNCATE TABLE \`prospect_opportunity_opp\`;
TRUNCATE TABLE \`prospect_pipeline_stage_pps\`;
TRUNCATE TABLE \`prospect_source_pso\`;
TRUNCATE TABLE \`prospect_lost_reason_plr\`;

-- Barème kilométrique
TRUNCATE TABLE \`mileage_scale_msc\`;

-- Menu
TRUNCATE TABLE \`menu_mnu\`;

-- Grille settings utilisateurs
TRUNCATE TABLE \`usr_gridsettings\`;

-- =============================================================
-- PARTIE 2 — RECHARGEMENT DES DONNÉES DE RÉFÉRENCE
-- =============================================================

HEADER

echo "→ Export des données..."

for TABLE in "${EXPORT_TABLES[@]}"; do
    printf "   - %-50s" "$TABLE"

    EXISTS=$("$MYSQL_BIN" "${_CONN[@]}" "$DB_NAME" -sN -e \
        "SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema='$DB_NAME' AND table_name='$TABLE';" 2>/dev/null || echo "0")

    if [ "$EXISTS" = "0" ]; then
        echo "⚠  introuvable"
        printf '\n-- ⚠ Table `%s` introuvable lors de la génération\n' "$TABLE" >> "$OUTPUT_FILE"
        continue
    fi

    COUNT=$("$MYSQL_BIN" "${_CONN[@]}" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM \`$TABLE\`;" 2>/dev/null || echo "0")
    echo "$COUNT ligne(s)"

    {
        echo ""
        echo "-- ---------------------------------------------------------"
        echo "-- Table : \`$TABLE\` ($COUNT ligne(s))"
        echo "-- ---------------------------------------------------------"
    } >> "$OUTPUT_FILE"

    if [ "$COUNT" = "0" ]; then
        echo "-- (table vide)" >> "$OUTPUT_FILE"
        continue
    fi

    "$MYSQLDUMP_BIN" "${_CONN[@]}" \
        --no-create-info \
        --replace \
        --skip-triggers \
        --compact \
        --single-transaction \
        "$DB_NAME" "$TABLE" 2>/dev/null >> "$OUTPUT_FILE"
done

# ---- Pied de fichier ----
cat >> "$OUTPUT_FILE" << 'FOOTER'

-- =============================================================
SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================
-- FIN initialize_db.sql
-- =============================================================
FOOTER

echo ""
echo "✅ Fichier généré : $OUTPUT_FILE"
echo ""
echo "   Pour réinitialiser la base :"
echo "   mysql ${_CONN[*]} $DB_NAME < initialize_db.sql"
echo ""
echo "   Pour planifier toutes les heures (crontab) :"
echo "   0 * * * * mysql ${_CONN[*]} $DB_NAME < $OUTPUT_FILE >> /var/log/initialize_db.log 2>&1"
