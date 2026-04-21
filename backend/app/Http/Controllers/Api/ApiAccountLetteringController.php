<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountModel;
use App\Models\AccountMoveLineModel;
use App\Services\AccountLetteringService;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiAccountLetteringController extends Controller
{
    use HasGridFilters;
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
            'show_lettered' => 'nullable|bool',
        ]);

        $accId = $request->input('acc_id');
        $dateStart = $request->input('date_start');
        $dateEnd = $request->input('date_end');
        $showLettered = $request->input('show_lettered', false);

        try {
            $writingPeriod = AccountModel::getWritingPeriod();
            $curExerciseId = $writingPeriod['curExerciseId'];
            $nextExerciseId = $writingPeriod['nextExerciseId'];

            $query = AccountMoveLineModel::from('account_move_line_aml as aml')
                ->leftJoin('account_journal_ajl as ajl', 'aml.fk_ajl_id', '=', 'ajl.ajl_id')
                ->leftJoin('account_move_amo as amo', 'aml.fk_amo_id', '=', 'amo.amo_id')
                ->where('aml.fk_acc_id', $accId)
                ->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
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
                    'ajl.ajl_code',
                ])
                ->orderBy('aml.aml_date', 'ASC');


            if (!$showLettered) {
                $query->whereNull('aml.aml_lettering_code');
            }

            $lines = $query->get();

            // Calculer les totaux
            $totalDebit = $lines->sum('aml_debit');
            $totalCredit = $lines->sum('aml_credit');

            //Obtien le code lettage
            $AccountLetteringService = new AccountLetteringService();
            $nextCode = $AccountLetteringService->getNextLetteringCode($accId);

            return response()->json([
                'success' => true,
                'data' => $lines,
                'nextCode' =>  $nextCode,
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
     * Applique un lettrage sur des lignes comptables
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function applyLettering(Request $request): JsonResponse
    {
        $request->validate([
            'lettering_code' => 'required|string|max:50',
            'acc_id' => 'required|integer|exists:account_account_acc,acc_id',
            'aml_ids' => 'required|array|min:2',
            'aml_ids.*' => 'required|integer|exists:account_move_line_aml,aml_id',
        ]);

        $letteringCode = strtoupper(trim($request->input('lettering_code')));
        $accId = $request->input('acc_id');
        $amlIds = $request->input('aml_ids');

        try {
            // Utiliser le service pour appliquer le lettrage avec toutes les validations
            $letteringService = new AccountLetteringService();
            $letteringService->saveLettering($letteringCode, $accId, $amlIds);


            return response()->json([
                'success' => true,
                'message' => 'Lettrage appliqué avec succès.',
                'lettered_lines' => count($amlIds),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Supprime un lettrage sur des lignes comptables
     *
     * @param Request $request
     * @return JsonResponse
     */
    /**
     * Retourne les paramètres sauvegardés pour la page de lettrage
     */
    public function getSettings(): JsonResponse
    {
        $settings = $this->loadGridSettings('account-lettering');
        return response()->json([
            'success' => true,
            'settings' => $settings ?? (object)[],
        ]);
    }

    /**
     * Sauvegarde les paramètres de la page de lettrage
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

        $this->saveGridSettings('account-lettering', $settings);

        return response()->json(['success' => true]);
    }

    public function removeLettering(Request $request): JsonResponse
    {
        $request->validate([
            'acc_id' => 'required|integer|exists:account_account_acc,acc_id',
            'date_start' => 'nullable|date',
            'date_end' => 'nullable|date|after_or_equal:date_start',
            'lettering_code' => 'nullable|string|max:50',
        ]);

        $accId = $request->input('acc_id');
        $dateStart = $request->input('date_start');
        $dateEnd = $request->input('date_end');
        $letteringCode = $request->input('lettering_code');

        try {
            // Validation que les lignes à modifiées soit toutes dans la période de saisi
            $writingPeriod = AccountModel::getWritingPeriod();


            if ($dateStart && $dateStart < $writingPeriod['startDate']->format('Y-m-d')) {
                throw new \Exception(
                    "La date de début ({$dateStart}) est antérieure au début de la période de saisie (" .
                        $writingPeriod['startDate']->format('d/m/Y') . ")"
                );
            }

            if ($dateEnd && $dateEnd > $writingPeriod['endDate']->format('Y-m-d')) {
                throw new \Exception(
                    "La date de fin ({$dateEnd}) est postérieure à la fin de l'exercice (" .
                        $writingPeriod['endDate']->format('d/m/Y') . ")"
                );
            }

            if ($dateStart && $dateEnd && $dateStart > $dateEnd) {
                throw new \Exception("La date de début ne peut pas être postérieure à la date de fin");
            }

            DB::beginTransaction();

            // Récupérer les lignes qui vont être délettrées pour validation
            $baseQuery  = AccountMoveLineModel::from('account_move_line_aml as aml')
                ->join('account_move_amo as amo', 'aml.fk_amo_id', '=', 'amo.amo_id')
                ->whereIn('amo.fk_aex_id', [
                    $writingPeriod['curExerciseId'],
                    $writingPeriod['nextExerciseId']
                ])
                ->where('aml.fk_acc_id', $accId)
                ->whereNotNull('aml.aml_lettering_code');

            if (!empty($letteringCode)) {
                $baseQuery->when(!empty($letteringCode), function ($q) use ($letteringCode) {
                    $q->where('aml.aml_lettering_code', strtoupper($letteringCode));
                });
            }

            if ($dateStart && $dateEnd) {
                $baseQuery
                    ->whereBetween('aml.aml_lettering_date', [$dateStart, $dateEnd]);
            }

            $checkQuery = clone $baseQuery;

            $linesToUnletter = $checkQuery->select('aml.aml_id', 'aml.aml_lettering_code', 'aml.aml_debit', 'aml.aml_credit')
                ->get();

            // Validation : vérifier que chaque groupe de lettrage est équilibré
            $groupedByCode = $linesToUnletter->groupBy('aml_lettering_code');

            foreach ($groupedByCode as $code => $linesInGroup) {
                $totalDebit = $linesInGroup->sum('aml_debit');
                $totalCredit = $linesInGroup->sum('aml_credit');
                $difference = round(abs($totalDebit - $totalCredit), 2);

                if ($difference !== 0.00) {
                    throw new \Exception(
                        "Le groupe de lettrage '{$code}' n'est pas équilibré. " .
                            "Débit: {$totalDebit}€, Crédit: {$totalCredit}€, Différence: {$difference}€. " .
                            "Impossible de délettrer un groupe déséquilibré."
                    );
                }
            }

            $updateQuery = clone $baseQuery;

            $affectedRows = $updateQuery->update([
                'aml_lettering_code' => null,
                'aml_lettering_date' => null,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $affectedRows == 0 ? "Aucune ligne à déléttrer" : "{$affectedRows} ligne(s) délettrée(s) avec succès.",
                'affected_rows' => $affectedRows,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }  
}
