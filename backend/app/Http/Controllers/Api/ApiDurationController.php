<?php

namespace App\Http\Controllers\Api;

use App\Models\DurationsModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

use Illuminate\Support\Facades\DB;

class ApiDurationController
{
    use HasGridFilters;

    /**
     * Mapping des types de durées
     */
    private const TYPES = [
        'commitment-durations' => DurationsModel::TYPE_COMMITMENT,
        'notice-durations' => DurationsModel::TYPE_NOTICE,
        'renew-durations' => DurationsModel::TYPE_RENEW,
        'invoicing-durations' => DurationsModel::TYPE_INVOICING,
        'payment-conditions' => DurationsModel::TYPE_PAYMENT_CONDITION,
    ];

    /**
     * Mapping des labels
     */
    private const LABELS = [
        'commitment-durations' => 'Durée d\'abonnement',
        'notice-durations' => 'Durée de préavis',
        'renew-durations' => 'Durée de renouvellement',
        'invoicing-durations' => 'Fréquence de facturation',
        'payment-conditions' => 'Condition de paiement',
    ];

    public function index(Request $request, $type)
    {
        if (!isset(self::TYPES[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $gridKey = 'durations';

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

        $durReference = self::TYPES[$type];

        $query = DurationsModel::where('dur_reference', $durReference)
            ->with(['author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname']);

        $this->applyGridFilters($query, $request, [
            'dur_label' => 'dur_label',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'dur_id',
            'dur_label' => 'dur_label',
            'dur_order' => 'dur_order',
        ], 'dur_order', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'dur_order'),
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
     * Display the specified duration.
     */
    public function show($type, $id)
    {
        if (!isset(self::TYPES[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $duration = DurationsModel::where('dur_id', $id)
            ->where('dur_reference', self::TYPES[$type])
            ->with(['author:usr_id,usr_firstname,usr_lastname', 'updater:usr_id,usr_firstname,usr_lastname'])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $duration
        ], 200);
    }

    /**
     * Store a newly created duration.
     */
    public function store(Request $request, $type)
    {
        if (!isset(self::TYPES[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $validatedData = $request->validate([
            'dur_label' => 'required|string|max:255',
            'dur_order' => 'nullable|integer',
            'dur_value' => 'required|integer',
            'dur_time_unit' => 'required|in:day,monthly,annually',
            'dur_mode' => 'nullable|in:advance,arrears',
        ]);

        $validatedData['dur_reference'] = self::TYPES[$type];
        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $duration = DurationsModel::create($validatedData);

        return response()->json([
            'message' => self::LABELS[$type] . ' créée avec succès',
            'data' => $duration->load(['author', 'updater']),
        ], 201);
    }

    /**
     * Update the specified duration.
     */
    public function update(Request $request, $type, $id)
    {
        if (!isset(self::TYPES[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $duration = DurationsModel::where('dur_id', $id)
            ->where('dur_reference', self::TYPES[$type])
            ->firstOrFail();

        $validatedData = $request->validate([
            'dur_label' => 'required|string|max:255',
            'dur_order' => 'nullable|integer',
            'dur_value' => 'required|integer',
            'dur_time_unit' => 'required|in:day,monthly,annually',
            'dur_mode' => 'nullable|in:advance,arrears',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $duration->update($validatedData);

        return response()->json([
            'message' => self::LABELS[$type] . ' mise à jour avec succès',
            'data' => $duration->load(['author', 'updater']),
        ]);
    }

    /**
     * Remove the specified duration.
     */
    public function destroy($type, $id)
    {
        if (!isset(self::TYPES[$type])) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $duration = DurationsModel::where('dur_id', $id)
            ->where('dur_reference', self::TYPES[$type])
            ->firstOrFail();

        $duration->delete();

        return response()->json([
            'message' => self::LABELS[$type] . ' supprimée avec succès'
        ]);
    }

    /**
     * Get options for select (backward compatibility)
     */
    public function options(Request $request, $type)
    {

        $path = $request->path(); // ex: api/durations/commitment-durations
        $durReference = null;

        foreach (self::TYPES as $key => $value) {
            if (Str::contains($path, $key)) {
                $durReference = $value;
                break;
            }
        }

        if ($durReference === null) {
            return response()->json([
                'message' => 'Type de durée invalide'
            ], 400);
        }

        $data = DurationsModel::select('dur_id as id', 'dur_label as label')
            ->where('dur_reference', $durReference)
            ->orderBy('dur_order', 'asc')
            ->orderBy('dur_label', 'asc')
            ->get();

        return response()->json([
            'data' => $data
        ]);
    }
}
