# ZELMO — ERP, CRM, Ticketing, RH & Facturation Électronique Open Source

> Application de gestion d'entreprise complète, 100 % open source : comptabilité avancée, **facturation électronique Facture-X / PDP**, ventes, achats, CRM, stocks, RH, ticketing et suivi du temps.

Vous souhaitez tester l'application en live ? Rendez-vous sur **[demo.zelmo.fr](https://demo.zelmo.fr)** avec les identifiants suivants :
- **Email** : admin@demo-company.fr
- **Mot de passe** : demo2006

![Dashboard](docs/screenshots/dashboard.png)

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
   - [Facturation Électronique](#-facturation-électronique-facture-x--pdp)
   - [Comptabilité](#comptabilité)
   - [Ventes](#ventes)
   - [Achats](#achats)
   - [CRM](#crm--gestion-de-la-relation-client)
   - [Stocks](#stocks)
   - [RH & Notes de frais](#rh--notes-de-frais)
   - [Suivi du temps](#suivi-du-temps)
   - [Ticketing](#assistance--ticketing)
   - [Tableau de bord](#tableau-de-bord)
   - [Paramètres](#paramètres--administration)
2. [Stack technique](#stack-technique)
3. [Prérequis](#prérequis)
4. [Installation](#installation)
5. [Configuration multi-tenant](#configuration-multi-tenant)
6. [Premiers pas](#premiers-pas)
7. [Structure du projet](#structure-du-projet)
8. [Déploiement en production](#déploiement-en-production)
9. [Licence](#licence)

---

## Fonctionnalités

---

### ⚡ Facturation Électronique (Facture-X / PDP)

ZELMO intègre nativement la **facturation électronique française** conforme à la réforme issue de l'ordonnance 2021-1190, obligatoire pour toutes les entreprises assujetties à la TVA.

#### Génération Facture-X
- Génération automatique de fichiers **PDF/A-3 + XML CII (profil EN 16931)** — le standard européen Facture-X
- Données structurées embarquées dans le PDF : identité vendeur/acheteur, lignes, taxes, montants, conditions de paiement, mentions légales
- Compatible avec tous les logiciels comptables capables de lire le format Facture-X

#### Connexion à un PA/PDP configurable
- Architecture **agnostique du PA** : configurez l'URL API et le token Bearer de n'importe quel Partenaire Accrédité (PDP)
- Sélection par profil de connexion préconfigurés ou mode « Personnalisé »
- Test de connexion intégré depuis les paramètres société

#### Émission des factures clients
- Bouton **« Transmettre via PDP »** disponible sur chaque facture finalisée
- Workflow : génération Facture-X → validation du fichier → transmission au réseau PDP/PPF
- Transmission automatique optionnelle à la validation de la facture

#### Suivi du cycle de vie
- Suivi temps réel du statut PDP : **Déposée → Qualifiée → Mise à disposition → Acceptée / Refusée / Litige / Payée**
- Mise à jour automatique via webhooks entrants (signature HMAC vérifiée)
- Timeline des événements visible directement depuis la fiche facture

#### Réception des factures fournisseurs
- **Boîte de réception** dédiée aux factures reçues via le réseau PDP
- Actions disponibles : Visualiser le Facture-X, Importer en facture fournisseur brouillon, Accepter, Refuser
- Badge de notification dans la barre latérale pour les factures en attente de traitement

#### E-reporting
- Tableau de bord des périodes d'e-reporting (transactions B2C et B2B international)
- Transmission périodique des données au PPF
- Suivi des statuts par période (En attente / Transmis / Erreur)

#### Enregistrement entreprise auprès du PA
- Workflow guidé en 4 étapes (stepper modal) depuis les paramètres société
- Pré-remplissage automatique depuis les données légales de la société (SIREN, SIRET, TVA)
- Statut d'enregistrement visible (Enregistrée ✓ / Non enregistrée ✗)

<!-- SCREENSHOT : Transmission Facture-X -->
<!-- SCREENSHOT : Boîte de réception PDP -->

---

### Comptabilité

ZELMO embarque un moteur comptable complet couvrant l'ensemble du cycle de gestion financière d'une PME.

#### Plan comptable & journaux
- **Plan comptable** personnalisable (PCG français pré-chargé)
- **Journaux** : achats, ventes, banque, OD, à-nouveaux — configurables par type et par banque

#### Saisie comptable
- **Écritures manuelles** : saisie libre multi-lignes avec contrôle d'équilibre débit/crédit
- Génération automatique des **lignes TVA** à la saisie
- Validation / dé-validation des écritures avec contrôle de période
- Numérotation automatique paramétrable par journal et par exercice

#### Lettrage
- Lettrage manuel et automatique des comptes de tiers (clients, fournisseurs)
- Dé-lettrage avec recalcul instantané
- Indicateur visuel par écriture (colonnes lettrage/pointage)

#### Rapprochement bancaire
- Rapprochements par compte bancaire avec gestion des périodes
- Pointage ligne à ligne, calcul de l'écart en temps réel
- Solde initial / solde final / écart affiché en couleur (vert = équilibré)
- Historique de tous les rapprochements précédents
- Validation automatique à la sélection de la dernière ligne équilibrante

#### Déclarations de TVA
- Calcul automatique de la TVA collectée / déductible par période
- Export au format télédéclaration

#### Clôtures & exercices
- Clôtures de période avec protection des écritures
- Gestion multi-exercices

#### Import / Export comptable
- Import d'écritures depuis fichiers externes
- Export au format comptable standard (intégration logiciels tiers)
- Sauvegarde et restauration des données comptables

#### Rapports comptables
- **Grand livre** : détail de tous les mouvements par compte
- **Balance générale** : soldes débit/crédit par compte
- **Journaux comptables** : synthèse par journal et par période
- **Balance des tiers** : suivi des comptes clients et fournisseurs
- **Centralisation** : tableau récapitulatif par classe de comptes
- Export PDF et CSV pour chaque rapport

#### OCR factures
- Extraction automatique des données de factures fournisseurs via **Veryfi**
- Pré-remplissage des champs à partir d'une photo ou d'un PDF

<!-- SCREENSHOT : Journal comptable -->
<!-- SCREENSHOT : Rapprochement bancaire -->
<!-- SCREENSHOT : Grand livre -->

---

### Ventes

- **Devis** : création, envoi par e-mail, conversion en commande
- **Bons de commande client** : validation, suivi, génération de facture
- **Factures client** : facturation libre ou depuis commande, PDF généré côté serveur
- **Avoirs** : émission d'avoirs liés ou libres
- **Contrats** : contrats récurrents avec génération automatique de factures à échéance
- **Paiements** : encaissements, affectation multi-factures, solde restant dû en temps réel
- **Modes de paiement** : virement, chèque, espèces, CB, prélèvement, etc.
- **Bons de livraison** : expéditions liées aux commandes client
- Envoi de documents par e-mail directement depuis l'application

<!-- SCREENSHOT : Liste des factures -->
<!-- SCREENSHOT : Facture détail + PDF -->

---

### Achats

- **Devis fournisseur** : réception et comparaison d'offres
- **Bons de commande fournisseur** : création, validation, suivi
- **Réceptions** : réception partielle ou totale, création des écritures comptables
- **Factures fournisseur** : saisie manuelle ou depuis réception
- **Avoirs fournisseur** : traitement des retours et corrections
- **Paiements fournisseur** : règlements avec affectation sur factures
- Workflow d'approbation paramétrable

<!-- SCREENSHOT : Commandes achats -->

---

### CRM — Gestion de la relation client

- **Partenaires** : fiche entreprise complète (coordonnées, informations légales, SIREN/SIRET/TVA, coordonnées bancaires)
- **Contacts** : personnes physiques rattachées aux partenaires, rôles et responsabilités
- **Appareils / Équipements** : suivi du parc matériel client avec historique d'interventions
- **Opportunités** : pipeline commercial avec étapes personnalisables, montant et probabilité
- **Activités** : suivi des actions commerciales (appels, e-mails, RDV, tâches)
- Liaison CRM ↔ Ventes : conversion opportunité → devis → commande

<!-- SCREENSHOT : Pipeline CRM -->

---

### Stocks

- **Produits** : catalogue complet avec prix d'achat/vente, références, catégories
- **Variantes** : déclinaisons par attribut (taille, couleur, etc.)
- **Mouvements de stock** : entrées, sorties, ajustements manuels, traçabilité complète
- **Inventaires** : comptage physique, écarts et valorisation
- **Bons de livraison** : expéditions clients et réceptions fournisseurs
- **Entrepôts** : gestion multi-sites, affectation par entrepôt

<!-- SCREENSHOT : Gestion des stocks -->

---

### RH & Notes de frais

- **Notes de frais** : création avec justificatifs, catégorisation par type de dépense
- **Kilométrage** : suivi des déplacements avec barème officiel applicable
- **Workflow de validation** : soumission → validation manager → comptabilisation
- Export et reporting par collaborateur et par période

<!-- SCREENSHOT : Notes de frais -->

---

### Suivi du temps

- **Saisie quotidienne et hebdomadaire** : vue calendrier et tableau de bord
- **Projets & tâches** : organisation du temps par projet, tâche et client
- **Approbations** : validation des temps par les responsables
- **Rapports** : export et synthèse par période, projet ou collaborateur
- Facturation du temps passé depuis les projets

<!-- SCREENSHOT : Feuille de temps hebdomadaire -->

---

### Assistance & Ticketing

- **Tickets** : création, assignation à un agent, suivi de statut (Ouvert / En cours / Résolu / Fermé)
- **Base de connaissance** : articles de support et modèles de réponse réutilisables
- **Catégories** : organisation des tickets par domaine fonctionnel ou produit
- Liaisons inter-tickets (fusion, doublon, dépendance)
- Historique complet des échanges par ticket

<!-- SCREENSHOT : Liste des tickets -->

---

### Tableau de bord

- Vue consolidée de l'activité : ventes du jour/mois, factures en attente, tickets ouverts
- Graphiques : CA mensuel, évolution des paiements, répartition par catégorie
- Indicateurs clés personnalisables
- Accès rapide aux dernières actions et documents récents

<!-- SCREENSHOT : Dashboard avec graphiques -->

---

### Paramètres & Administration

- **Utilisateurs** : création de comptes, attribution de rôles, permissions granulaires (RBAC via Spatie)
- **Taxes** : configuration des taux de TVA (taux standard, réduit, exonéré, etc.)
- **Modes de paiement** : configuration des méthodes acceptées
- **Modèles d'e-mail** : templates HTML avec variables dynamiques par type de document
- **Séquences** : numérotation automatique configurable par type de document et exercice
- **Entreprise** : informations légales, logo, coordonnées, IBAN, mentions obligatoires
- **Coordonnées bancaires** : comptes bancaires liés à la société (IBAN, BIC, banque)
- **Facturation électronique** : configuration du PA/PDP, token d'authentification, webhook, enregistrement de l'entreprise
- **Entrepôts** : configuration des sites logistiques
- **Multi-tenant** : une installation pour plusieurs sociétés / bases de données distinctes

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend framework | React | 19 |
| UI Components | Ant Design | 6 |
| Data fetching | TanStack React Query | 5 |
| Routing | React Router | 7 |
| Build tool | Vite | 7 |
| Éditeur riche | TinyMCE | 8 |
| Graphiques | Ant Design Charts | 2 |
| PDF client | React PDF Renderer | 4 |
| Backend framework | Laravel | 12 |
| Langage backend | PHP | 8.2+ |
| Authentification API | Laravel Sanctum | 4 |
| Permissions RBAC | Spatie Laravel Permission | 6 |
| Base de données | MariaDB | 11.4+ / MySQL 8.0+ |
| Email | PHPMailer + IMAP | — |
| PDF serveur | TCPDF | 6 |
| Facture-X / XML CII | horstoeko/zugferd | 1.x |
| OCR factures | Veryfi SDK | — |

---

## Prérequis

### Serveur / Poste de développement

| Outil | Version minimale |
|-------|-----------------|
| PHP | 8.2 |
| Composer | 2.x |
| Node.js | 18+ |
| npm | 9+ |
| MariaDB / MySQL | 11.4 / 8.0 |

### Extensions PHP requises

```
pdo_mysql, mbstring, openssl, tokenizer, xml, ctype, json, bcmath, fileinfo, intl
```

---

## Installation

### 1. Base de données

```bash
# Créer la base de données
mysql -u root -p -e "CREATE DATABASE zelmo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Importer le schéma (tables, index, contraintes)
mysql -u root -p zelmo < database/schema.sql

# Initialiser les données de référence (rôles, permissions, config)
mysql -u root -p zelmo < database/initialize_db.sql

# (Optionnel) Données de démonstration
mysql -u root -p zelmo < database/demo-data.sql
```

> Voir [database/README.md](database/README.md) pour plus de détails.

---

### 2. Backend (Laravel)

```bash
cd backend

# Installer les dépendances PHP
composer install

# Configurer les tenants (voir section dédiée)
cp config/tenants.example.php config/tenants.php
# → Éditer config/tenants.php avec vos paramètres (DB, URL, clé)

# Générer la clé applicative (copier la valeur dans tenants.php)
php artisan key:generate --show

# Lier le storage public
php artisan storage:link

# Lancer le serveur de développement
php artisan serve --host=zelmo.local --port=8000
```

> ⚠️ Le fichier `config/tenants.php` contient des secrets — il est exclu du dépôt git.

---

### 3. Frontend (React)

```bash
cd frontend

# Installer les dépendances Node
npm install

# Configurer les variables d'environnement
cp .env.example .env
# → Éditer .env : VITE_API_BASE_URL=http://zelmo.local/api

# Lancer le serveur de développement
npm run dev

# Construire pour la production
npm run build
```

---

## Configuration multi-tenant

ZELMO supporte le **multi-tenant par domaine** : une même installation peut servir plusieurs clients, chacun avec sa propre base de données, son storage et ses paramètres.

La configuration est centralisée dans `backend/config/tenants.php` (exclu du git). Chaque entrée correspond à un nom de domaine HTTP :

```php
return [
    'zelmo.local' => [
        'app_key'      => 'base64:VOTRE_CLE',
        'app_url'      => 'http://zelmo.local',
        'app_name'     => 'ZELMO',
        'app_env'      => 'local',
        'app_debug'    => true,
        'frontend_url' => 'http://zelmo.local:5173',
        'database' => [
            'connection' => 'mariadb',
            'host'       => '127.0.0.1',
            'port'       => '3306',
            'database'   => 'zelmo',
            'username'   => 'root',
            'password'   => '',
        ],
        'storage_path' => 'tenants/zelmo',
        'session' => [
            'driver'   => 'database',
            'lifetime' => 120,
            'cookie'   => 'zelmo_session',
        ],
        'sanctum' => [
            'stateful_domains' => ['zelmo.local', 'zelmo.local:5173'],
        ],
    ],
];
```

Pour ajouter un second tenant, ajouter une nouvelle entrée avec un domaine différent.

> Documentation complète : [docs/MULTI-TENANT-CONFIG.md](docs/MULTI-TENANT-CONFIG.md)

---

## Premiers pas

Après installation, connectez-vous avec le compte administrateur par défaut :

| Champ | Valeur |
|-------|--------|
| Email | *(défini dans initialize_db.sql)* |
| Mot de passe | *(défini dans initialize_db.sql)* |

> Pensez à changer le mot de passe administrateur dès la première connexion.

**Étapes recommandées :**

1. **Paramètres → Entreprise** : renseigner les informations légales, le logo et les coordonnées bancaires
2. **Paramètres → Utilisateurs** : créer les comptes collaborateurs et affecter les rôles
3. **Paramètres → Taxes** : vérifier les taux de TVA
4. **Paramètres → Modes de paiement** : configurer les modes utilisés
5. **Paramètres → Facturation Électronique** : configurer le PA/PDP et enregistrer l'entreprise
6. **CRM → Partenaires** : importer ou créer les premiers clients/fournisseurs
7. **Comptabilité → Plan comptable** : adapter le plan de comptes si nécessaire

---

## Structure du projet

```
zelmo/
├── backend/                    # API Laravel 12
│   ├── app/
│   │   ├── Http/Controllers/   # 60+ contrôleurs API
│   │   ├── Models/             # Modèles Eloquent
│   │   ├── Services/           # Logique métier
│   │   │   ├── EInvoicing/     # Facturation électronique (Facture-X, PDP)
│   │   │   └── Pdf/            # Génération PDF (TCPDF)
│   │   ├── Traits/             # Comportements partagés (ex: HasGridFilters)
│   │   └── Policies/           # Autorisation par ressource
│   ├── config/
│   │   ├── tenants.example.php # Modèle de configuration (à copier)
│   │   └── tenants.php         # Configuration active (exclu du git ⚠️)
│   └── routes/
│       ├── api.php             # Routes API principales
│       ├── apiExpense.php      # Routes notes de frais
│       └── apiPartners.php     # Routes CRM
│
├── frontend/                   # Application React 19
│   ├── src/
│   │   ├── pages/              # Pages (accounting, crm, sales, hr, e-invoicing…)
│   │   ├── components/         # Composants réutilisables
│   │   ├── services/           # Clients API (axios)
│   │   ├── hooks/              # Hooks personnalisés
│   │   ├── contexts/           # React Context (auth)
│   │   └── utils/              # Utilitaires
│   └── .env.example            # Variables d'environnement (modèle)
│
├── database/                   # Scripts SQL
│   ├── schema.sql              # Schéma complet
│   ├── initialize_db.sql       # Données de référence initiales
│   ├── demo-data.sql           # Données de démonstration
│   └── generate_initialize_db.sh
│
├── docs/                       # Documentation technique
│   └── MULTI-TENANT-CONFIG.md  # Guide multi-tenant
│
├── .gitignore
└── README.md
```

---

## Déploiement en production

### Recommandations serveur

- **OS** : Linux (Debian/Ubuntu recommandé)
- **Serveur web** : Nginx ou Apache avec mod_rewrite
- **PHP-FPM** : PHP 8.2+
- **Base de données** : MariaDB 11.4+ ou MySQL 8.0+
- **HTTPS** : certificat SSL obligatoire (Let's Encrypt)

### Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
```

Configuration Nginx minimale (backend) :

```nginx
server {
    listen 443 ssl;
    server_name api.zelmo.com;
    root /var/www/zelmo/backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### Frontend

```bash
cd frontend
npm ci
npm run build
# Le dossier dist/ est à déployer sur le serveur web
```

---

## Licence

Ce projet est distribué sous licence **GNU AGPL v3**. Voir le fichier [LICENSE](LICENSE) pour plus d'informations.

- Usage et installation libres pour tous
- Toute modification ou fork doit rester open source sous la même licence
- Tout fork ou usage commercial doit citer l'original et nous contacter : contact@skuria.fr

---

*ZELMO — Développé avec Laravel & React — Outil développé par [skuria.fr](https://skuria.fr)*
