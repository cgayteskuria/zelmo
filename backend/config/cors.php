<?php

/**
 * Configuration CORS
 *
 * Les origins autorisées sont déterminées dynamiquement
 * par TenantServiceProvider via config('app.frontend_url').
 * Aucun env() n'est utilisé.
 */

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter([
        '*',
        // Toujours autoriser localhost pour le développement local
        'http://localhost',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://sksuite-api.local',
        'http://sksuite-api.local:5173',        

        // L'URL du frontend du tenant sera ajoutée dynamiquement par TenantServiceProvider
        config('app.frontend_url'),
    ]),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Authorization'],

    'max_age' => 0,

    'supports_credentials' => true,

];
