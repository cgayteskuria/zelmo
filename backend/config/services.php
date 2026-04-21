<?php

/**
 * Configuration des services tiers
 *
 * Seul Veryfi est utilisé. Les credentials sont hardcodés ici
 * ou peuvent être ajoutés dans config/tenants.php si par-tenant.
 * Aucun env() n'est utilisé.
 */

return [

    'veryfi' => [
        'client_id' => '',
        'client_secret' => '',
        'username' => '',
        'api_key' => '',
    ],

];
