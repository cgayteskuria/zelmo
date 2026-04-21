<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountModel;
use App\Models\AccountMoveLineModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiAccountWorkingController extends Controller
{
    use HasGridFilters;

    private const GRID_KEY = 'account-working';
    /**
     * Récupère les lignes comptables à lettrer
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'acc_id' => 'required|integer|exists:account_account_acc,acc_id',
            'date_start' => 'required|date',
            'date_end' => 'required|date|after_or_equal:date_start',
        ]);

        $accId = $request->input('acc_id');
        $dateStart = $request->input('date_start');
        $dateEnd = $request->input('date_end');

        try {
            $writingPeriod = AccountModel::getWritingPeriod();
            $curExerciseId = $writingPeriod['curExerciseId'];
            $nextExerciseId = $writingPeriod['nextExerciseId'];

            $account =  AccountModel::where('acc_id', $accId)
                ->select(['acc_is_letterable', 'acc_code'])
                ->first();

            $query = AccountMoveLineModel::from('account_move_line_aml as aml')
                ->leftJoin('account_journal_ajl as ajl', 'aml.fk_ajl_id', '=', 'ajl.ajl_id')
                ->leftJoin('account_move_amo as amo', 'aml.fk_amo_id', '=', 'amo.amo_id')
                ->where('aml.fk_acc_id', $accId)
                //->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
                ->whereBetween('aml.aml_date', [$dateStart, $dateEnd])
                ->select([
                    'aml.aml_id',
                    'aml.fk_amo_id',
                    'aml.aml_date',
                    'aml.aml_label_entry',
                    'aml.aml_ref',
                    'aml.aml_debit',
                    'aml.aml_credit',
                    'aml.aml_lettering_code',
                    'aml.aml_lettering_date',
                    'aml.aml_abr_code',
                    'aml.aml_abr_date',
                    'ajl.ajl_code',
                ])
                ->orderBy('aml.aml_date', 'ASC');

            $lines = $query->get();

            // Calculer les totaux
            $totalDebit = $lines->sum('aml_debit');
            $totalCredit = $lines->sum('aml_credit');

            return response()->json([
                'success' => true,
                'account' =>  $account,
                'data' => $lines,
                'summary' => [
                    'total_debit' => $totalDebit,
                    'total_credit' => $totalCredit,
                    'count' => $lines->count(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des lignes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Retourne les paramètres sauvegardés pour la page de travail sur compte
     */
    public function getSettings(): JsonResponse
    {
        $settings = $this->loadGridSettings(self::GRID_KEY);
        return response()->json([
            'success'  => true,
            'settings' => $settings ?? (object)[],
        ]);
    }

    /**
     * Sauvegarde les paramètres de la page de travail sur compte
     */
    public function saveSettings(Request $request): JsonResponse
    {
        $request->validate([
            'acc_id'     => 'nullable|integer|exists:account_account_acc,acc_id',
            'date_start' => 'nullable|date',
            'date_end'   => 'nullable|date',
        ]);

        $settings = array_filter([
            'acc_id'     => $request->input('acc_id'),
            'date_start' => $request->input('date_start'),
            'date_end'   => $request->input('date_end'),
        ], fn($v) => $v !== null);

        $this->saveGridSettings(self::GRID_KEY, $settings);

        return response()->json(['success' => true]);
    }
}
