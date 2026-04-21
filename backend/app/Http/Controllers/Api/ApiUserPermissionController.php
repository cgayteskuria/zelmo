<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use App\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Exception;

class ApiUserPermissionController extends Controller
{
    /**
     * Obtenir toutes les permissions et rôles d'un utilisateur
     */
    public function show($userId): JsonResponse
    {
        $user = UserModel::findOrFail($userId);

        return response()->json([
            'data' => [
                'roles' => $user->getRoleNames()->toArray(),
                'direct_permissions' => $user->getDirectPermissions()->pluck('name')->toArray(),
                'role_permissions' => $user->getPermissionsViaRoles()->pluck('name')->toArray(),
                'all_permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
            ]
        ]);
    }

    /**
     * Assigner des rôles à un utilisateur
     */
    public function syncRoles(Request $request, $userId): JsonResponse
    {
        try {
            $user = UserModel::findOrFail($userId);

            $validatedData = $request->validate([
                'roles' => 'present|array',
                'roles.*' => 'integer|exists:roles,id',
            ]);

            $user->syncRoles($validatedData['roles']);

            return response()->json([
                'message' => 'Rôles mis à jour avec succès',
                'data' => [
                    'roles' => $user->getRoleNames()->toArray(),
                    //'all_permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
                ]
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),              
            ], 422);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),                
            ], 500);
        }
    }

    /**
     * Synchroniser les permissions directes d'un utilisateur
     */
    public function syncPermissions(Request $request, $userId): JsonResponse
    {
        $user = UserModel::findOrFail($userId);

        $validatedData = $request->validate([
            'permissions' => 'nullable|array', // autorise null ou tableau vide
            'permissions.*' => 'string|exists:permissions,name', // chaque permission doit exister
        ]);

        // Synchroniser les permissions directes (écrase les anciennes)
        $user->syncPermissions($validatedData['permissions']);

        return response()->json([
            'message' => 'Permissions directes mises à jour avec succès',
            'data' => [
                'direct_permissions' => $user->getDirectPermissions()->pluck('name')->toArray(),
                'all_permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
            ]
        ]);
    }

    /**
     * Ajouter une permission directe
     */
    public function givePermission(Request $request, $userId): JsonResponse
    {
        $user = UserModel::findOrFail($userId);

        $validatedData = $request->validate([
            'permission' => 'required|string|exists:permissions,name',
        ]);

        $user->givePermissionTo($validatedData['permission']);

        return response()->json([
            'message' => 'Permission ajoutée avec succès',
            'data' => [
                'direct_permissions' => $user->getDirectPermissions()->pluck('name')->toArray(),
            ]
        ]);
    }

    /**
     * Retirer une permission directe
     */
    public function revokePermission(Request $request, $userId): JsonResponse
    {
        $user = UserModel::findOrFail($userId);

        $validatedData = $request->validate([
            'permission' => 'required|string|exists:permissions,name',
        ]);

        $user->revokePermissionTo($validatedData['permission']);

        return response()->json([
            'message' => 'Permission retirée avec succès',
            'data' => [
                'direct_permissions' => $user->getDirectPermissions()->pluck('name')->toArray(),
            ]
        ]);
    }
}
