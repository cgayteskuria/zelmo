<?php

namespace App\Http\Controllers\Api;

use App\Models\MileageScaleModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ApiMileageScaleController
{
    /**
     * Liste du bareme, groupe par annee
     */
    public function index(Request $request)
    {
        $query = MileageScaleModel::query()
            ->orderBy('msc_year', 'desc')
            ->orderBy('msc_vehicle_type', 'asc')
            ->orderBy('msc_fiscal_power', 'asc')
            ->orderBy('msc_min_distance', 'asc');

        if ($request->filled('year')) {
            $query->forYear($request->year);
        }

        if ($request->filled('vehicle_type')) {
            $query->where('msc_vehicle_type', $request->vehicle_type);
        }

        $scales = $query->get();

        return response()->json([
            'success' => true,
            'data' => $scales->map(fn($s) => $this->formatScale($s)),
        ]);
    }

    /**
     * Afficher une entree du bareme
     */
    public function show($id)
    {
        $scale = MileageScaleModel::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatScale($scale),
        ]);
    }

    /**
     * Recuperer le bareme pour une annee donnee
     */
    public function getByYear($year)
    {
        $scales = MileageScaleModel::forYear($year)
            ->orderBy('msc_vehicle_type', 'asc')
            ->orderBy('msc_fiscal_power', 'asc')
            ->orderBy('msc_min_distance', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $scales->map(fn($s) => $this->formatScale($s)),
            'meta' => [
                'year' => (int) $year,
                'count' => $scales->count(),
            ],
        ]);
    }

    /**
     * Creer une entree de bareme
     */
    public function store(Request $request)
    {
        $request->validate([
            'msc_year' => 'required|integer|min:2000|max:2100',
            'msc_vehicle_type' => 'required|in:car,motorcycle,moped',
            'msc_fiscal_power' => 'required|string|max:10',
            'msc_min_distance' => 'required|integer|min:0',
            'msc_max_distance' => 'nullable|integer|min:1',
            'msc_coefficient' => 'required|numeric|min:0',
            'msc_constant' => 'nullable|numeric|min:0',
            'msc_is_active' => 'nullable|boolean',
        ]);

        $data = $request->only([
            'msc_year', 'msc_vehicle_type', 'msc_fiscal_power',
            'msc_min_distance', 'msc_max_distance',
            'msc_coefficient', 'msc_constant', 'msc_is_active',
        ]);
        $data['fk_usr_id_author'] = Auth::id();

        $scale = MileageScaleModel::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Entree de bareme creee avec succes',
            'data' => $this->formatScale($scale),
        ], 201);
    }

    /**
     * Mettre a jour une entree de bareme
     */
    public function update(Request $request, $id)
    {
        $scale = MileageScaleModel::findOrFail($id);

        $request->validate([
            'msc_year' => 'sometimes|required|integer|min:2000|max:2100',
            'msc_vehicle_type' => 'sometimes|required|in:car,motorcycle,moped',
            'msc_fiscal_power' => 'sometimes|required|string|max:10',
            'msc_min_distance' => 'sometimes|required|integer|min:0',
            'msc_max_distance' => 'nullable|integer|min:1',
            'msc_coefficient' => 'sometimes|required|numeric|min:0',
            'msc_constant' => 'nullable|numeric|min:0',
            'msc_is_active' => 'nullable|boolean',
        ]);

        $data = $request->only([
            'msc_year', 'msc_vehicle_type', 'msc_fiscal_power',
            'msc_min_distance', 'msc_max_distance',
            'msc_coefficient', 'msc_constant', 'msc_is_active',
        ]);
        $data['fk_usr_id_updater'] = Auth::id();

        $scale->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Entree de bareme mise a jour avec succes',
            'data' => $this->formatScale($scale->fresh()),
        ]);
    }

    /**
     * Supprimer une entree de bareme
     */
    public function destroy($id)
    {
        $scale = MileageScaleModel::findOrFail($id);
        $scale->delete();

        return response()->json([
            'success' => true,
            'message' => 'Entree de bareme supprimee avec succes',
        ]);
    }

    /**
     * Dupliquer le bareme d'une annee vers une autre
     */
    public function duplicate(Request $request)
    {
        $request->validate([
            'source_year' => 'required|integer',
            'target_year' => 'required|integer|different:source_year',
        ]);

        $sourceScales = MileageScaleModel::forYear($request->source_year)->get();

        if ($sourceScales->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun bareme trouve pour l\'annee ' . $request->source_year,
            ], 422);
        }

        // Verifier qu'il n'y a pas deja de bareme pour l'annee cible
        $existingCount = MileageScaleModel::forYear($request->target_year)->count();
        if ($existingCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Un bareme existe deja pour l\'annee ' . $request->target_year . '. Supprimez-le d\'abord.',
            ], 422);
        }

        $userId = Auth::id();

        foreach ($sourceScales as $source) {
            MileageScaleModel::create([
                'msc_year' => $request->target_year,
                'msc_vehicle_type' => $source->msc_vehicle_type,
                'msc_fiscal_power' => $source->msc_fiscal_power,
                'msc_min_distance' => $source->msc_min_distance,
                'msc_max_distance' => $source->msc_max_distance,
                'msc_coefficient' => $source->msc_coefficient,
                'msc_constant' => $source->msc_constant,
                'msc_is_active' => $source->msc_is_active,
                'fk_usr_id_author' => $userId,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bareme duplique avec succes de ' . $request->source_year . ' vers ' . $request->target_year,
            'data' => [
                'entries_count' => $sourceScales->count(),
            ],
        ]);
    }

    /**
     * Formatter une entree de bareme
     */
    private function formatScale(MileageScaleModel $scale): array
    {
        return [
            'id' => $scale->msc_id,
            'msc_id' => $scale->msc_id,
            'msc_year' => $scale->msc_year,
            'msc_vehicle_type' => $scale->msc_vehicle_type,
            'msc_fiscal_power' => $scale->msc_fiscal_power,
            'msc_min_distance' => $scale->msc_min_distance,
            'msc_max_distance' => $scale->msc_max_distance,
            'msc_coefficient' => (float) $scale->msc_coefficient,
            'msc_constant' => (float) $scale->msc_constant,
            'msc_is_active' => (bool) $scale->msc_is_active,
        ];
    }
}
