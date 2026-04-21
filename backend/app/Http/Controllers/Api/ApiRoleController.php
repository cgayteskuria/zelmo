<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class ApiRoleController extends Controller
{
    use HasGridFilters;

    public function index(Request $request): JsonResponse
    {
        $gridKey = 'roles';

        // --- Gestion des grid settings ---
        if (!$request->has('sort_by')) {
            $saved = $this->loadGridSettings($gridKey);
            if ($saved) {
                $merge = [];
                if (!empty($saved['sort_by']))    $merge['sort_by']    = $saved['sort_by'];
                if (!empty($saved['sort_order'])) $merge['sort_order'] = $saved['sort_order'];
                if (!empty($saved['filters']))    $merge['filters']    = $saved['filters'];
                if (!empty($saved['page_size']))  $merge['limit']      = $saved['page_size'];
                $request->merge($merge);
            }
        }

        $query = Role::where('guard_name', 'sanctum')->withCount('permissions');

        $this->applyGridFilters($query, $request, [
            'name' => 'name',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'   => 'id',
            'name' => 'name',
        ], 'name', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'name'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Afficher un rôle avec ses permissions
     */
    public function show($id): JsonResponse
    {
        $role = Role::where('guard_name', 'sanctum')->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions()->pluck('name')->toArray(),
                'created_at' => $role->created_at,
                'updated_at' => $role->updated_at,
            ]
        ]);
    }

    /**
     * Créer un nouveau rôle
     */
    public function store(Request $request): JsonResponse
    {
      
        $validatedData = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'permissions' => 'nullable|array', // autorise null ou tableau vide
            'permissions.*' => 'string|exists:permissions,name', // chaque permission doit exister
        ]);

        $role = Role::create([
            'name' => $validatedData['name'],
            'guard_name' => 'sanctum'
        ]);

        // Assigner les permissions
        if (isset($validatedData['permissions'])) {
            $role->syncPermissions($validatedData['permissions']);
        }

        return response()->json([
            'message' => 'Rôle créé avec succès',
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
        ], 201);
    }

    /**
     * Mettre à jour un rôle
     */
    public function update(Request $request, $id): JsonResponse
    {
        $role = Role::where('guard_name', 'sanctum')->findOrFail($id);

        $validatedData = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $id,
            'permissions' => 'nullable|array', // autorise null ou tableau vide
            'permissions.*' => 'string|exists:permissions,name', // chaque permission doit exister
        ]);

        $role->name = $validatedData['name'];
        $role->save();

        // Synchroniser les permissions
        if (isset($validatedData['permissions'])) {
            $role->syncPermissions($validatedData['permissions']);
        }

        return response()->json([
            'message' => 'Rôle mis à jour avec succès',
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
        ]);
    }

    /**
     * Supprimer un rôle
     */
    public function destroy($id): JsonResponse
    {
        $role = Role::where('guard_name', 'sanctum')->findOrFail($id);

        // Vérifier si le rôle est assigné à des utilisateurs
        $usersCount = $role->users()->count();
        if ($usersCount > 0) {
            return response()->json([
                'message' => "Impossible de supprimer ce rôle car il est assigné à {$usersCount} utilisateur(s)",
            ], 400);
        }

        $role->delete();

        return response()->json([
            'message' => 'Rôle supprimé avec succès',
        ]);
    }

    /**
     * Récupérer toutes les permissions disponibles
     */
    public function getAllPermissions(): JsonResponse
    {
        $permissions = Permission::where('guard_name', 'sanctum')
            ->orderBy('name')
            ->get()
            ->groupBy(function ($permission) {
                // Grouper par module (ex: "partners.view" => "partners")
                $parts = explode('.', $permission->name);
                return $parts[0] ?? 'other';
            })
            ->map(function ($group) {
                return $group->map(function ($permission) {
                    return [
                        'name' => $permission->name,
                        'id' => $permission->id,
                    ];
                })->values();
            });

        return response()->json([
            'data' => $permissions
        ]);
    }

    /**
     * Options pour les selects (id + label)
     */
    public function options(): JsonResponse
    {
        $roles = Role::where('guard_name', 'sanctum')
            ->orderBy('name')
            ->get(['id', 'name as label']);

        return response()->json([
            'data' => $roles
        ]);
    }
}
