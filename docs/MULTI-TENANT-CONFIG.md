# Configuration Multi-Tenant SKSuite

Ce document décrit la configuration multi-tenant de SKSuite, permettant de connecter le backend à différentes bases de données et de configurer des chemins de stockage isolés en fonction de l'URL d'accès.

## Architecture

Le système multi-tenant fonctionne ainsi :
1. Le **Frontend** détecte son URL (`window.location.host`) et utilise la configuration correspondante pour appeler le bon backend
2. Le **Backend** détecte l'URL d'accès (`HTTP_HOST`) et configure dynamiquement la connexion à la base de données et le chemin de stockage

## Configuration Backend

### Fichier principal : `config/tenants.php`

Ce fichier contient la configuration de tous les tenants. Chaque clé correspond à l'URL d'accès au backend (HTTP_HOST).

```php
<?php
return [
    'sksuite-api.local' => [
        'app_key' => 'base64:xxxx',           // Clé de chiffrement Laravel
        'app_url' => 'http://sksuite-api.local',
        'app_name' => 'SKSuite Local',
        'app_env' => 'local',
        'app_debug' => true,
        'frontend_url' => 'http://localhost:5173',

        'database' => [
            'connection' => 'mariadb',
            'host' => '127.0.0.1',
            'port' => '3307',
            'database' => 'fr_skuria_sksuite-skuria',
            'username' => 'root',
            'password' => '',
        ],

        'storage_path' => 'tenants/sksuite-local',  // Relatif à storage/app/private/

        'session' => [
            'driver' => 'database',
            'lifetime' => 120,
            'cookie' => 'sksuite_session',
        ],

        'sanctum' => [
            'stateful_domains' => ['localhost', 'localhost:5173'],
        ],
    ],

    // Ajouter d'autres tenants ici...

    '_default' => [
        // Configuration par défaut (fallback)
    ],
];
```

### Structure des dossiers de stockage

```
storage/app/private/
├── tenants/
│   ├── sksuite-local/     # Tenant développement
│   │   ├── documents/
│   │   ├── temp/
│   │   └── ...
│   ├── client1/           # Tenant client 1
│   └── default/           # Tenant par défaut
```

### Utilisation dans le code

```php
use App\Services\TenantService;

// Récupérer la configuration complète du tenant
$tenant = TenantService::resolve();

// Récupérer une valeur spécifique
$dbHost = TenantService::get('database.host');
$appName = TenantService::getAppName();
$storagePath = TenantService::getStoragePath();

// Vérifier l'environnement
if (TenantService::isProduction()) {
    // Code spécifique production
}

// Forcer un tenant (pour les tests ou commandes artisan)
TenantService::setTenant('sksuite-api.local');
```

### Ajouter un nouveau tenant

1. Ajouter une entrée dans `config/tenants.php`
2. Générer une nouvelle `app_key` avec `php artisan key:generate --show`
3. Créer la base de données correspondante
4. Les dossiers de stockage seront créés automatiquement

## Configuration Frontend

### Fichier : `src/utils/config.js`

```javascript
export const TENANT_CONFIG = {
  'localhost:5173': {
    apiUrl: '/api',  // Utilise le proxy Vite en dev
    name: 'Développement Local',
  },
  'sksuite.skuria.fr': {
    apiUrl: 'https://api.sksuite.skuria.fr',
    name: 'SKSuite Skuria',
  },
  '_default': {
    apiUrl: '/api',
    name: 'SKSuite',
  },
};
```

### Utilisation

```javascript
import { getApiBaseUrl, getTenantName } from '../utils/config';

const apiUrl = getApiBaseUrl();  // Retourne l'URL de l'API du tenant actuel
const name = getTenantName();    // Retourne le nom du tenant
```

## Session et Timeout d'inactivité

### Configuration du timeout

Dans `src/utils/config.js` :

```javascript
export const SECURITY_CONFIG = {
  INACTIVITY_TIMEOUT: 7200000,  // 2 heures en ms
  INACTIVITY_WARNING: 300000,   // Warning 5 min avant déconnexion
};
```

### Fonctionnement

1. L'utilisateur connecté est surveillé pour détecter l'inactivité
2. Après 1h55 d'inactivité, un modal d'avertissement s'affiche
3. L'utilisateur peut :
   - Cliquer sur "Rester connecté" pour réinitialiser le timer
   - Cliquer sur "Se déconnecter" ou attendre 5 minutes pour être déconnecté
4. Les événements surveillés : `mousemove`, `keydown`, `click`, `scroll`, `touchstart`
5. Les appels API réinitialisent également le timer

## Migration depuis .env

Le fichier `.env` a été remplacé par `config/tenants.php`. Voici la correspondance :

| .env                    | config/tenants.php           |
|------------------------|------------------------------|
| `APP_KEY`              | `app_key`                    |
| `APP_URL`              | `app_url`                    |
| `APP_NAME`             | `app_name`                   |
| `APP_ENV`              | `app_env`                    |
| `APP_DEBUG`            | `app_debug`                  |
| `FRONTEND_URL`         | `frontend_url`               |
| `DB_HOST`              | `database.host`              |
| `DB_PORT`              | `database.port`              |
| `DB_DATABASE`          | `database.database`          |
| `DB_USERNAME`          | `database.username`          |
| `DB_PASSWORD`          | `database.password`          |
| `SESSION_DRIVER`       | `session.driver`             |
| `SESSION_LIFETIME`     | `session.lifetime`           |
| `SANCTUM_STATEFUL_DOMAINS` | `sanctum.stateful_domains` |

## Sécurité

- Chaque tenant doit avoir une `app_key` **unique** en production
- Les mots de passe des bases de données ne doivent **jamais** être commités
- Utiliser des variables d'environnement serveur ou un gestionnaire de secrets pour les données sensibles en production
- Le fichier `config/tenants.php` devrait être dans `.gitignore` pour la production

## Commandes Artisan utiles

```bash
# Générer une nouvelle clé d'application
php artisan key:generate --show

# Vider le cache de configuration
php artisan config:clear

# Exécuter les migrations
php artisan migrate

# Lister les tenants configurés
php artisan tinker
>>> \App\Services\TenantService::getAllTenants()
```
