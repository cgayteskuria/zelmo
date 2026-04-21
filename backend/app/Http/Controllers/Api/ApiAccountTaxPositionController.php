<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountTaxPositionModel;
use App\Models\AccountTaxPositionCorrespondenceModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiAccountTaxPositionController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'tax-positions';

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

        $query = AccountTaxPositionModel::query()            
            ->select([
                'tap_id as id',
                'account_tax_position_tap.*',               
            ]);

        $this->applyGridFilters($query, $request, [
            'tap_label' => 'account_tax_position_tap.tap_label',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'account_tax_position_tap.tap_id',
            'tap_label' => 'account_tax_position_tap.tap_label',
        ], 'tap_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tap_label'),
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
        $query = AccountTaxPositionModel::select('tap_id as id', 'tap_label as label');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('tap_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('tap_label', 'asc')
            ->orderBy('tap_label', 'asc')
            ->get();

        return response()->json([
            'data' => $data
        ]);
    }



    public function getCorrespondences(Request $request, $id)
    {
        $data = AccountTaxPositionCorrespondenceModel::query()
            ->where('fk_tap_id', $id)
            ->leftJoin('account_tax_tax as taxSource', 'account_tax_position_correspondence_tac.fk_tax_id_source', '=', 'taxSource.tax_id')
            ->leftJoin('account_tax_tax as taxTarget', 'account_tax_position_correspondence_tac.fk_tax_id_target', '=', 'taxTarget.tax_id')
            ->select([
                'tac_id',
                'fk_tax_id_source',
                'fk_tax_id_target',
                'taxSource.tax_label as tax_source_label',
                'taxTarget.tax_label as tax_target_label'
            ])
            ->orderBy('tac_id', 'asc')
            ->get();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Store a new correspondence
     */
    public function storeCorrespondence(Request $request, $id)
    {
        $validatedData = $request->validate([
            'fk_tax_id_source' => 'required|integer|exists:account_tax_tax,tax_id',
            'fk_tax_id_target' => 'required|integer|exists:account_tax_tax,tax_id'
        ]);

        // Vérifier si la correspondance existe déjà
        $exists = AccountTaxPositionCorrespondenceModel::where('fk_tap_id', $id)
            ->where('fk_tax_id_source', $validatedData['fk_tax_id_source'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => false,
                'message' => 'Cette correspondance existe déjà'
            ], 400);
        }

        $correspondence = AccountTaxPositionCorrespondenceModel::create([
            'fk_tap_id' => $id,
            'fk_tax_id_source' => $validatedData['fk_tax_id_source'],
            'fk_tax_id_target' => $validatedData['fk_tax_id_target']
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Correspondance créée avec succès',
            'data' => $correspondence
        ]);
    }

    /**
     * Update a correspondence
     */
    public function updateCorrespondence(Request $request, $id, $tacId)
    {
        $validatedData = $request->validate([
            'fk_tax_id_source' => 'required|integer|exists:account_tax_tax,tax_id',
            'fk_tax_id_target' => 'required|integer|exists:account_tax_tax,tax_id'
        ]);

        $correspondence = AccountTaxPositionCorrespondenceModel::where('tac_id', $tacId)
            ->where('fk_tap_id', $id)
            ->first();

        if (!$correspondence) {
            return response()->json([
                'status' => false,
                'message' => 'Correspondance introuvable'
            ], 404);
        }

        // Vérifier si une autre correspondance existe déjà avec ces valeurs
        $exists = AccountTaxPositionCorrespondenceModel::where('fk_tap_id', $id)
            ->where('fk_tax_id_source', $validatedData['fk_tax_id_source'])
            ->where('tac_id', '!=', $tacId)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => false,
                'message' => 'Une correspondance avec cette taxe source existe déjà'
            ], 400);
        }

        $correspondence->update($validatedData);

        return response()->json([
            'status' => true,
            'message' => 'Correspondance mise à jour avec succès',
            'data' => $correspondence
        ]);
    }

    /**
     * Delete a correspondence
     */
    public function destroyCorrespondence($id, $tacId)
    {
        $correspondence = AccountTaxPositionCorrespondenceModel::where('tac_id', $tacId)
            ->where('fk_tap_id', $id)
            ->first();

        if (!$correspondence) {
            return response()->json([
                'status' => false,
                'message' => 'Correspondance introuvable'
            ], 404);
        }

        $correspondence->delete();

        return response()->json([
            'status' => true,
            'message' => 'Correspondance supprimée avec succès'
        ]);
    }
}
