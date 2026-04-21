<?php

return [
    // TenantServiceProvider DOIT être en premier pour configurer la DB avant tout
    App\Providers\TenantServiceProvider::class,
    App\Providers\AppServiceProvider::class,
];
