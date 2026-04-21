#!/bin/bash
# =============================================================
# reset_demo.sh
# Réinitialise la base de données de démonstration ZELMO
# Exécute : initialize_db.sql puis demo-data.sql
#
# Variables d'environnement attendues (ou fichier .env) :
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
#
# Usage : bash reset_demo.sh
# Cron  : 0 * * * * /scripts/reset_demo.sh >> /var/log/zelmo/reset_demo.log 2>&1
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# ---- Credentials (variables d'env ou valeurs par défaut) ----
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-zelmo}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"

MYSQL_OPTS="-h $DB_HOST -P $DB_PORT -u $DB_USER"
if [ -n "$DB_PASS" ]; then
    MYSQL_OPTS="$MYSQL_OPTS -p$DB_PASS"
fi

echo "$LOG_PREFIX ========== RESET DEMO ZELMO =========="
echo "$LOG_PREFIX Base : $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# ---- Vérification de la connexion ----
if ! mysql $MYSQL_OPTS -e "SELECT 1;" "$DB_NAME" > /dev/null 2>&1; then
    echo "$LOG_PREFIX ERREUR : impossible de se connecter à la base $DB_NAME"
    exit 1
fi

# ---- initialize_db.sql ----
echo "$LOG_PREFIX Exécution de initialize_db.sql..."
mysql $MYSQL_OPTS "$DB_NAME" < "$SCRIPT_DIR/initialize_db.sql"
echo "$LOG_PREFIX initialize_db.sql OK"

# ---- demo-data.sql ----
echo "$LOG_PREFIX Exécution de demo-data.sql..."
mysql $MYSQL_OPTS "$DB_NAME" < "$SCRIPT_DIR/demo-data.sql"
echo "$LOG_PREFIX demo-data.sql OK"

echo "$LOG_PREFIX ========== RESET TERMINÉ =========="
