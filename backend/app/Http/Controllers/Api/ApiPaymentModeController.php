<?php

namespace App\Http\Controllers\Api;

use App\Models\PaymentModeModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiPaymentModeController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'payment-modes';

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

        $query = PaymentModeModel::query()
            ->select([
                'pam_id as id',
                'pam_label',
            ]);

        $filterColumnMap = [
            'pam_label' => 'pam_label',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        $sortColumnMap = [
            'id' => 'pam_id',
            'pam_label' => 'pam_label',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'pam_label', 'ASC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'pam_label'),
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
     * Display the specified payment mode.
     */
    public function show($id)
    {
        $paymentMode = PaymentModeModel::where('pam_id', $id)
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $paymentMode
        ], 200);
    }

    /**
     * Store a newly created payment mode.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'pam_label' => 'required|string|max:255',
        ]);

        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $paymentMode = PaymentModeModel::create($validatedData);

        return response()->json([
            'message' => 'Mode de paiement créé avec succès',
            'data' => $paymentMode->load(['author', 'updater']),
        ], 201);
    }

    /**
     * Update the specified payment mode.
     */
    public function update(Request $request, $id)
    {
        $paymentMode = PaymentModeModel::findOrFail($id);

        $validatedData = $request->validate([
            'pam_label' => 'required|string|max:255',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $paymentMode->update($validatedData);

        return response()->json([
            'message' => 'Mode de paiement mis à jour avec succès',
            'data' => $paymentMode->load(['author', 'updater']),
        ]);
    }

    /**
     * Remove the specified payment mode.
     */
    public function destroy($id)
    {
        $paymentMode = PaymentModeModel::findOrFail($id);

        $paymentMode->delete();

        return response()->json([
            'message' => 'Mode de paiement supprimé avec succès'
        ]);
    }

    public function options(Request $request)
    {
        $query = PaymentModeModel::select('pam_id as id', 'pam_label as label');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('pam_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('pam_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }
}
