<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountMoveModel;
use App\Models\AccountMoveLineModel;
use App\Models\AccountModel;
use App\Models\AccountJournalModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\Auth;

class ApiAccountMoveController extends Controller
{
    use HasGridFilters;

    public function __construct() {}

    public function index(Request $request)
    {
        $gridKey = 'account-moves';

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

        $columnMap = [
            'id'         => 'amo.amo_id',
            'amo_id'     => 'amo.amo_id',
            'amo_date'   => 'amo.amo_date',
            'amo_label'  => 'amo.amo_label',
            'amo_ref'    => 'amo.amo_ref',
            'ajl_code'   => 'ajl.ajl_code',
            'amo_amount' => 'amo.amo_amount',
        ];

        $query = AccountMoveModel::from('account_move_amo as amo')
            ->leftJoin('account_journal_ajl as ajl', 'amo.fk_ajl_id', '=', 'ajl.ajl_id')
            ->select([
                'amo.amo_id as id',
                'amo.amo_id',
                'amo.amo_valid',
                'ajl.ajl_code',
                'amo.amo_date',
                'amo.amo_label',
                'amo.amo_ref',
                'amo.amo_amount',
            ]);

        $this->applyGridFilters($query, $request, $columnMap);

        $total = $query->count();

        $this->applyGridSort($query, $request, $columnMap, 'amo_date', 'DESC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'amo_date'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
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
     * Affiche une écriture comptable spécifique
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id)
    {
        $move = AccountMoveModel::with([
            'journal:ajl_id,ajl_label',
            'parentMove:amo_id,amo_label,amo_ref,amo_date,fk_ajl_id',
            'parentMove.journal:ajl_id,ajl_label',
            'linkedMoves:amo_id,amo_label,amo_ref,amo_date,fk_amo_id_parent,fk_ajl_id',
            'linkedMoves.journal:ajl_id,ajl_label',
        ])->findOrFail($id);

        $AccountMoveModel = new AccountMoveModel();
        // Vérifier si l'écriture est éditable (inclut les écritures liées pay↔vat_od)
        $editable = $AccountMoveModel->isEditable($id);

        // Détecter si le verrou vient d'une écriture liée plutôt que de l'écriture elle-même
        $lockedByLinked = false;
        if (!$editable) {
            $selfEditable = $AccountMoveModel->isEditableSelf($id);
            $lockedByLinked = $selfEditable; // l'écriture elle-même est OK mais une liée ne l'est pas
        }

        $moveData = $move->toArray();
        $moveData['editable']          = $editable;
        $moveData['locked_by_linked']  = $lockedByLinked;

        return response()->json([
            'data' => $moveData
        ]);
    }


    /**
     * Récupère les lignes d'une écriture comptable
     *
     * @param int $id
     * @return JsonResponse
     */
    public function getLines($id)
    {

        $lines = AccountMoveLineModel::from('account_move_line_aml as aml')
            ->with([
                'bankReconciliation:abr_id,abr_label',
                'account:acc_id,acc_label,acc_code,acc_type',
                'tax:tax_id,tax_label',
            ])
            ->select([
                'aml_id',
                'fk_parent_aml_id',
                'fk_acc_id',
                'fk_abr_id',
                'fk_tax_id',
                'aml_is_tax_line',
                'aml_label_entry',
                'aml_ref',
                'aml_debit',
                'aml_credit',
                'aml_lettering_code',
                'aml_lettering_date',
                'aml_abr_code',
                'aml_abr_date',
                // Déclaration TVA liée : via amr → vdl → vdc
                DB::raw('(
                    SELECT vdc.vdc_id
                    FROM account_move_line_tag_rel_amr amr
                    INNER JOIN account_tax_declaration_line_vdl vdl ON vdl.vdl_id = amr.fk_vdl_id
                    INNER JOIN account_tax_declaration_vdc vdc ON vdc.vdc_id = vdl.fk_vdc_id
                    WHERE amr.fk_aml_id = aml.aml_id AND amr.fk_vdl_id IS NOT NULL
                    LIMIT 1
                ) as vat_declaration_id'),
                DB::raw('(
                    SELECT vdc.vdc_label
                    FROM account_move_line_tag_rel_amr amr
                    INNER JOIN account_tax_declaration_line_vdl vdl ON vdl.vdl_id = amr.fk_vdl_id
                    INNER JOIN account_tax_declaration_vdc vdc ON vdc.vdc_id = vdl.fk_vdc_id
                    WHERE amr.fk_aml_id = aml.aml_id AND amr.fk_vdl_id IS NOT NULL
                    LIMIT 1
                ) as vat_declaration_label'),
            ])
            ->where('aml.fk_amo_id', $id)
            ->orderByRaw('COALESCE(aml.fk_parent_aml_id, aml.aml_id), aml.aml_id')
            ->get();

        return response()->json([
            'data' => $lines
        ]);
    }

    /**
     * Crée une nouvelle écriture comptable
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fk_ajl_id'                      => 'required|integer|exists:account_journal_ajl,ajl_id',
            'amo_date'                        => 'required|date',
            'amo_label'                       => 'required|string|max:255',
            'amo_ref'                         => 'nullable|string|max:255',
            'amo_valid'                       => 'nullable|boolean',
            'moveLines'                       => 'required|array|min:2',
            'moveLines.*.aml_id'              => 'nullable|integer',
            'moveLines.*.fk_acc_id'           => 'required|integer|exists:account_account_acc,acc_id',
            'moveLines.*.aml_label_entry'     => 'required|string|max:255',
            'moveLines.*.aml_ref'             => 'nullable|string|max:255',
            'moveLines.*.aml_debit'           => 'required|numeric|min:0',
            'moveLines.*.aml_credit'          => 'required|numeric|min:0',
            'moveLines.*.fk_tax_id'           => 'nullable|integer|exists:account_tax_tax,tax_id',
            'moveLines.*.aml_is_tax_line'     => 'nullable|boolean',
            'moveLines.*.parent_index'        => 'nullable|integer',
        ], [
            'fk_ajl_id.required'             => 'Le journal est obligatoire.',
            'fk_ajl_id.exists'               => 'Le journal sélectionné est introuvable.',
            'amo_date.required'              => 'La date est obligatoire.',
            'amo_date.date'                  => 'La date est invalide.',
            'amo_label.required'             => 'Le libellé est obligatoire.',
            'moveLines.required'             => 'Au moins deux lignes sont requises.',
            'moveLines.min'                  => 'Au moins deux lignes sont requises.',
            'moveLines.*.fk_acc_id.required' => 'Le compte est obligatoire sur chaque ligne.',
            'moveLines.*.fk_acc_id.exists'   => 'Le compte de la ligne :position est introuvable (id: :input).',
            'moveLines.*.fk_tax_id.exists'   => 'La taxe de la ligne :position est introuvable.',
            'moveLines.*.aml_label_entry.required' => 'Le libellé est obligatoire sur chaque ligne.',
            'moveLines.*.aml_debit.required' => 'Le débit est obligatoire sur chaque ligne.',
            'moveLines.*.aml_credit.required'=> 'Le crédit est obligatoire sur chaque ligne.',
        ]);

        try {
            $moveData = [
                'fk_ajl_id'        => $validated['fk_ajl_id'],
                'amo_date'         => $validated['amo_date'],
                'amo_label'        => $validated['amo_label'],
                'amo_ref'          => $validated['amo_ref'] ?? null,
                'fk_usr_id_author' => $request->user()->usr_id,
            ];

            if (isset($validated['amo_valid']) && $validated['amo_valid'] === true) {
                $moveData['amo_valid'] = now();
            }

            // amo_document_type auto-détecté par saveWithValidation depuis les lignes (acc_type)
            $move = AccountMoveModel::saveWithValidation(
                moveData: $moveData,
                linesData: $validated['moveLines'],
                moveId: null
            );

            return response()->json([
                'message' => 'Écriture comptable créée avec succès',
                'data'    => $move,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'message' =>  $e->getMessage(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la création de l\'écriture comptable',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Met à jour une écriture comptable existante
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, $id)
    {
        $move = AccountMoveModel::findOrFail($id);

        $validated = $request->validate([
            'fk_ajl_id'                      => 'sometimes|required|integer|exists:account_journal_ajl,ajl_id',
            'amo_date'                        => 'sometimes|required|date',
            'amo_label'                       => 'sometimes|required|string|max:255',
            'amo_ref'                         => 'nullable|string|max:255',
            'amo_valid'                       => 'nullable|boolean',
            'moveLines'                       => 'sometimes|required|array|min:2',
            'moveLines.*.aml_id'              => 'nullable|integer',
            'moveLines.*.fk_acc_id'           => 'required|integer|exists:account_account_acc,acc_id',
            'moveLines.*.aml_label_entry'     => 'required|string|max:255',
            'moveLines.*.aml_ref'             => 'nullable|string|max:255',
            'moveLines.*.aml_debit'           => 'required|numeric|min:0',
            'moveLines.*.aml_credit'          => 'required|numeric|min:0',
            'moveLines.*.fk_tax_id'           => 'nullable|integer|exists:account_tax_tax,tax_id',
            'moveLines.*.aml_is_tax_line'     => 'nullable|boolean',
            'moveLines.*.parent_index'        => 'nullable|integer',
        ], [
            'fk_ajl_id.required'             => 'Le journal est obligatoire.',
            'fk_ajl_id.exists'               => 'Le journal sélectionné est introuvable.',
            'amo_date.required'              => 'La date est obligatoire.',
            'amo_date.date'                  => 'La date est invalide.',
            'amo_label.required'             => 'Le libellé est obligatoire.',
            'moveLines.required'             => 'Au moins deux lignes sont requises.',
            'moveLines.min'                  => 'Au moins deux lignes sont requises.',
            'moveLines.*.fk_acc_id.required' => 'Le compte est obligatoire sur chaque ligne.',
            'moveLines.*.fk_acc_id.exists'   => 'Le compte de la ligne :position est introuvable (id: :input).',
            'moveLines.*.fk_tax_id.exists'   => 'La taxe de la ligne :position est introuvable.',
            'moveLines.*.aml_label_entry.required' => 'Le libellé est obligatoire sur chaque ligne.',
            'moveLines.*.aml_debit.required' => 'Le débit est obligatoire sur chaque ligne.',
            'moveLines.*.aml_credit.required'=> 'Le crédit est obligatoire sur chaque ligne.',
        ]);

        try {
            $existingMove = AccountMoveModel::findOrFail($id);

            $moveData = [
                'fk_ajl_id'         => $validated['fk_ajl_id'] ?? $existingMove->fk_ajl_id,
                'amo_date'          => $validated['amo_date']  ?? $existingMove->amo_date,
                'amo_label'         => $validated['amo_label'] ?? $existingMove->amo_label,
                'amo_ref'           => $validated['amo_ref']   ?? $existingMove->amo_ref,
                'fk_usr_id_updater' => $request->user()->usr_id,
            ];

            if (isset($validated['amo_valid']) && $validated['amo_valid'] === true) {
                $moveData['amo_valid'] = now();
            }

            // amo_document_type auto-détecté par saveWithValidation depuis les lignes (acc_type)
            $move = AccountMoveModel::saveWithValidation(
                moveData: $moveData,
                linesData: $validated['moveLines'] ?? [],
                moveId: $id
            );

            return response()->json([
                'message' => 'Écriture comptable mise à jour avec succès',
                'data'    => $move,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'message' =>  $e->getMessage(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la mise à jour de l\'écriture comptable',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Supprime une écriture comptable
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy($id)
    {
        $move = AccountMoveModel::findOrFail($id);

        DB::beginTransaction();
        try {
            // Nullifier fk_parent_aml_id avant suppression (contrainte self-référentielle)
            AccountMoveLineModel::where('fk_amo_id', $id)->update(['fk_parent_aml_id' => null]);

            // Supprimer les lignes (cascade FK supprime account_move_line_tag_rel_amr)
            AccountMoveLineModel::where('fk_amo_id', $id)->delete();

            // Supprimer l'écriture — déclenche AccountMoveModel::deleted()
            // qui gère la réévaluation amr_status via handleAccountMoveStatusUpdate()
            $move->delete();

            DB::commit();

            return response()->json([
                'message' => 'Écriture comptable supprimée avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la suppression de l\'écriture comptable',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Duplique une écriture comptable
     *
     * @param int $id
     * @return JsonResponse
     */
    public function duplicate(Request $request, $id)
    {
        $original = AccountMoveModel::with('lines')->findOrFail($id);

        $moveData = [
            'fk_ajl_id'          => $original->fk_ajl_id,
            'amo_date'           => now()->format('Y-m-d'),
            'amo_label'          => $original->amo_label,
            'amo_ref'            => $original->amo_ref,
            'amo_document_type'  => $original->amo_document_type, // préservé et prioritaire
            'fk_usr_id_author'   => $request->user()->usr_id,
            // fk_inv_id / fk_pay_id / fk_exr_id intentionnellement non copiés
        ];

        $linesData = $original->lines->map(fn($line) => [
            'fk_acc_id'       => $line->fk_acc_id,
            'aml_label'       => $line->aml_label,
            'aml_label_entry' => $line->aml_label_entry,
            'aml_ref'         => $line->aml_ref,
            'aml_debit'       => $line->aml_debit,
            'aml_credit'      => $line->aml_credit,
            'fk_tax_id'       => $line->fk_tax_id,
        ])->toArray();

        try {
            $newMove = AccountMoveModel::saveWithValidation($moveData, $linesData);

            return response()->json([
                'message' => 'Écriture comptable dupliquée avec succès',
                'data'    => ['amo_id' => $newMove->amo_id],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la duplication de l\'écriture comptable',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Valide une écriture comptable
     *
     * @param int $id
     * @return JsonResponse
     */
    public function validate($request, $id)
    {
        $move = AccountMoveModel::findOrFail($id);

        // Vérifier si l'écriture est déjà validée
        if ($move->amo_valid) {
            return response()->json([
                'message' => 'Cette écriture est déjà validée'
            ], 400);
        }

        DB::beginTransaction();
        try {
            $move->update([
                'amo_valid' => now(),
                'fk_usr_id_updater' => $request->user()->usr_id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Écriture comptable validée avec succès',
                'data' => $move
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la validation de l\'écriture comptable',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
