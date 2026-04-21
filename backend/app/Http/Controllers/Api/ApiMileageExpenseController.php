<?php

namespace App\Http\Controllers\Api;

use App\Models\MileageExpenseModel;
use App\Models\MileageScaleModel;
use App\Models\ExpenseReportModel;
use App\Models\VehicleModel;
use App\Models\AccountModel;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

use App\Services\AccountingService;
use Carbon\Carbon;

class ApiMileageExpenseController
{
    /**
     * Liste des frais kilometriques d'une note de frais
     */
    public function index(Request $request, $exrId)
    {
        ExpenseReportModel::findOrFail($exrId);

        $query = MileageExpenseModel::with('vehicle')
            ->where('fk_exr_id', $exrId)
            ->orderBy('mex_date', 'desc');

        $mileageExpenses = $query->get();

        return response()->json([
            'success' => true,
            'data' => $mileageExpenses->map(fn($m) => $this->formatMileageExpense($m)),
        ]);
    }

    /**
     * Afficher un frais kilometrique
     */
    public function show($exrId, $id)
    {
        $mileageExpense = MileageExpenseModel::with('vehicle')
            ->where('fk_exr_id', $exrId)
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatMileageExpense($mileageExpense),
        ]);
    }

    /**
     * Creer un frais kilometrique
     */
    public function store(Request $request, $exrId)
    {
        $report = ExpenseReportModel::findOrFail($exrId);

        if (!$report->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas etre modifiee',
            ], 422);
        }

        $request->validate([
            'fk_vhc_id' => 'required|integer|exists:vehicle_vhc,vhc_id',
            'mex_date' => 'required|date',
            'mex_departure' => 'required|string|max:255',
            'mex_destination' => 'required|string|max:255',
            'mex_distance_km' => 'required|numeric|min:0.1',
            'mex_is_round_trip' => 'nullable|boolean',
            'mex_notes' => 'nullable|string',
        ]);

        // Valider que la date est dans la période de saisie
        try {
            AccountModel::validateWritingPeriod($request->mex_date);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $vehicle = VehicleModel::findOrFail($request->fk_vhc_id);
        $isRoundTrip = $request->boolean('mex_is_round_trip', false);
        $effectiveDistance = $request->mex_distance_km * ($isRoundTrip ? 2 : 1);

        $year = Carbon::parse($request->mex_date)->year;

        // Calculer le total annuel AVANT ce nouveau trajet
        try {
            $previousAnnualDistance = MileageExpenseModel::getYearlyDistanceForVehicle(
                $request->fk_vhc_id,
                $request->mex_date
            );

            // Calculer le montant déjà payé sur l'année
            $alreadyPaid = MileageExpenseModel::getYearlyPaidAmount(
                $request->fk_vhc_id,
                $request->mex_date
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // Calculer le montant incrémental avec la logique française
        try {
            $calculation = MileageScaleModel::calculateIncrementalAmount(
                $previousAnnualDistance,
                $effectiveDistance,
                $alreadyPaid,
                $vehicle->vhc_fiscal_power,
                $vehicle->vhc_type,
                $year
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $mileageExpense = MileageExpenseModel::create([
            'fk_exr_id' => $exrId,
            'fk_vhc_id' => $request->fk_vhc_id,
            'mex_date' => $request->mex_date,
            'mex_departure' => $request->mex_departure,
            'mex_destination' => $request->mex_destination,
            'mex_distance_km' => $request->mex_distance_km,
            'mex_is_round_trip' => $isRoundTrip,
            'mex_fiscal_power' => $vehicle->vhc_fiscal_power,
            'mex_vehicle_type' => $vehicle->vhc_type,
            'mex_rate_coefficient' => $calculation['coefficient'],
            'mex_rate_constant' => $calculation['constant'],
            'mex_calculated_amount' => $calculation['amount'],
            'mex_notes' => $request->mex_notes,
        ]);

        $mileageExpense->load('vehicle');

        return response()->json([
            'success' => true,
            'message' => 'Frais kilometrique cree avec succes',
            'data' => $this->formatMileageExpense($mileageExpense),
            'calculation_details' => [
                'previous_annual_km' => $previousAnnualDistance,
                'new_trip_km' => $effectiveDistance,
                'new_annual_total_km' => $previousAnnualDistance + $effectiveDistance,
                'already_paid' => $calculation['already_paid'],
                'total_due' => $calculation['total_due'],
                'amount_to_reimburse' => $calculation['amount'],
            ],
        ], 201);
    }

    /**
     * Mettre a jour un frais kilometrique
     */
    public function update(Request $request, $exrId, $id)
    {
        $report = ExpenseReportModel::findOrFail($exrId);

        if (!$report->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas etre modifiee',
            ], 422);
        }

        $mileageExpense = MileageExpenseModel::where('fk_exr_id', $exrId)->findOrFail($id);

        $request->validate([
            'fk_vhc_id' => 'sometimes|required|integer|exists:vehicle_vhc,vhc_id',
            'mex_date' => 'sometimes|required|date',
            'mex_departure' => 'sometimes|required|string|max:255',
            'mex_destination' => 'sometimes|required|string|max:255',
            'mex_distance_km' => 'sometimes|required|numeric|min:0.1',
            'mex_is_round_trip' => 'nullable|boolean',
            'mex_notes' => 'nullable|string',
        ]);

        $date = $request->input('mex_date', $mileageExpense->mex_date);

        // Valider que la date est dans la période de saisie
        try {
            AccountModel::validateWritingPeriod($date);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $vehicleId = $request->input('fk_vhc_id', $mileageExpense->fk_vhc_id);
        $vehicle = VehicleModel::findOrFail($vehicleId);

        $distance = $request->input('mex_distance_km', $mileageExpense->mex_distance_km);
        $isRoundTrip = $request->has('mex_is_round_trip')
            ? $request->boolean('mex_is_round_trip')
            : (bool) $mileageExpense->mex_is_round_trip;
        $effectiveDistance = $distance * ($isRoundTrip ? 2 : 1);

        $year = Carbon::parse($date)->year;

        // Calculer le total annuel SANS ce frais (qui va être modifié)
        try {
            $previousAnnualDistance = MileageExpenseModel::getYearlyDistanceForVehicle(
                $vehicleId,
                $date,
                $id // Exclure ce frais
            );

            // Calculer le montant déjà payé SANS ce frais
            $alreadyPaid = MileageExpenseModel::getYearlyPaidAmount(
                $vehicleId,
                $date,
                $id // Exclure ce frais
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // Calculer le montant incrémental avec la logique française
        try {
            $calculation = MileageScaleModel::calculateIncrementalAmount(
                $previousAnnualDistance,
                $effectiveDistance,
                $alreadyPaid,
                $vehicle->vhc_fiscal_power,
                $vehicle->vhc_type,
                $year
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $updateData = array_filter([
            'fk_vhc_id' => $request->input('fk_vhc_id'),
            'mex_date' => $request->input('mex_date'),
            'mex_departure' => $request->input('mex_departure'),
            'mex_destination' => $request->input('mex_destination'),
            'mex_distance_km' => $request->input('mex_distance_km'),
        ], fn($v) => $v !== null);

        $updateData['mex_is_round_trip'] = $isRoundTrip;
        $updateData['mex_fiscal_power'] = $vehicle->vhc_fiscal_power;
        $updateData['mex_vehicle_type'] = $vehicle->vhc_type;
        $updateData['mex_rate_coefficient'] = $calculation['coefficient'];
        $updateData['mex_rate_constant'] = $calculation['constant'];
        $updateData['mex_calculated_amount'] = $calculation['amount'];

        if ($request->has('mex_notes')) {
            $updateData['mex_notes'] = $request->mex_notes;
        }

        $mileageExpense->update($updateData);
        $mileageExpense->load('vehicle');

        return response()->json([
            'success' => true,
            'message' => 'Frais kilometrique mis a jour avec succes',
            'data' => $this->formatMileageExpense($mileageExpense->fresh()->load('vehicle')),
        ]);
    }

    /**
     * Supprimer un frais kilometrique
     */
    public function destroy($exrId, $id)
    {
        $report = ExpenseReportModel::findOrFail($exrId);

        if (!$report->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas etre modifiee',
            ], 422);
        }

        $mileageExpense = MileageExpenseModel::where('fk_exr_id', $exrId)->findOrFail($id);
        $mileageExpense->delete();

        return response()->json([
            'success' => true,
            'message' => 'Frais kilometrique supprime avec succes',
        ]);
    }

    /**
     * Previsualiser le calcul d'un frais kilometrique
     */
    public function calculatePreview(Request $request)
    {
        $request->validate([
            'fk_vhc_id' => 'required|integer|exists:vehicle_vhc,vhc_id',
            'mex_distance_km' => 'required|numeric|min:0.1',
            'mex_is_round_trip' => 'nullable|boolean',
            'mex_date' => 'nullable|date',
            'mex_id' => 'nullable|integer',
        ]);

        $date = $request->filled('mex_date') ? $request->mex_date : now()->format('Y-m-d');

        // Valider que la date est dans la période de saisie
        try {
            AccountModel::validateWritingPeriod($date);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $vehicle = VehicleModel::findOrFail($request->fk_vhc_id);
        $isRoundTrip = $request->boolean('mex_is_round_trip', false);
        $effectiveDistance = $request->mex_distance_km * ($isRoundTrip ? 2 : 1);

        $year = Carbon::parse($date)->year;

        // Calculer le total annuel et le montant déjà payé
        try {
            $previousAnnualDistance = MileageExpenseModel::getYearlyDistanceForVehicle(
                $request->fk_vhc_id,
                $date,
                $request->input('mex_id')
            );

            $alreadyPaid = MileageExpenseModel::getYearlyPaidAmount(
                $request->fk_vhc_id,
                $date,
                $request->input('mex_id')
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // Calculer le montant incrémental
        try {
          
            $calculation = MileageScaleModel::calculateIncrementalAmount(
                $previousAnnualDistance,
                $effectiveDistance,
                $alreadyPaid,
                $vehicle->vhc_fiscal_power,
                $vehicle->vhc_type,
                $year
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'trip_distance' => (float) $request->mex_distance_km,
                'is_round_trip' => $isRoundTrip,
                'effective_distance' => $effectiveDistance,
                'previous_annual_km' => $previousAnnualDistance,
                'new_annual_total_km' => $previousAnnualDistance + $effectiveDistance,
                'already_paid' => $calculation['already_paid'],
                'total_due' => $calculation['total_due'],
                'amount_to_reimburse' => $calculation['amount'],
                'fiscal_power' => $vehicle->vhc_fiscal_power,
                'vehicle_type' => $vehicle->vhc_type,
                'rate_coefficient' => $calculation['coefficient'],
                'rate_constant' => $calculation['constant'],
            ],
        ]);
    }

    /**
     * Formatter un frais kilometrique
     */
    private function formatMileageExpense(MileageExpenseModel $mex): array
    {
        return [
            'id' => $mex->mex_id,
            'mex_id' => $mex->mex_id,
            'fk_exr_id' => $mex->fk_exr_id,
            'fk_vhc_id' => $mex->fk_vhc_id,
            'mex_date' => $mex->mex_date ? $mex->mex_date->format('Y-m-d') : null,
            'mex_departure' => $mex->mex_departure,
            'mex_destination' => $mex->mex_destination,
            'mex_distance_km' => (float) $mex->mex_distance_km,
            'mex_is_round_trip' => (bool) $mex->mex_is_round_trip,
            'mex_fiscal_power' => $mex->mex_fiscal_power,
            'mex_vehicle_type' => $mex->mex_vehicle_type,
            'mex_rate_coefficient' => (float) $mex->mex_rate_coefficient,
            'mex_rate_constant' => (float) $mex->mex_rate_constant,
            'mex_calculated_amount' => (float) $mex->mex_calculated_amount,
            'mex_notes' => $mex->mex_notes,
            'vehicle' => $mex->vehicle ? [
                'id' => $mex->vehicle->vhc_id,
                'vhc_name' => $mex->vehicle->vhc_name,
                'vhc_registration' => $mex->vehicle->vhc_registration,
                'vhc_fiscal_power' => $mex->vehicle->vhc_fiscal_power,
                'vhc_type' => $mex->vehicle->vhc_type,
            ] : null,
        ];
    }
}
