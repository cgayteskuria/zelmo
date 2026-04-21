<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        apiPrefix: '', // On force le préfixe à vide car Apache gère déjà le /api
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // $middleware->statefulApi();
        // FORCEZ L'EXCLUSION DU CSRF POUR TOUTES  ROUTES API
        $middleware->validateCsrfTokens(except: [
            '*', // Comme votre préfixe API est vide, on exclut tout. 
            // Ou listez précisément : 'login', 'logout', 'register'
        ]);


        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
            'duration.permission' => \App\Http\Middleware\CheckDurationPermission::class,
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,           
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })->create();
