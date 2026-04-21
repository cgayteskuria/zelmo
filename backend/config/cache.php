<?php

use Illuminate\Support\Str;

/**
 * Configuration du cache
 *
 * Utilise le driver 'database' qui s'appuie sur la connexion
 * configurée dynamiquement par TenantServiceProvider.
 * Aucun env() n'est utilisé.
 */

return [

    'default' => 'database',

    'stores' => [

        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'database' => [
            'driver' => 'database',
            'connection' => null,
            'table' => 'cache',
            'lock_connection' => null,
            'lock_table' => null,
        ],

        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
            'lock_path' => storage_path('framework/cache/data'),
        ],

        'failover' => [
            'driver' => 'failover',
            'stores' => [
                'database',
                'array',
            ],
        ],

    ],

    'prefix' => Str::slug('sksuite') . '-cache-',

];
