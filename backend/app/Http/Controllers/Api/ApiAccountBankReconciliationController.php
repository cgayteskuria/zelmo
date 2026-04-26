<?php

namespace App\Http\Controllers\Api;


use App\Models\AccountBankReconciliationModel;
use App\Models\AccountMoveLineModel;
use App\Models\BankDetailsModel;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ApiAccountBankReconciliationController extends Controller
{
    /**
     * Liste des rapprochements bancaires
     *
     * GET /api/account-bank-reconciliations
     */
    public function index(Request $request): JsonResponse
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', 50);
        $sortBy = $request->input('sort_by', 'id');
        $sortOrder = strtoupper($request->input('sort_order', 'asc'));

        $sortColumnMap = [
            'id' => 'abr.abr_id',
            'abr_label' => 'abr.abr_label',
            'abr_date_start' => 'abr.abr_date_start',
            'abr_date_end' => 'abr.abr_date_end',
            'abr_created' => 'abr.abr_created',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'abr.abr_id';

        $query = AccountBankReconciliationModel::from('account_bank_reconciliation_abr as abr')
            ->leftJoin('bank_details_bts as bts', 'abr.fk_bts_id', '=', 'bts.bts_id')
            ->leftJoin('account_account_acc as acc', 'bts.fk_acc_id', '=', 'acc.acc_id')
            ->leftJoin('user_usr as usr', 'abr.fk_usr_id_author', '=', 'usr.usr_id')
            ->select([
                'abr.abr_id as id',
                'abr.abr_label',
                'abr.abr_date_start',
                'abr.abr_date_end',
                'abr.abr_initial_balance',
                'abr.abr_final_balance',
                'abr.abr_gap',
                'abr.abr_status',
                DB::raw('CONCAT(COALESCE(bts.bts_bank_code, ""), " ", COALESCE(bts.bts_label, "")) as bank'),
                DB::raw('CONCAT(COALESCE(acc.acc_code, ""), " ", COALESCE(acc.acc_label, "")) as account'),
                DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as author"),
                'abr.abr_created',
            ]);

        $total = $query->count();

        $data = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get();

        return response()->json([
            'data' => $data,
            'total' => $total,
        ]);
    }

    /**
     * Détail d'un rapprochement bancaire
     *
     * GET /api/account-bank-reconciliations/{id}
     */
    public function show($id): JsonResponse
    {

        $data = AccountBankReconciliationModel::withCount('documents')
            ->with(['bankDetails' => function ($q) {
                $q->select('bts_id', 'fk_acc_id');
            }])
            ->findOrFail($id);

        // Ajouter un attribut calculé pour le compte bancaire
        $data->bank_account = optional($data->bankDetails->account)->acc_code . ' ' . optional($data->bankDetails->account)->acc_label;

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Récupérer les données du dernier rapprochement pour une banque
     *
     * GET /api/account-bank-reconciliations/last/{btsId}
     */
    public function getLastReconciliation($btsId): JsonResponse
    {
        $lastReconciliation = AccountBankReconciliationModel::where('fk_bts_id', $btsId)
            ->orderBy('abr_id', 'DESC')
            ->select(['abr_final_balance as final_balance', 'abr_date_end as date_end'])
            ->first();

        if ($lastReconciliation) {
            return response()->json([
                'data' => $lastReconciliation
            ]);
        }

        return response()->json([
            'data' => [
                'final_balance' => 0,
                'date_end' => null
            ]
        ]);
    }

    /**
     * Créer un nouveau rapprochement bancaire
     *
     * POST /api/account-bank-reconciliations
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'abr_label' => 'required|string|max:50',
            'fk_bts_id' => 'required|exists:bank_details_bts,bts_id',
            'abr_date_start' => 'required|date',
            'abr_date_end' => 'required|date|after_or_equal:abr_date_start',
            'abr_initial_balance' => 'required|numeric',
            'abr_final_balance' => 'required|numeric',
        ]);

        try {
            DB::beginTransaction();

            // Mettre à jour le statut du dernier rapprochement de cette banque (passer à 1 = historique)
            AccountBankReconciliationModel::where('fk_bts_id', $request->fk_bts_id)
                ->orderBy('abr_id', 'DESC')
                ->limit(1)
                ->update(['abr_status' => 1]);

            // Créer le nouveau rapprochement
            $reconciliation = AccountBankReconciliationModel::create([
                'abr_label' => $request->abr_label,
                'fk_bts_id' => $request->fk_bts_id,
                'abr_date_start' => $request->abr_date_start,
                'abr_date_end' => $request->abr_date_end,
                'abr_initial_balance' => $request->abr_initial_balance,
                'abr_final_balance' => $request->abr_final_balance,
                'abr_status' => 0, // En cours
                'fk_usr_id_author' =>  Auth::user()?->usr_id,
                // 'fk_usr_id_updater' =>auth()->user()->usr_id,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Rapprochement bancaire créé avec succès',
                'data' => $reconciliation
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création du rapprochement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupérer les lignes comptables pour un rapprochement
     *
     * GET /api/account-bank-reconciliations/{id}/lines
     */
    public function getLines($id, Request $request): JsonResponse
    {
        $showPointed = $request->input('show_pointed', false);

        // Récupérer les infos du rapprochement
        $reconciliation = AccountBankReconciliationModel::from('account_bank_reconciliation_abr as abr')
            ->leftJoin('bank_details_bts as bts', 'abr.fk_bts_id', '=', 'bts.bts_id')
            ->where('abr.abr_id', $id)
            ->select(['bts.fk_acc_id', 'abr.abr_date_start', 'abr.abr_date_end', 'abr.abr_status'])
            ->firstOrFail();

        // Récupérer les lignes comptables
        $query = AccountMoveLineModel::from('account_move_line_aml as aml')
            ->leftJoin('account_journal_ajl as ajl', 'aml.fk_ajl_id', '=', 'ajl.ajl_id')
            ->leftJoin('account_bank_reconciliation_abr as abr', 'aml.fk_abr_id', '=', 'abr.abr_id')
            ->where('aml.fk_acc_id', $reconciliation->fk_acc_id)
            ->whereBetween('aml.aml_date', [$reconciliation->abr_date_start, $reconciliation->abr_date_end])
            ->where(function ($q) use ($id) {
                $q->where('aml.fk_abr_id', $id)
                    ->orWhereNull('aml.fk_abr_id');
            })
            ->select([
                'aml.aml_id',
                'aml.fk_amo_id',
                'ajl.ajl_code',
                'aml.aml_date',
                'aml.aml_label_entry',
                'aml.aml_ref',
                'aml.aml_debit',
                'aml.aml_credit',
                'abr.abr_label as reconciliation_label',
                'abr.abr_id as reconciliation_id',
                'aml.fk_abr_id',
            ]);

        // Si on veut voir les mouvements pointés sur d'autres rapprochements
        if ($showPointed) {
            $query->orWhere(function ($q) use ($id, $reconciliation) {
                $q->where('aml.fk_acc_id', $reconciliation->fk_acc_id)
                    ->whereBetween('aml.aml_date', [$reconciliation->abr_date_start, $reconciliation->abr_date_end])
                    ->where('aml.fk_abr_id', '!=', $id)
                    ->whereNotNull('aml.fk_abr_id');
            });
        }

        $lines = $query->orderBy('aml.aml_date', 'ASC')->get();

        return response()->json([
            'success' => true,
            'data' => $lines
        ]);
    }

    /**
     * Mettre à jour le pointage des lignes
     *
     * PUT /api/account-bank-reconciliations/{id}/pointing
     */
    public function updatePointing($id, Request $request): JsonResponse
    {
        $request->validate([
            'pointed_lines' => 'required|array',
            'pointed_lines.*' => 'integer|exists:account_move_line_aml,aml_id',
        ]);

        try {
            DB::beginTransaction();

            $pointedLines = $request->pointed_lines;

            // Pointer les lignes sélectionnées
            if (!empty($pointedLines)) {
                AccountMoveLineModel::whereIn('aml_id', $pointedLines)
                    ->update([
                        'fk_abr_id' => $id,
                        'aml_abr_code' => 'X',
                        'aml_abr_date' => now(),
                    ]);
            }

            // Dépointer les lignes non sélectionnées qui étaient pointées sur ce rapprochement
            AccountMoveLineModel::where('fk_abr_id', $id)
                ->when(!empty($pointedLines), function ($query) use ($pointedLines) {
                    $query->whereNotIn('aml_id', $pointedLines);
                })
                ->update([
                    'fk_abr_id' => null,
                    'aml_abr_code' => null,
                    'aml_abr_date' => null,
                ]);

            // Calculer et stocker l'écart
            $reconciliation = AccountBankReconciliationModel::findOrFail($id);

            $totals = AccountMoveLineModel::where('fk_abr_id', $id)
                ->selectRaw('COALESCE(SUM(aml_debit), 0) as total_debit, COALESCE(SUM(aml_credit), 0) as total_credit')
                ->first();

            $gap = round(
                $reconciliation->abr_final_balance
                - $reconciliation->abr_initial_balance
                - $totals->total_debit
                + $totals->total_credit,
                2
            );

            $reconciliation->update([
                'abr_gap'              => $gap,
                'fk_usr_id_updater'    => $request->user()->usr_id,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Rapprochement mis à jour avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour du rapprochement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un rapprochement bancaire
     *
     * DELETE /api/account-bank-reconciliations/{id}
     */
    public function destroy($id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $reconciliation = AccountBankReconciliationModel::findOrFail($id);
            $btsId = $reconciliation->fk_bts_id;

            // Dépointer toutes les lignes
            AccountMoveLineModel::where('fk_abr_id', $id)
                ->update([
                    'fk_abr_id' => null,
                    'aml_abr_code' => null,
                    'aml_abr_date' => null,
                ]);

            // Supprimer le rapprochement
            $reconciliation->delete();

            // Remettre le dernier rapprochement restant en statut 0 (en cours)
            AccountBankReconciliationModel::where('fk_bts_id', $btsId)
                ->orderBy('abr_id', 'DESC')
                ->limit(1)
                ->update(['abr_status' => 0]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Rapprochement supprimé avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression du rapprochement',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
