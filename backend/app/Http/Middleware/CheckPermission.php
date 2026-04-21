<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (!$request->user()) {
            return response()->json([
                'message' => 'Non authentifié.',
            ], 401);
        }

        // Support du OR via | ex: "customers.view|partners.view"
        $alternatives = explode('|', $permission);
        foreach ($alternatives as $alt) {
            if ($request->user()->can(trim($alt))) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Vous n\'avez pas la permission d\'effectuer cette action.',
            'required_permission' => $permission,
        ], 403);
    }
}