<?php

namespace App\Http\Controllers\Api;

use App\Models\ApplicationModel;
use Illuminate\Http\Request;

class ApiApplicationController extends Controller
{
    /**
     * Retourne les applications accessibles à l'utilisateur connecté,
     * triées par app_order.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $apps = ApplicationModel::with(['menus' => function ($q) {
            $q->where('mnu_type', 'item')
              ->whereNotNull('mnu_href')
              ->where('mnu_href', '!=', '')
              ->orderBy('mnu_order');
        }])->orderBy('app_order')->get();

        $accessible = $apps->filter(function ($app) use ($user) {
            // NULL = accessible à tout utilisateur authentifié
            if (empty($app->app_permission)) {
                return true;
            }

            // Support des permissions multiples séparées par "|"
            $permissions = array_map('trim', explode('|', $app->app_permission));
            foreach ($permissions as $permission) {
                if ($user->can($permission)) {
                    return true;
                }
            }

            return false;
        })->map(function ($app) use ($user) {
            // Vérifier si l'utilisateur peut accéder à app_root_href
            $rootMenu = $app->menus->first(fn($m) => $m->mnu_href === $app->app_root_href);
            $canAccessRoot = !$rootMenu
                || empty($rootMenu->fk_permission_name)
                || $user->can($rootMenu->fk_permission_name);

            // Si non, rediriger vers le premier item de menu accessible
            if (!$canAccessRoot) {
                $firstAccessible = $app->menus->first(
                    fn($m) => empty($m->fk_permission_name) || $user->can($m->fk_permission_name)
                );
                if ($firstAccessible) {
                    $app->app_root_href = $firstAccessible->mnu_href;
                }
            }

            return $app;
        });

        return response()->json([
            'status' => true,
            'applications' => $accessible->values(),
        ]);
    }

}
