<?php

namespace App\Http\Controllers\Api;

use App\Models\WarehouseModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ApiWarehouseController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'warehouses';

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

        $query = WarehouseModel::with(['parent:whs_id,whs_label', 'author:usr_id,usr_firstname,usr_lastname']);

        $this->applyGridFilters($query, $request, [
            'whs_label' => 'whs_label',
            'whs_code'  => 'whs_code',
            'whs_city'  => 'whs_city',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'whs_id',
            'whs_label' => 'whs_label',
            'whs_code'  => 'whs_code',
        ], 'whs_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'whs_label'),
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
     * Retourne la liste des positions fiscales pour les selects
     */
    public function options(Request $request)
    {
        $query = WarehouseModel::select('whs_id as id', 'whs_label as label', 'whs_is_default as default');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('whs_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('whs_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }


    /**
     * Récupérer un entrepôt spécifique
     */
    public function show($id)
    {
        $warehouse = WarehouseModel::with(['parent:whs_id,whs_label', 'children'])
            ->findOrFail($id);

        return response()->json([
            'data' => $warehouse
        ], 200);
    }

    /**
     * Créer un entrepôt
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'whs_code' => 'required|string|max:20|unique:warehouse_whs,whs_code',
            'whs_label' => 'required|string|max:100',
            'whs_type' => 'nullable|integer|in:1,2,3,4',
            'fk_parent_whs_id' => 'nullable|integer|exists:warehouse_whs,whs_id',
            'whs_address' => 'nullable|string|max:255',
            'whs_city' => 'nullable|string|max:100',
            'whs_zipcode' => 'nullable|string|max:20',
            'whs_country' => 'nullable|string|max:50',
            'whs_is_active' => 'boolean',
            'whs_is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();

        try {
            // Si on définit cet entrepôt comme défaut, retirer le défaut des autres
            if ($request->input('whs_is_default', false)) {
                WarehouseModel::query()->update(['whs_is_default' => 0]);
            }

            $warehouse = WarehouseModel::create([
                'whs_code' => $request->whs_code,
                'whs_label' => $request->whs_label,
                'whs_type' => $request->input('whs_type', 1),
                'fk_parent_whs_id' => $request->fk_parent_whs_id,
                'whs_address' => $request->whs_address,
                'whs_city' => $request->whs_city,
                'whs_zipcode' => $request->whs_zipcode,
                'whs_country' => $request->input('whs_country', 'France'),
                'whs_is_active' => $request->input('whs_is_active', true),
                'whs_is_default' => $request->input('whs_is_default', false),
                'fk_usr_id_author' => $userId,
            ]);

            return response()->json([
                'data' => $warehouse
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour un entrepôt
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'whs_code' => 'required|string|max:20|unique:warehouse_whs,whs_code,' . $id . ',whs_id',
            'whs_label' => 'required|string|max:100',
            'whs_type' => 'nullable|integer|in:1,2,3,4',
            'fk_parent_whs_id' => 'nullable|integer|exists:warehouse_whs,whs_id',
            'whs_address' => 'nullable|string|max:255',
            'whs_city' => 'nullable|string|max:100',
            'whs_zipcode' => 'nullable|string|max:20',
            'whs_country' => 'nullable|string|max:50',
            'whs_is_active' => 'boolean',
            'whs_is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        // Vérifier qu'un entrepôt ne peut pas être son propre parent
        if ($request->fk_parent_whs_id == $id) {
            return response()->json([
                'success' => false,
                'message' => 'Un entrepôt ne peut pas être son propre parent'
            ], 422);
        }

        $userId = Auth::id();

        try {
            $warehouse = WarehouseModel::findOrFail($id);

            // Si on définit cet entrepôt comme défaut, retirer le défaut des autres
            if ($request->input('whs_is_default', false)) {
                WarehouseModel::where('whs_id', '!=', $id)
                    ->update(['whs_is_default' => 0]);
            }

            $warehouse->update([
                'whs_code' => $request->whs_code,
                'whs_name' => $request->whs_name,
                'whs_type' => $request->input('whs_type', 1),
                'fk_parent_whs_id' => $request->fk_parent_whs_id,
                'whs_address' => $request->whs_address,
                'whs_city' => $request->whs_city,
                'whs_zipcode' => $request->whs_zipcode,
                'whs_country' => $request->input('whs_country', 'France'),
                'whs_is_active' => $request->input('whs_is_active', true),
                'whs_is_default' => $request->input('whs_is_default', false),
                'fk_usr_id_updater' => $userId,
            ]);

            return response()->json([
                'data' => $warehouse
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un entrepôt
     */
    public function destroy($id)
    {
        try {
            $warehouse = WarehouseModel::findOrFail($id);

            // Vérifier s'il y a des entrepôts enfants
            $childrenCount = WarehouseModel::where('fk_parent_whs_id', $id)->count();
            if ($childrenCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de supprimer cet entrepôt car il a des entrepôts enfants'
                ], 422);
            }

            // Vérifier si c'est l'entrepôt par défaut
            if ($warehouse->whs_is_default) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de supprimer l\'entrepôt par défaut'
                ], 422);
            }

            $warehouse->delete();

            return response()->json([
                'success' => true,
                'message' => 'Entrepôt supprimé avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage()
            ], 500);
        }
    }

    
}