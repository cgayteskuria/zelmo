<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckDurationPermission
{
    /**
     * Mapping des types de durées vers les permissions
     */
    private const TYPE_PERMISSIONS = [
        'commitment-durations' => 'settings.contractconf',
        'notice-durations' => 'settings.contractconf',
        'renew-durations' => 'settings.contractconf',
        'invoicing-durations' => 'settings.contractconf',
        'payment-conditions' => 'settings.invoiceconf',       
    ];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $action = 'view'): Response
    {
        $type = $request->route('type');

        if (!isset(self::TYPE_PERMISSIONS[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $basePermission = self::TYPE_PERMISSIONS[$type];
        $permission = $basePermission . '.' . $action;

        // Vérifier la permission
        if (!$request->user() || !$request->user()->can($permission)) {
            return response()->json([
                'message' => 'Vous n\'avez pas la permission d\'effectuer cette action',
                'required_permission' => $permission
            ], 403);
        }

        return $next($request);
    }
}
