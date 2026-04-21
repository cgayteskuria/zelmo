<?php

namespace App\Http\Controllers\Api;

use App\Models\ChargeModel;
use App\Models\DocumentModel;
use App\Services\PaymentService;
use App\Traits\HasGridFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ApiChargeController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'charges';

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

        $query = ChargeModel::from('charge_che as che')
            ->leftJoin('charge_type_cht as cht', 'che.fk_cht_id', '=', 'cht.cht_id')
            ->select([
                'che.che_id as id',
                'che_number',
                'che_date',
                'che_label',
                'cht_label',
                'che_totalttc',
                'che_payment_progress',
                'che_status',
            ]);

        $this->applyGridFilters($query, $request, [
            'che_label'  => 'che.che_label',
            'che_number' => 'che.che_number',
            'cht_label'  => 'cht.cht_label',
            'che_date'   => 'che.che_date',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'          => 'che.che_id',
            'che_number'  => 'che.che_number',
            'che_date'    => 'che.che_date',
            'che_label'   => 'che.che_label',
            'che_totalttc' => 'che.che_totalttc',
            'che_status'  => 'che.che_status',
        ], 'che_date', 'DESC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'che_date'),
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
     * Affiche une charge spécifique
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id)
    {

        $data = ChargeModel::withCount('documents')
            ->with([
                'type:cht_id,cht_label',
                'paymentMode:pam_id,pam_label',
            ])
            ->where('che_id', $id)
            ->firstOrFail();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Crée une nouvelle charge
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'che_date' => 'required|date',
            'che_label' => 'required|string|max:255',
            'fk_cht_id' => 'required|integer|exists:charge_type_cht,cht_id',
            'che_totalttc' => 'required|numeric|min:0',
            'che_note' => 'nullable|string',
            'che_status' => 'nullable|integer|in:0,1,2',
            'fk_pam_id' => 'required|numeric',
        ]);

        // Ajouter les métadonnées utilisateur
        $validated['fk_usr_id_author'] = $request->user()->usr_id;

        DB::beginTransaction();
        try {
            $charge = ChargeModel::create($validated);

            DB::commit();

            return response()->json([
                'message' => 'Charge créée avec succès',
                'data' => $charge
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la création de la charge',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Met à jour une charge existante
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, $id)
    {
        $charge = ChargeModel::findOrFail($id);

        $validated = $request->validate([
            'che_date' => 'sometimes|required|date',
            'che_label' => 'sometimes|required|string|max:255',
            'fk_cht_id' => 'sometimes|required|integer|exists:charge_type_cht,cht_id',
            'che_totalttc' => 'sometimes|required|numeric|min:0',
            'che_note' => 'nullable|string',
            'che_status' => 'nullable|integer|in:0,1,2',
            'fk_pam_id' => 'required|numeric',
        ]);

        // Ajouter les métadonnées utilisateur
        $validated['fk_usr_id_updater'] = $request->user()->usr_id;


        DB::beginTransaction();
        try {
            $charge->update($validated);

            // Recalculer le montant restant si le montant total a été modifié
            if (isset($validated['che_totalttc'])) {
                $charge->updateAmountRemaining();
                $charge->refresh();
            }

            DB::commit();

            return response()->json([
                'message' => 'Charge mise à jour avec succès',
                'data' => $charge
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la mise à jour de la charge',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprime une charge
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy($id)
    {
        $charge = ChargeModel::findOrFail($id);

        DB::beginTransaction();
        try {
            $charge->delete();

            DB::commit();

            return response()->json([
                'message' => 'Charge supprimée avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la suppression de la charge',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Duplique une charge
     *
     * @param int $id
     * @return JsonResponse
     */
    public function duplicate(Request $request, $id)
    {

        $originalCharge = ChargeModel::findOrFail($id);

        DB::beginTransaction();
        try {
            $newCharge = $originalCharge->replicate();
            $newCharge->che_number = null; // Le numéro sera généré automatiquement
            $newCharge->che_status = ChargeModel::STATUS_DRAFT;
            $newCharge->che_payment_progress = 0;
            $newCharge->che_amount_remaining = $newCharge->che_totalttc;
            $newCharge->fk_usr_id_author = $request->user()->usr_id;
            // $newCharge->fk_usr_id_updater = Auth::id();
            $newCharge->save();

            DB::commit();

            return response()->json([
                'message' => 'Charge dupliquée avec succès',
                'data' => $newCharge
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la duplication de la charge',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Récupère la liste des documents attachés
     *
     * @param int $id
     * @return JsonResponse
     */
    public function getDocuments($id)
    {
        try {
            $documents = DocumentModel::where('fk_parent_table', 'charge_che')
                ->where('fk_parent_id', $id)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'data' => $documents
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la récupération des documents',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload des documents
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function uploadDocuments(Request $request, $id)
    {
        $request->validate([
            'files' => 'required|array',
            'files.*' => 'file|max:10240', // 10MB max
        ]);

        $charge = ChargeModel::findOrFail($id);

        DB::beginTransaction();
        try {
            $uploadedDocuments = [];

            foreach ($request->file('files') as $file) {
                $originalName = $file->getClientOriginalName();
                $path = $file->store('charges/' . $id, 'public');

                $document = DocumentModel::create([
                    'fk_parent_table' => 'charge_che',
                    'fk_parent_id' => $id,
                    'doc_filename' => $originalName,
                    'doc_filepath' => $path,
                    'doc_filesize' => $file->getSize(),
                    'doc_mimetype' => $file->getMimeType(),
                    'fk_usr_id_author' => Auth::id(),
                ]);

                $uploadedDocuments[] = $document;
            }

            DB::commit();

            return response()->json([
                'message' => count($uploadedDocuments) . ' document(s) uploadé(s) avec succès',
                'data' => $uploadedDocuments
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de l\'upload des documents',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupère les paiements d'une charge
     *
     * @param int $cheId
     * @return JsonResponse
     */
    public function getPayments($cheId): JsonResponse
    {
        try {
            $data = DB::table('payment_pay as pay')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('payment_mode_pam as pam', 'pay.fk_pam_id', '=', 'pam.pam_id')
                ->leftJoin('bank_details_bts as bts', 'pay.fk_bts_id', '=', 'bts.bts_id')
                ->where('pal.fk_che_id', $cheId)
                ->select([
                    'pay.pay_id',
                    'pay.pay_date',
                    'pay.pay_reference',
                    'pay.pay_number',
                    'pay.pay_status',
                    'pal.pal_amount',
                    DB::raw("'Paiement' AS payment_type"),
                    'pay.pay_number as paynumber',
                    'pam.pam_label as payment_mode',
                    'pay.pay_amount as amount',
                    'bts.bts_label as bank_label'
                ])
                ->orderBy('pay.pay_date', 'DESC')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des paiements: ' . $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Récupère les charges non réglées avec le même fk_cht_id
     *
     * @param int $cheId
     * @param int|null $payId
     * @return JsonResponse
     */
    public function getUnpaidCharges($cheId, $payId = null): JsonResponse
    {
        try {
            $charge = ChargeModel::findOrFail($cheId);
            $chtId = $charge->fk_cht_id;

            $baseQuery = ChargeModel::from('charge_che as che')
                ->leftJoin(
                    DB::raw('(SELECT fk_che_id, SUM(pal_amount) as total_paid
                             FROM payment_allocation_pal
                             GROUP BY fk_che_id) as paid'),
                    'che.che_id',
                    '=',
                    'paid.fk_che_id'
                )
                ->where('che.fk_cht_id', $chtId)
                ->whereIn('che.che_status', [ChargeModel::STATUS_FINALIZED, ChargeModel::STATUS_ACCOUNTED])
                ->select([
                    'che.che_id as id',
                    'che.che_number as number',
                    'che.che_date as date',
                    'che.che_totalttc as totalttc',
                    DB::raw('COALESCE(paid.total_paid, 0) as amount_paid'),
                    DB::raw('che.che_totalttc - COALESCE(paid.total_paid, 0) as amount_remaining')
                ])
                ->havingRaw('amount_remaining > 0');

            if ($payId && $payId !== 'null') {
                // En mode édition, inclure aussi les charges déjà allouées dans ce paiement
                $allocationQuery = ChargeModel::from('charge_che as che')
                    ->join('payment_allocation_pal as pal', 'pal.fk_che_id', '=', 'che.che_id')
                    ->leftJoin(
                        DB::raw('(SELECT fk_che_id, SUM(pal_amount) as total_paid
                         FROM payment_allocation_pal
                         WHERE fk_pay_id != ' . (int)$payId . '
                         GROUP BY fk_che_id) as paid'),
                        'che.che_id',
                        '=',
                        'paid.fk_che_id'
                    )
                    ->where('pal.fk_pay_id', $payId)
                    ->where('che.fk_cht_id', $chtId)
                    ->select([
                        'che.che_id as id',
                        'che.che_number as number',
                        'che.che_date as date',
                        'che.che_totalttc as totalttc',
                        DB::raw('COALESCE(paid.total_paid, 0) as amount_paid'),
                        DB::raw('che.che_totalttc - COALESCE(paid.total_paid, 0) as amount_remaining')
                    ])
                    ->havingRaw('amount_remaining > 0');

                $data = $baseQuery->union($allocationQuery);
            }

            $data = $baseQuery
                ->orderBy('date', 'ASC')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des charges impayées: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les trop versés disponibles pour les charges
     *
     * @param int $cheId
     * @return JsonResponse
     */
    public function getAvailableCredits($cheId): JsonResponse
    {
        try {
            $charge = ChargeModel::findOrFail($cheId);
            $chtId = $charge->fk_cht_id;

            // Récupérer les trop versés (paiements où le montant > montant alloué)
            $creditsQuery = DB::table('payment_pay as pay')
                ->join('payment_allocation_pal as pal_main', 'pay.pay_id', '=', 'pal_main.fk_pay_id')
                ->join('charge_che as che', 'pal_main.fk_che_id', '=', 'che.che_id')
                ->leftJoin('payment_allocation_pal as pal_all', 'pay.pay_id', '=', 'pal_all.fk_pay_id')
                ->where('che.fk_cht_id', $chtId)
                ->where('pay.pay_status', '!=', 0) // Paiements validés
                ->groupBy('pay.pay_id', 'pay.pay_number', 'pay.pay_amount')
                ->select([
                    DB::raw("CONCAT('pay_', pay.pay_id) as id"),
                    DB::raw("CONCAT('Trop versé - Paiement ', pay.pay_number, ' (', ROUND(pay.pay_amount - COALESCE(SUM(pal_all.pal_amount), 0), 2), '€)') as label"),
                    DB::raw('(pay.pay_amount - COALESCE(SUM(pal_all.pal_amount), 0)) as balance')
                ])
                ->havingRaw('balance > 0')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $creditsQuery
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des crédits disponibles: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Utilise un trop versé sur une charge
     *
     * @param Request $request
     * @param int $cheId
     * @return JsonResponse
     */
    public function useCredit(Request $request, $cheId): JsonResponse
    {
        $request->validate([
            'credit_id' => 'required|string',
        ]);

        try {
            $paymentService = new PaymentService();
            $userId = $request->user()->usr_id;

            $result = $paymentService->useCredit($cheId, $request->credit_id, $userId, 'charge');

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function removePaymentAllocation(Request $request, $cheId, $payId): JsonResponse
    {
        try {
            (new PaymentService())->removeAllocation((int)$payId, 'fk_che_id', (int)$cheId);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
