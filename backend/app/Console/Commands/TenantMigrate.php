<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use App\Services\TenantService;
use Illuminate\Database\Events\MigrationStarted;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\DB;

class TenantMigrate extends Command
{
    /**
     * Le nom et signature de la commande.
     */
    protected $signature = 'tenant:migrate {url : L\'URL du tenant à migrer} {--force : Forcer la migration en prod}';

    /**
     * La description de la commande.
     */
    protected $description = 'Lance les migrations pour un tenant spécifique via son URL';

    /**
     * Execute la commande.
     */
    public function handle()
    {
        $url = $this->argument('url');
        $force = $this->option('force');

        $this->info("🔹 Migration pour le tenant : {$url}");

        // Résoudre le tenant via TenantService
        $tenant = TenantService::resolveFromUrl($url);

        if (!$tenant) {
            $this->error("❌ Aucun tenant trouvé pour l’URL : {$url}");
            return 1;
        }
        $db = $tenant['database'];
        $this->info("✅ Tenant : {$tenant['app_name']}");
        $this->info(" Host : {$db['host']}");
        $this->info(" Database : {$db['database']}");
        $this->info(" User : {$db['username']}");

        // Configurer la DB dynamiquement
        $this->configureTenantDatabase($tenant);

        // Lancer les migrations
        $this->info("⚡ Lancement des migrations...");

        // 1. On crée une variable pour stocker le nom du dernier fichier lancé
        $lastMigrationFile = "Inconnu";

        // 2. On écoute l'événement qui se déclenche juste avant chaque fichier
        Event::listen(MigrationStarted::class, function ($event) use (&$lastMigrationFile) {
            // Ceci récupère le nom de la classe, souvent proche du nom du fichier
            $lastMigrationFile = get_class($event->migration);
            $this->comment("   → Exécution de : " . $lastMigrationFile);
        });

           // Initialiser les variables de sortie
    $exitCode = 1;
    $seedExitCode = 1;
    $cacheExitCode = 1;

        try {

            $exitCode = Artisan::call('migrate', [
                '--force' => true,
                '--database' => $tenant['database']['connection'],
            ]);

          
            $this->info(Artisan::output());

            if ($exitCode === 0) {
                $this->info("🎉 Migration terminée pour {$tenant['app_name']}");
            } else {
                $this->error("❌ La migration a échoué avec le code : $exitCode");
            }
        } catch (\Exception $e) {
            $this->info(Artisan::output());
            $this->error("❌ ERREUR DURANT LA MIGRATION :");
            $this->line("Message : " . $e->getMessage());            
            $this->line("Ligne : " . $e->getLine());
            return 1;
        }

        if ($exitCode === 0) {
            $this->info("🎉 Migration terminée pour {$tenant['app_name']}");

            // Optionnel : Demander ou vérifier si on doit seeder
            $this->info("🌱 Lancement du PermissionSeeder...");

            try {
                $seedExitCode = Artisan::call('db:seed', [
                    '--class'    => 'PermissionSeeder',
                    '--database' => $tenant['database']['connection'] ?? 'mariadb',
                    '--force'    => true, // Obligatoire en production
                ]);

                if ($seedExitCode === 0) {
                    $this->info(Artisan::output());
                    $this->info("✅ Seeding réussi !");
                } else {
                    $this->error("❌ Le seeding a échoué.");
                    $this->line(Artisan::output());
                }
            } catch (\Exception $e) {
                $this->error("❌ ERREUR DURANT LE SEEDING : " . $e->getMessage());
            }
        }

        if ($seedExitCode === 0) {
            $this->info("🌱 Seeding terminé.");

            // --- Ajout du Reset de Cache ---
            $this->info("🔄 Réinitialisation du cache des permissions...");

            try {
                // Le package Spatie utilise souvent le gestionnaire de cache par défaut.
                // On s'assure que la commande s'exécute dans le contexte du tenant.
                $cacheExitCode = Artisan::call('permission:cache-reset', [
                    // Note: Cette commande ne prend pas toujours l'option --database 
                    // car le cache est souvent global (Redis/File), 
                    // mais purger le cache ici garantit la fraîcheur des données.
                ]);

                $this->info("✅ Cache des permissions vidé pour ce tenant.");
            } catch (\Exception $e) {
                // On ne bloque pas tout si le cache échoue, mais on prévient
                $this->warn("⚠️ Attention : Impossible de vider le cache des permissions : " . $e->getMessage());
            }
        }

        return 0;
    }

    /**
     * Configure la connexion à la base de données du tenant
     */
    protected function configureTenantDatabase(array $tenant): void
    {
        $dbConfig = $tenant['database'];

        // 1. Purger la connexion existante pour éviter le cache
        DB::purge('mariadb');

        // 2. Reconfigurer complètement la connexion
        config([
            'database.connections.mariadb' => [
                'driver' => 'mysql',
                'host' => $dbConfig['host'],
                'port' => $dbConfig['port'],
                'database' => $dbConfig['database'],
                'username' => $dbConfig['username'],
                'password' => $dbConfig['password'],
                'charset' => $dbConfig['charset'] ?? 'utf8mb4',
                'collation' => $dbConfig['collation'] ?? 'utf8mb4_unicode_ci',
                'prefix' => '',
                'prefix_indexes' => true,
                'strict' => true,
                'engine' => null,
               /* 'options' => extension_loaded('pdo_mysql') ? array_filter([
                    PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
                ]) : [],*/
            ]
        ]);

        // 3. Définir comme connexion par défaut
        config(['database.default' => 'mariadb']);

        // 4. Reconnecter pour forcer la prise en compte
        DB::reconnect('mariadb');

        // 5. Vérifier que la connexion fonctionne
        try {
            $currentDb = DB::connection('mariadb')->getDatabaseName();
            $this->info("✅ Connexion active sur la base : {$currentDb}");

            // Debug supplémentaire
            if ($currentDb !== $dbConfig['database']) {
                $this->warn("⚠️ ATTENTION: Base attendue '{$dbConfig['database']}' mais connecté à '{$currentDb}'");
            }
        } catch (\Exception $e) {
            $this->error("❌ Échec de connexion à la base : " . $e->getMessage());
            throw $e;
        }
    }
}
