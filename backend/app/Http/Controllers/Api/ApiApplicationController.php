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

        $apps = ApplicationModel::orderBy('app_order')->get();

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
        });

        return response()->json([
            'status' => true,
            'applications' => $accessible->values(),
        ]);
    }

}
