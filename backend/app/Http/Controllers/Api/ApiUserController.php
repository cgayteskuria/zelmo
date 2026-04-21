<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use App\Models\UserModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class ApiUserController extends Controller
{
    use HasGridFilters;

    public function index(Request $request): JsonResponse
    {
        $gridKey = 'users';

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

        $query = UserModel::query()
            ->with('roles:id,name')
            ->select([
                'usr_id',
                'usr_login',
                'usr_firstname',
                'usr_lastname',
                'usr_is_active',
                'usr_is_seller',
                'usr_is_technician',
                'usr_is_employee',
            ]);

        $this->applyGridFilters($query, $request, [
            'usr_login'     => 'usr_login',
            'usr_firstname' => 'usr_firstname',
            'usr_lastname'  => 'usr_lastname',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'            => 'usr_id',
            'usr_login'     => 'usr_login',
            'usr_firstname' => 'usr_firstname',
            'usr_lastname'  => 'usr_lastname',
        ], 'usr_id', 'DESC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'usr_id'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
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
     * Display the specified resource.
     * Retourne toutes les données d'un item spécifique
     */
    public function show($id)
    {
        $data = UserModel::where('usr_id', $id)
            ->with([
                'manager:usr_id,usr_firstname,usr_lastname',
                'account:acc_id,acc_code,acc_label',
                'roles:id,name',
            ])
            ->withCount('vehicles')
            ->firstOrFail();

        // Sélectionner seulement les champs nécessaires pour la réponse
        $response = $data->only([
            'usr_id',
            'created_at',
            'updated_at',
            'fk_usr_id_author',
            'fk_usr_id_updater',
            'usr_login',
            'usr_firstname',
            'usr_lastname',
            'usr_tel',
            'usr_mobile',
            'usr_jobtitle',
            'usr_is_active',
            'usr_is_seller',
            'usr_is_technician',
            'usr_permanent_lock',
            'usr_locked_until',
            'usr_is_employee',
            'fk_acc_id_employe',
            'fk_usr_id_manager',
            'vehicles_count', // Important !
            'manager',
            'account'
        ]);

        return response()->json([
            'status' => true,
            'data' => $data
        ], 200);
    }


    public function options(Request $request)
    {

        $query = UserModel::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('usr_firstname', 'LIKE', "%{$search}%")
                  ->orWhere('usr_lastname', 'LIKE', "%{$search}%");
            });
        }

        if ($request->has('excluded_ids')) {
            $excludedIds = is_array($request->excluded_ids)
                ? $request->excluded_ids
                : explode(',', $request->excluded_ids);

            $query->whereNotIn('usr_id', $excludedIds);
        }

        if ($request->has('usr_is_employee')) {
            $query->where('usr_is_employee', true);
        }
        if ($request->boolean('excluded_current_id')) {
            $query->whereNotIn('usr_id', [Auth::id()]);
        }
        // Filtres
        if ($request->boolean('seller')) {
            $query->where('usr_is_seller', true);
        }

        // Filtres
        if ($request->boolean('is_seller')) {
            $query->where('usr_is_seller', true);
        }

        if ($request->boolean('active')) {
            $query->where('usr_is_active', true);
        }



        $data = $query->select(
            'usr_id as id',
            DB::raw("TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label")
        )
            ->orderBy('usr_lastname', 'asc')
            ->get();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Récupérer les utilisateurs commerciaux
     */
    public function getSellers(Request $request)
    {
        $request->merge(['seller' => true]);

        return $this->options($request);
    }

    /**
     * Récupérer les utilisateurs actifs (pour sélection de salarié)
     */
    public function getEmployees(Request $request)
    {
        $request->merge(['usr_is_employee' => true]);

        return $this->options($request);
    }
    /**
     * Store a newly created user.
     */
    public function store(Request $request): JsonResponse
    {

        $validatedData = $request->validate([
            'usr_login' => 'required|string|max:100|unique:user_usr,usr_login',
            'usr_password' => 'required|string|min:6|confirmed',
            'usr_firstname' => 'required|string|max:100',
            'usr_lastname' => 'required|string|max:100',
            'usr_tel' => 'nullable|string|max:50',
            'usr_mobile' => 'nullable|string|max:50',
            'usr_jobtitle' => 'nullable|string|max:100',
            'usr_is_active' => 'boolean',
            'usr_is_seller' => 'boolean',
            'usr_is_technician' => 'boolean',
            'usr_is_employee' => 'nullable|boolean',
            'fk_acc_id_employe' => 'required_if:usr_is_employee,true|nullable|exists:account_account_acc,acc_id',
            'fk_usr_id_manager' => 'nullable|exists:user_usr,usr_id',
        ]);

        try {
            $user = UserModel::create([
                'usr_login' => $validatedData['usr_login'],
                'usr_password' => Hash::make($validatedData['usr_password']),
                'usr_firstname' => $validatedData['usr_firstname'],
                'usr_lastname' => $validatedData['usr_lastname'],
                'usr_tel' => $validatedData['usr_tel'] ?? null,
                'usr_mobile' => $validatedData['usr_mobile'] ?? null,
                'usr_jobtitle' => $validatedData['usr_jobtitle'] ?? null,
                'usr_is_active' => $validatedData['usr_is_active'] ?? true,
                'usr_is_seller' => $validatedData['usr_is_seller'] ?? false,
                'usr_is_technician' => $validatedData['usr_is_technician'] ?? false,
                'usr_is_employee' => $validatedData['usr_is_employee'] ?? false,
                'fk_acc_id_employe' => $validatedData['fk_acc_id_employe'] ?? null,
                'fk_usr_id_manager' => $validatedData['fk_usr_id_manager'] ?? null,
                'usr_failed_login_attempts' => 0,
            ]);

            return response()->json([
                'message' => 'Utilisateur créé avec succès',
                'data' => $user,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->errors(),
                'status' => 422,
            ], 422);
        }
    }


    /**
     * Update the specified user.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = UserModel::findOrFail($id);

        $validatedData = $request->validate([
            'usr_login' => [
                'required',
                'string',
                'max:320',
                Rule::unique('user_usr', 'usr_login')->ignore($user->usr_id, 'usr_id'),
            ],
            'usr_password' => 'sometimes|string|min:6|confirmed',
            'usr_firstname' => 'required|string|max:100',
            'usr_lastname' => 'required|string|max:100',
            'usr_tel' => 'nullable|string|max:50',
            'usr_mobile' => 'nullable|string|max:50',
            'usr_jobtitle' => 'nullable|string|max:100',
            'usr_is_active' => 'nullable|boolean',
            'usr_is_seller' => 'nullable|boolean',
            'usr_is_technician' => 'nullable|boolean',
            'usr_is_employee' => 'nullable|boolean',
            'fk_acc_id_employe' => 'required_if:usr_is_employee,true|nullable|exists:account_account_acc,acc_id',
            'fk_usr_id_manager' => 'nullable|exists:user_usr,usr_id',
        ]);

        // Empecher la desactivation du statut salarie si l'utilisateur a des vehicules
        $isRemovingEmployee = $user->usr_is_employee
            && (isset($validatedData['usr_is_employee']) && !$validatedData['usr_is_employee']);

        if ($isRemovingEmployee && $user->vehicles()->count() > 0) {
            return response()->json([
                'message' => 'Impossible de retirer le statut salarié : cet utilisateur possède des véhicules. Veuillez d\'abord supprimer ses véhicules.',
                'status' => 422,
            ], 422);
        }

        try {
            $user->usr_login = $validatedData['usr_login'];

            $user->usr_firstname = $validatedData['usr_firstname'];
            $user->usr_lastname = $validatedData['usr_lastname'];
            $user->usr_tel = $validatedData['usr_tel'] ?? null;
            $user->usr_mobile = $validatedData['usr_mobile'] ?? null;
            $user->usr_jobtitle = $validatedData['usr_jobtitle'] ?? null;
            $user->usr_is_active = $validatedData['usr_is_active'] ?? $user->usr_is_active;
            $user->usr_is_seller = $validatedData['usr_is_seller'] ?? $user->usr_is_seller;
            $user->usr_is_technician = $validatedData['usr_is_technician'] ?? $user->usr_is_technician;
            $user->usr_is_employee = $validatedData['usr_is_employee'] ?? $user->usr_is_employee;
            $user->fk_acc_id_employe = $validatedData['fk_acc_id_employe'] ?? null;
            $user->fk_usr_id_manager = $validatedData['fk_usr_id_manager'] ?? null;
            // Mettre à jour le mot de passe si fourni
            if (!empty($validatedData['usr_password'])) {
                $user->usr_password = Hash::make($validatedData['usr_password']);
            }

            $user->save();

            return response()->json([
                'message' => 'Utilisateur mis à jour avec succès',
                'data' => $user,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->errors(),
                'status' => 422,
            ], 422);
        }
    }

    /**
     * Remove the specified user.
     */
    public function destroy($id): JsonResponse
    {
        $user = UserModel::findOrFail($id);

        // Empêcher la suppression de son propre compte
        if ($user->usr_id === Auth::id()) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte',
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'Utilisateur supprimé avec succès',
        ]);
    }
}
