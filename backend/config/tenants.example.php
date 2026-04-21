<?php

/**
 * Configuration Multi-Tenant — EXEMPLE
 *
 * Copiez ce fichier vers config/tenants.php et adaptez les valeurs.
 * Chaque clé est le nom de domaine du backend (HTTP_HOST).
 * Le système sélectionne automatiquement la configuration selon l'URL d'accès.
 *
 * ⚠️  NE JAMAIS committer config/tenants.php en production (contient des secrets).
 */

return [

    // =========================================================================
    // EXEMPLE — ENVIRONNEMENT LOCAL
    // =========================================================================
    'zelmo.local' => [
        // Application
        'app_key'      => 'base64:GENERATE_WITH_php_artisan_key_generate',
        'app_url'      => 'http://zelmo.local',
        'app_name'     => 'ZELMO',
        'app_env'      => 'local',
        'app_debug'    => true,
        'frontend_url' => 'http://zelmo.local:5173',

        // Base de données
        'database' => [
            'connection' => 'mariadb',   // ou 'mysql'
            'host'       => '127.0.0.1',
            'port'       => '3306',
            'database'   => 'zelmo',
            'username'   => 'root',
            'password'   => '',
            'charset'    => 'utf8mb4',
            'collation'  => 'utf8mb4_unicode_ci',
        ],

        // Storage (chemin relatif depuis storage/app/private/)
        'storage_path' => 'tenants/zelmo',

        // Sessions
        'session' => [
            'driver'   => 'database',
            'lifetime' => 120,
            'cookie'   => 'zelmo_session',
        ],

        // Sanctum (CORS)
        'sanctum' => [
            'stateful_domains' => [
                'localhost',
                'zelmo.local:5173',
                'zelmo.local',
            ],
        ],

        // Email (optionnel)
        'mail' => [
            'mailer'     => 'smtp',
            'host'       => 'smtp.mailtrap.io',
            'port'       => 587,
            'username'   => '',
            'password'   => '',
            'encryption' => 'tls',
            'from_address' => 'noreply@zelmo.local',
            'from_name'    => 'ZELMO',
        ],

        // OCR Factures — Veryfi (optionnel)
        'veryfi' => [
            'client_id'     => '',
            'client_secret' => '',
            'username'      => '',
            'api_key'       => '',
        ],
    ],

    // =========================================================================
    // EXEMPLE — ENVIRONNEMENT PRODUCTION
    // =========================================================================
    // 'zelmo.mondomaine.com' => [
    //     'app_key'      => 'base64:CLE_UNIQUE_GENEREE',
    //     'app_url'      => 'https://zelmo.mondomaine.com',
    //     'app_name'     => 'ZELMO',
    //     'app_env'      => 'production',
    //     'app_debug'    => false,
    //     'frontend_url' => 'https://app.mondomaine.com',
    //     'database' => [
    //         'connection' => 'mariadb',
    //         'host'       => '127.0.0.1',
    //         'port'       => '3306',
    //         'database'   => 'zelmo_prod',
    //         'username'   => 'zelmo_user',
    //         'password'   => 'MOT_DE_PASSE_SECURISE',
    //     ],
    //     'storage_path' => 'tenants/zelmo',
    //     'session' => [
    //         'driver'   => 'database',
    //         'lifetime' => 120,
    //         'cookie'   => 'zelmo_session',
    //     ],
    //     'sanctum' => [
    //         'stateful_domains' => ['app.mondomaine.com'],
    //     ],
    // ],

];
