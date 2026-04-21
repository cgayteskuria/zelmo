<?php

namespace App\Http\Controllers\Api;

use App\Models\MenuModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiMenuController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Utilisateur non authentifié'
            ], 401);
        }

        $userPermissions = $user->getAllPermissions()->pluck('name')->toArray();
        // Récupérer les permissions de l'utilisateur
        /*  $userPermissions = DB::table('user_permissions')
            ->where('fk_usr_id', $user->id)
            ->pluck('permission_name')
            ->toArray();*/

        // Récupérer tous les menus
        $allMenus = MenuModel::orderBy('mnu_parent', 'asc')
            ->orderBy('mnu_order', 'asc')
            ->get();

        $menusById = $allMenus->keyBy('mnu_id');
        $authorizedMenuIds = collect();

        // ÉTAPE 1 : Identifier les menus directement autorisés
        foreach ($allMenus as $menu) {
            // Exception pour Home (toujours autorisé)
            if ($this->isHomeMenu($menu)) {
                $authorizedMenuIds->push($menu->mnu_id);
                continue;
            }

            // Si le menu a une permission, vérifier que l'utilisateur l'a
            if (!empty($menu->fk_permission_name)) {
                if (in_array($menu->fk_permission_name, $userPermissions)) {
                    $authorizedMenuIds->push($menu->mnu_id);
                }
            }
            // Si pas de permission : on ne l'ajoute PAS encore (sera ajouté si enfant autorisé)
        }

        // ÉTAPE 2 : Ajouter les parents des menus autorisés (récursivement)
        $menuIdsWithParents = $authorizedMenuIds->toArray();

        foreach ($authorizedMenuIds as $menuId) {
            $this->addAllParents($menuId, $menusById, $menuIdsWithParents);
        }

        // Filtrer les menus autorisés
        $authorizedMenus = $allMenus->whereIn('mnu_id', array_unique($menuIdsWithParents))
            ->values();

        return response()->json([
            'status' => true,
            'menus' => $authorizedMenus
        ], 200);
    }

    /**
     * Vérifie si c'est le menu Home
     */
    private function isHomeMenu($menu)
    {
        // Adaptez selon votre identification du menu Home     
        return strtolower($menu->mnu_name) === 'home' ||
            strtolower($menu->mnu_lib) === 'home' ||
            strtolower($menu->mnu_lib) === 'accueil';
    }

    /**
     * Ajoute récursivement tous les parents d'un menu
     */
    private function addAllParents($menuId, $menusById, &$authorizedMenuIds)
    {
        if (!isset($menusById[$menuId])) {
            return;
        }

        $menu = $menusById[$menuId];

        // Si le menu a un parent
        if ($menu->mnu_parent !== null && isset($menusById[$menu->mnu_parent])) {
            $parentId = $menu->mnu_parent;

            // Ajouter le parent s'il n'est pas déjà dans la liste
            if (!in_array($parentId, $authorizedMenuIds)) {
                $authorizedMenuIds[] = $parentId;
            }

            // Continuer récursivement avec le parent du parent
            $this->addAllParents($parentId, $menusById, $authorizedMenuIds);
        }
    }
}
