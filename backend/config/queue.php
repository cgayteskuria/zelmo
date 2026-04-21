<?php

/**
 * Configuration des queues
 *
 * Utilise le driver 'database' qui s'appuie sur la connexion
 * configurée dynamiquement par TenantServiceProvider.
 * Aucun env() n'est utilisé.
 */

return [

    'default' => 'database',

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'connection' => null,
            'table' => 'jobs',
            'queue' => 'default',
            'retry_after' => 90,
            'after_commit' => false,
        ],

        'deferred' => [
            'driver' => 'deferred',
        ],

        'background' => [
            'driver' => 'background',
        ],

        'failover' => [
            'driver' => 'failover',
            'connections' => [
                'database',
                'deferred',
            ],
        ],

    ],

    'batching' => [
        'database' => 'mariadb',
        'table' => 'job_batches',
    ],

    'failed' => [
        'driver' => 'database-uuids',
        'database' => 'mariadb',
        'table' => 'failed_jobs',
    ],

];
