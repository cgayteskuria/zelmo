# Base de données ZELMO

## Fichiers SQL

| Fichier | Description | Utilisation |
|---------|-------------|-------------|
| `schema.sql` | Schéma complet (92 tables, index, contraintes) | Installation initiale |
| `initialize_db.sql` | Données de configuration et référentiel | Post-schéma |
| `demo-data.sql` | Données de démonstration | Optionnel (dev/demo) |

## Ordre d'exécution

```bash
# 1. Créer la base de données
mysql -u root -p -e "CREATE DATABASE zelmo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Importer le schéma
mysql -u root -p zelmo < schema.sql

# 3. Initialiser les données de référence
mysql -u root -p zelmo < initialize_db.sql

# 4. (Optionnel) Importer les données de démonstration
mysql -u root -p zelmo < demo-data.sql
```

## Régénérer initialize_db.sql

Le fichier `initialize_db.sql` est auto-généré. Ne pas le modifier manuellement.
Pour le régénérer depuis la racine du projet :

```bash
bash generate_initialize_db.sh
```
