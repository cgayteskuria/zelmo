<?php

use Monolog\Handler\NullHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Processor\PsrLogMessageProcessor;

/**
 * Configuration du logging
 *
 * Aucun env() n'est utilisé.
 */

return [

    'default' => 'stack',

    'deprecations' => [
        'channel' => 'null',
        'trace' => false,
    ],

    'channels' => [

        'private' => [
            'driver' => 'daily',
            'path' => storage_path('app/private/logs/private.log'),
            'level' => 'debug',
            'days' => 30,
        ],

        'stack' => [
            'driver' => 'stack',
            'channels' => ['single'],
            'ignore_exceptions' => false,
        ],

        'single' => [
            'driver' => 'single',
            'path' => storage_path('app/private/logs/laravel.log'),
            'level' => 'debug',
            'replace_placeholders' => true,
        ],

        'daily' => [
            'driver' => 'daily',
            'path' => storage_path('app/private/logs/laravel.log'),
            'level' => 'debug',
            'days' => 14,
            'replace_placeholders' => true,
        ],

        'errorlog' => [
            'driver' => 'errorlog',
            'level' => 'debug',
            'replace_placeholders' => true,
        ],

        'null' => [
            'driver' => 'monolog',
            'handler' => NullHandler::class,
        ],

        'emergency' => [
            'path' => storage_path('app/private/logs/laravel.log'),
        ],

    ],

];
