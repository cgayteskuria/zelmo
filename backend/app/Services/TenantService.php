<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;


/**
 * Service de gestion multi-tenant
 *
 * Ce service résout automatiquement le tenant en fonction de l'URL d'accès (HTTP_HOST)
 * et fournit les méthodes pour accéder à sa configuration.
 *
 * Usage:
 *   $tenant = TenantService::resolve();
 *   $storagePath = TenantService::getStoragePath();
 *   $dbConfig = TenantService::getDatabaseConfig();
 */
class TenantService
{
    /**
     * Configuration du tenant courant (mise en cache)
     */
    protected static ?array $currentTenant = null;

    /**
     * Clé du tenant courant (HTTP_HOST)
     */
    protected static ?string $currentTenantKey = null;

    /**
     * Résout le tenant en fonction de l'URL d'accès
     *
     * @return array Configuration complète du tenant
     */
    public static function resolve(): array
    {
        if (self::$currentTenant !== null) {
            return self::$currentTenant;
        }

        // Déterminer le host d'accès
        $host = self::detectHost();
        self::$currentTenantKey = $host;

        // Charger la configuration des tenants
        $tenantsConfig = self::loadTenantsConfig();

      /*  Log::debug('Tenant resolve', [
            'host' => $host,
            'tenants_keys' => array_keys(self::loadTenantsConfig()),
        ]);*/
        // Sélectionner la configuration du tenant
        if (isset($tenantsConfig[$host])) {
            self::$currentTenant = $tenantsConfig[$host];
        } else {
            // En mode CLI (artisan), ne pas bloquer - retourner un tableau vide
            if (php_sapi_name() === 'cli' || php_sapi_name() === 'cli-server') {
                self::$currentTenant = [];
                return self::$currentTenant;
            }

            // En mode HTTP, un domaine inconnu retourne une erreur 503
            abort(503, "Tenant non configuré pour le domaine : {$host}");
        }

        return self::$currentTenant;
    }

    /**
     * Détecte le host d'accès
     *
     * @return string
     */
    protected static function detectHost(): string
    {
        // Priorité: HTTP_HOST > SERVER_NAME > localhost
        if (isset($_SERVER['HTTP_HOST']) && !empty($_SERVER['HTTP_HOST'])) {
            return strtolower($_SERVER['HTTP_HOST']);
        }

        if (isset($_SERVER['SERVER_NAME']) && !empty($_SERVER['SERVER_NAME'])) {
            return strtolower($_SERVER['SERVER_NAME']);
        }

        return 'localhost';
    }

    /**
     * Charge la configuration des tenants depuis le fichier config
     *
     * Note: Cette méthode est appelée très tôt dans le bootstrap,
     * avant que le container Laravel soit complètement initialisé.
     * On charge donc le fichier directement.
     *
     * @return array
     */
    protected static function loadTenantsConfig(): array
    {
      
        // Si config() est disponible, l'utiliser
        if (function_exists('config') && app()->bound('config')) {
            $config = config('tenants');
            if ($config !== null) {
                return $config;
            }
        }

        // Sinon, charger directement le fichier
        $configPath = base_path('config/tenants.php');
        if (file_exists($configPath)) {
            return require $configPath;
        }

        return [];
    }

    /**
     * Retourne la clé du tenant courant (HTTP_HOST utilisé)
     *
     * @return string|null
     */
    public static function getCurrentTenantKey(): ?string
    {
        if (self::$currentTenantKey === null) {
            self::resolve();
        }
        return self::$currentTenantKey;
    }

    /**
     * Retourne le chemin de stockage privé du tenant
     *
     * @return string Chemin absolu du dossier de stockage
     */
    public static function getStoragePath(): string
    {
        $tenant = self::resolve();
        $relativePath = $tenant['storage_path'] ?? 'tenants/default';

        return storage_path('app/private/' . $relativePath);
    }

