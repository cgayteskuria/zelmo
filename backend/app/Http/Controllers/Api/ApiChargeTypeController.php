<?php

namespace App\Http\Controllers\Api;

use App\Models\ChargeTypeModel;
use App\Models\AccountModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiChargeTypeController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'charge-types';

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

        $query = ChargeTypeModel::with([
            'author:usr_id,usr_firstname,usr_lastname',
            'updater:usr_id,usr_firstname,usr_lastname',
            'account:acc_id,acc_code,acc_label',
        ]);

        $this->applyGridFilters($query, $request, [
            'cht_label' => 'cht_label',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'cht_id',
            'cht_label' => 'cht_label',
        ], 'cht_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'cht_label'),
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
     * Display the specified charge type.
     */
    public function show($id)
    {
        $chargeType = ChargeTypeModel::where('cht_id', $id)
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname',
                'account:acc_id,acc_code,acc_label'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $chargeType
        ], 200);
    }

    /**
     * Store a newly created charge type.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'cht_label' => 'required|string|max:255',
            'fk_acc_id' => 'required|exists:account_account_acc,acc_id',
        ]);

        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $chargeType = ChargeTypeModel::create($validatedData);

        return response()->json([
            'message' => 'Type de charge créé avec succès',
            'data' => $chargeType->load(['author', 'updater', 'account']),
        ], 201);
    }

    /**
     * Update the specified charge type.
     */
    public function update(Request $request, $id)
    {
        $chargeType = ChargeTypeModel::findOrFail($id);

        $validatedData = $request->validate([
            'cht_label' => 'required|string|max:255',
            'fk_acc_id' => 'required|exists:account_account_acc,acc_id',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $chargeType->update($validatedData);

        return response()->json([
            'message' => 'Type de charge mis à jour avec succès',
            'data' => $chargeType->load(['author', 'updater', 'account']),
        ]);
    }

    /**
     * Remove the specified charge type.
     */
    public function destroy($id)
    {
        $chargeType = ChargeTypeModel::findOrFail($id);

        $chargeType->delete();

        return response()->json([
            'message' => 'Type de charge supprimé avec succès'
        ]);
    }

    /**
     * Récupérer la liste des types de charges pour les options de Select
     */
    public function options(Request $request)
    {
        $query = ChargeTypeModel::select('cht_id as id', 'cht_label as label', 'fk_pam_id');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('cht_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('cht_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }
}
