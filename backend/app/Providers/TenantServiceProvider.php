<?php

namespace App\Providers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use App\Services\TenantService;
use Illuminate\Support\Facades\Log;

/**
 * Service Provider Multi-Tenant
 *
 * Ce provider est chargé en PREMIER pour configurer dynamiquement
 * la connexion à la base de données et les chemins de stockage
 * en fonction de l'URL d'accès au backend.
 *
 * IMPORTANT: Ce provider doit être listé AVANT tous les autres
 * dans bootstrap/providers.php
 */
class TenantServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        
        // Enregistrer le TenantService comme singleton
        $this->app->singleton(TenantService::class, function () {
            return new TenantService();
        });

        // Résoudre le tenant dès maintenant pour configurer la DB
        $this->configureTenant();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Les configurations sont déjà appliquées dans register()
        // On peut ajouter ici des logiques supplémentaires si nécessaire

    }

    /**
     * Configure l'application en fonction du tenant détecté
     */
    protected function configureTenant(): void
    {

        // Résoudre le tenant
        $tenant = TenantService::resolve();

        if (empty($tenant)) {
            return;
        }

        // Configuration de l'application
        $this->configureApp($tenant);

        // Configuration de la base de données
        $this->configureDatabase($tenant);

        // Configuration du stockage
        $this->configureStorage($tenant);

        // Configuration des sessions
        $this->configureSession($tenant);

        // Configuration de Sanctum
        $this->configureSanctum($tenant);

        // Configuration CORS
        $this->configureCors($tenant);
    }

    /**
     * Configure les paramètres généraux de l'application
     */
    protected function configureApp(array $tenant): void
    {
        $appConfig = [
            'app.name' => $tenant['app_name'] ?? 'Zelmo',
            'app.env' => $tenant['app_env'] ?? 'local',
            'app.debug' => $tenant['app_debug'] ?? false,
            'app.url' => $tenant['app_url'] ?? 'http://localhost',
            'app.key' => $tenant['app_key'] ?? '',
            'app.frontend_url' => $tenant['frontend_url'] ?? 'http://localhost:5173',
        ];

        foreach ($appConfig as $key => $value) {
            config([$key => $value]);
        }
    }

    /**
     * Configure la connexion à la base de données
     */
    protected function configureDatabase(array $tenant): void
    {
        $dbConfig = $tenant['database'] ?? [];

        if (empty($dbConfig)) {
            return;
        }

        $connection = $dbConfig['connection'] ?? 'mariadb';

        // Appliquer la configuration de la connexion
        $configKeys = [
            "database.connections.{$connection}.host" => $dbConfig['host'] ?? '127.0.0.1',
            "database.connections.{$connection}.port" => $dbConfig['port'] ?? '3306',
            "database.connections.{$connection}.database" => $dbConfig['database'] ?? 'laravel',
            "database.connections.{$connection}.username" => $dbConfig['username'] ?? 'root',
            "database.connections.{$connection}.password" => $dbConfig['password'] ?? '',
        ];

        // Ajouter charset et collation si définis
        if (isset($dbConfig['charset'])) {
            $configKeys["database.connections.{$connection}.charset"] = $dbConfig['charset'];
        }
        if (isset($dbConfig['collation'])) {
            $configKeys["database.connections.{$connection}.collation"] = $dbConfig['collation'];
        }

        foreach ($configKeys as $key => $value) {
            config([$key => $value]);
        }

        // S'assurer que la connexion par défaut est correcte
        config(['database.default' => $connection]);

        // Purger la connexion existante pour forcer une reconnexion avec la nouvelle config
        DB::purge($connection);
    }

    /**
     * Configure les chemins de stockage
     */
    protected function configureStorage(array $tenant): void
    {
        $storagePath = $tenant['storage_path'] ?? 'tenants/default';
        $basePath = storage_path('app/private/' . $storagePath);
        $publicPath = storage_path('app/public/' . $storagePath);

        // Créer les dossiers s'ils n'existent pas
        $this->ensureDirectoryExists($basePath);
        $this->ensureDirectoryExists($publicPath);

        // Configurer les disques de stockage
        config([
            'filesystems.disks.local.root' => $basePath,
            'filesystems.disks.private.root' => $basePath,
            'filesystems.disks.public.root' => $publicPath,
        ]);
    }

    /**
     * Configure les sessions
     */
    protected function configureSession(array $tenant): void
    {
        $sessionConfig = $tenant['session'] ?? [];
        if (empty($sessionConfig)) return;

        $map = [
            'driver' => 'session.driver',
            'lifetime' => 'session.lifetime',
            'cookie' => 'session.cookie',
            'domain' => 'session.domain',
            'secure' => 'session.secure',
            'same_site' => 'session.same_site',
        ];

        foreach ($map as $tenantKey => $laravelKey) {
            if (isset($sessionConfig[$tenantKey])) {
                config([$laravelKey => $sessionConfig[$tenantKey]]);
            }
        }
    }

    /**
     * Configure Sanctum pour l'authentification API
     */
    protected function configureSanctum(array $tenant): void
    {
        $sanctumConfig = $tenant['sanctum'] ?? [];

        if (isset($sanctumConfig['stateful_domains'])) {
            $domains = $sanctumConfig['stateful_domains'];
            config(['sanctum.stateful' => $domains]);
        }
    }

    /**
     * Configure les origins CORS en fonction du tenant
     */
    protected function configureCors(array $tenant): void
    {
        $frontendUrl = $tenant['frontend_url'] ?? null;
        $appUrl = $tenant['app_url'] ?? null;

        if ($frontendUrl || $appUrl) {
            $currentOrigins = config('cors.allowed_origins', []);
            $newOrigins = array_filter([$frontendUrl, $appUrl]);
            $merged = array_unique(array_merge($currentOrigins, $newOrigins));
            config(['cors.allowed_origins' => array_values($merged)]);
        }
    }

    /**
     * S'assure qu'un dossier existe, le crée si nécessaire
     */
    protected function ensureDirectoryExists(string $path): void
    {
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
    }
}