    /**
     * Retourne le chemin de stockage public du tenant
     *
     * @return string Chemin absolu du dossier de stockage public
     */
    public static function getPublicStoragePath(): string
    {
        $tenant = self::resolve();
        $relativePath = $tenant['storage_path'] ?? 'tenants/default';

        return storage_path('app/public/' . $relativePath);
    }

    /**
     * Retourne la configuration de la base de données du tenant
     *
     * @return array
     */
    public static function getDatabaseConfig(): array
    {
        $tenant = self::resolve();
        return $tenant['database'] ?? [];
    }

    /**
     * Retourne une valeur de configuration du tenant
     *
     * @param string $key Clé de configuration (supporte la notation pointée: 'database.host')
     * @param mixed $default Valeur par défaut
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        $tenant = self::resolve();

        // Support de la notation pointée
        $keys = explode('.', $key);
        $value = $tenant;

        foreach ($keys as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    /**
     * Retourne le nom de l'application du tenant
     *
     * @return string
     */
    public static function getAppName(): string
    {
        return self::get('app_name', 'Zelmo');
    }

    /**
     * Retourne l'URL du frontend associé au tenant
     *
     * @return string
     */
    public static function getFrontendUrl(): string
    {
        return self::get('frontend_url', 'http://localhost:5173');
    }

    /**
     * Retourne l'URL du backend (app_url) du tenant
     *
     * @return string
     */
    public static function getAppUrl(): string
    {
        return self::get('app_url', 'http://localhost');
    }

    /**
     * Vérifie si le tenant courant est en mode debug
     *
     * @return bool
     */
    public static function isDebug(): bool
    {
        return (bool) self::get('app_debug', false);
    }

    /**
     * Retourne l'environnement du tenant (local, staging, production)
     *
     * @return string
     */
    public static function getEnvironment(): string
    {
        return self::get('app_env', 'local');
    }

    /**
     * Vérifie si on est en environnement de production
     *
     * @return bool
     */
    public static function isProduction(): bool
    {
        return self::getEnvironment() === 'production';
    }

    /**
     * Retourne la configuration Sanctum du tenant
     *
     * @return array
     */
    public static function getSanctumConfig(): array
    {
        return self::get('sanctum', []);
    }

    /**
     * Retourne les domaines stateful pour Sanctum
     *
     * @return array
     */
    public static function getStatefulDomains(): array
    {
        return self::get('sanctum.stateful_domains', []);
    }

    /**
     * Retourne la configuration de session du tenant
     *
     * @return array
     */
    public static function getSessionConfig(): array
    {
        return self::get('session', []);
    }

    /**
     * Réinitialise le cache du tenant (utile pour les tests)
     *
     * @return void
     */
    public static function reset(): void
    {
        self::$currentTenant = null;
        self::$currentTenantKey = null;
    }

    /**
     * Force un tenant spécifique (utile pour les tests ou les commandes artisan)
     *
     * @param string $tenantKey Clé du tenant
     * @return bool True si le tenant existe et a été défini
     */
    public static function setTenant(string $tenantKey): bool
    {
        $tenantsConfig = self::loadTenantsConfig();

        if (!isset($tenantsConfig[$tenantKey])) {
            return false;
        }


        self::$currentTenant = $tenantsConfig[$tenantKey];
        self::$currentTenantKey = $tenantKey;

        return true;
    }

    /**
     * Retourne la liste de tous les tenants configurés
     *
     * @param bool $includeDefault Inclure la configuration _default
     * @return array
     */
    public static function getAllTenants(bool $includeDefault = false): array
    {
        $tenantsConfig = self::loadTenantsConfig();

        if (!$includeDefault) {
            unset($tenantsConfig['_default']);
        }

        return $tenantsConfig;
    }


    public static function resolveFromUrl(string $url): ?array
    {
        $tenants = self::loadTenantsConfig();

        // Nettoyer l'URL
        $host = preg_replace('#^https?://#', '', rtrim($url, '/'));

        // Chercher dans le tableau
        if (isset($tenants[$host])) {
            return $tenants[$host];
        }


        // Retourne null si non trouvé
        return null;
    }
}
