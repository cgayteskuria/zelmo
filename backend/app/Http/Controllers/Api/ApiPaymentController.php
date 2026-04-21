<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\PaymentModel;
use App\Models\InvoiceModel;
use App\Services\PaymentService;
use App\Traits\HasGridFilters;

class ApiPaymentController extends Controller
{
    use HasGridFilters;

    public function index(Request $request): JsonResponse
    {
        $gridKey = 'payments';

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

        try {
            $query = PaymentModel::from('payment_pay as pay')
                ->leftJoin('payment_mode_pam as pam', 'pay.fk_pam_id', '=', 'pam.pam_id')
                ->leftJoin('bank_details_bts as bts', 'pay.fk_bts_id', '=', 'bts.bts_id')
                ->leftJoin('partner_ptr as ptr', 'pay.fk_ptr_id', '=', 'ptr.ptr_id')
                ->select([
                    'pay.pay_id as id',
                    'pay.pay_number',
                    'pay.pay_date',
                    'ptr.ptr_name',
                    'pam.pam_label',
                    'pay.pay_reference',
                    'pay.pay_amount',
                    'pay.pay_status',
                    'bts.bts_label',
                ]);

            // Filtrer par type d'opération si spécifié (1=client, 2=fournisseur, 3=charge)
            if ($request->has('pay_operation')) {
                $query->where('pay.pay_operation', $request->input('pay_operation'));
            }

            $this->applyGridFilters($query, $request, [
                'pay_number'  => 'pay.pay_number',
                'ptr_name'    => 'ptr.ptr_name',
                'pay_date'    => 'pay.pay_date',
            ]);

            $total = $query->count();

            $this->applyGridSort($query, $request, [
                'id'         => 'pay.pay_id',
                'pay_number' => 'pay.pay_number',
                'pay_date'   => 'pay.pay_date',
                'pay_amount' => 'pay.pay_amount',
                'ptr_name'   => 'ptr.ptr_name',
            ], 'pay_date', 'DESC');

            $this->applyGridPagination($query, $request, 50);

            $currentSettings = [
                'sort_by'    => $request->input('sort_by', 'pay_date'),
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
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des paiements: ' . $e->getMessage(),
            ], 500);
        }
    }



    /**
     * Récupère les données d'un paiement pour édition avec les données des entités parentes
     *
     * @param int $payId - ID du paiement
     * @return JsonResponse
     */
    public function getPayment($payId): JsonResponse
    {
        try {
            // Charger le paiement et ses allocations avec les entités associées
            $payment = PaymentModel::with([
                'bankDetails:bts_id,bts_label',
                'paymentMode:pam_id,pam_label',
                'allocations.invoice.partner',
                'allocations.charge',
                'allocations.expenseReport.user'
            ])->findOrFail($payId);

            // Récupérer les allocations formatées avec les données des entités
            $allocations = $payment->allocations->map(function ($allocation) {
                $invoice = $allocation->invoice;
                $charge = $allocation->charge;
                $expenseReport = $allocation->expenseReport;

                $data = [
                    'pal_id' => $allocation->pal_id,
                    'fk_inv_id' => $allocation->fk_inv_id,
                    'fk_che_id' => $allocation->fk_che_id,
                    'fk_exr_id' => $allocation->fk_exr_id,
                    'amount' => $allocation->pal_amount,
                ];

                // Données de facture
                if ($invoice) {
                    $data['inv_number'] = $invoice->inv_number;
                    $data['inv_date'] = $invoice->inv_date;
                    $data['inv_totalttc'] = $invoice->inv_totalttc;
                    $data['inv_amount_remaining'] = $invoice->inv_amount_remaining;
                    $data['ptr_name'] = $invoice->partner ? $invoice->partner->ptr_name : null;
                }

                // Données de charge
                if ($charge) {
                    $data['che_number'] = $charge->che_number;
                    $data['che_date'] = $charge->che_date;
                    $data['che_totalttc'] = $charge->che_totalttc;
                    $data['che_amount_remaining'] = $charge->che_amount_remaining;
                }

                // Données de note de frais
                if ($expenseReport) {
                    $data['exr_number'] = $expenseReport->exr_number;
                    $data['exr_title'] = $expenseReport->exr_title;
                    $data['exr_approval_date'] = $expenseReport->exr_approval_date;
                    $data['exr_total_amount_ttc'] = $expenseReport->exr_total_amount_ttc;
                    $data['exr_amount_remaining'] = $expenseReport->exr_amount_remaining;
                    $data['employee'] = $expenseReport->user ? trim($expenseReport->user->usr_firstname . ' ' . $expenseReport->user->usr_lastname) : null;
                }

                return $data;
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'pay_id' => $payment->pay_id,
                    'pay_number' => $payment->pay_number,
                    'pay_date' => $payment->pay_date,
                    'pay_amount' => $payment->pay_amount,
                    'fk_bts_id' => $payment->fk_bts_id,
                    'fk_pam_id' => $payment->fk_pam_id,
                    'pay_reference' => $payment->pay_reference,
                    'allocations' => $allocations,
                    'bank' => $payment->bankDetails,
                    'payment_mode' => $payment->paymentMode,
                    'pay_status' => $payment->pay_status,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement du paiement: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Enregistre un nouveau paiement pour une charge
     *
     * @param Request $request   
     * @return JsonResponse
     */
    public function savePayment(Request $request): JsonResponse
    {
        $request->validate([
            'pay_date'                => 'required|date',
            'pay_amount'              => 'required|numeric|min:0.01',
            'fk_bts_id'              => 'required|integer|exists:bank_details_bts,bts_id',
            'fk_pam_id'              => 'required|integer|exists:payment_mode_pam,pam_id',
            'pay_reference'           => 'nullable|string|max:255',
            'allocations'             => 'present|array',
            'allocations.*.fk_che_id' => 'integer|exists:charge_che,che_id',
            'allocations.*.fk_inv_id' => 'integer|exists:invoice_inv,inv_id',
            'allocations.*.amount'    => 'required|numeric|min:0.01',
            'pay_id'                  => 'nullable|integer|exists:payment_pay,pay_id',
            'module'                  => 'required|string',
            'inv_operation'           => 'integer',
            'employeeId'              => 'integer',
        ], [
            'pay_date.required'    => 'La date de paiement est obligatoire.',
            'pay_date.date'        => 'La date de paiement est invalide.',
            'pay_amount.required'  => 'Le montant est obligatoire.',
            'pay_amount.numeric'   => 'Le montant doit être un nombre.',
            'pay_amount.min'       => 'Le montant doit être supérieur à 0.',
            'fk_bts_id.required'   => 'Le compte bancaire est obligatoire.',
            'fk_bts_id.exists'     => 'Le compte bancaire sélectionné est invalide.',
            'fk_pam_id.required'   => 'Le mode de règlement est obligatoire.',
            'fk_pam_id.exists'     => 'Le mode de règlement sélectionné est invalide.',
            'allocations.present'  => 'Le champ allocations est requis.',
            'allocations.array'    => 'Le format des allocations est invalide.',
            'allocations.*.amount.required' => 'Le montant de chaque allocation est obligatoire.',
            'allocations.*.amount.numeric'  => 'Le montant de chaque allocation doit être un nombre.',
            'allocations.*.amount.min'      => 'Le montant de chaque allocation doit être supérieur à 0.',
            'module.required'      => 'Le module est obligatoire.',
        ]);

        try {
            $paymentService = new PaymentService();

            $result = $paymentService->savePayment($request);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Retourne les factures impayées pour un tiers donné
     * Utilisé par le dialogue de saisie de règlement autonome
     *
     * @param Request $request  ptr_id, inv_operation (1=client, 3=fournisseur)
     * @return JsonResponse
     */
    public function getUnpaidInvoicesByPartner(Request $request): JsonResponse
    {
        $request->validate([
            'ptr_id'        => 'required|integer|exists:partner_ptr,ptr_id',
            'inv_operation' => 'required|integer',
        ]);

        $ptrId       = (int) $request->input('ptr_id');
        $invOperation = (int) $request->input('inv_operation');

        // Déterminer les opérations à inclure
        $customerOps = [InvoiceModel::OPERATION_CUSTOMER_INVOICE, InvoiceModel::OPERATION_CUSTOMER_DEPOSIT];
        $supplierOps = [InvoiceModel::OPERATION_SUPPLIER_INVOICE, InvoiceModel::OPERATION_SUPPLIER_DEPOSIT];

        $operations = in_array($invOperation, $customerOps) ? $customerOps : $supplierOps;

        try {
            $rows = InvoiceModel::from('invoice_inv as inv')
                ->leftJoin(
                    DB::raw('(SELECT fk_inv_id, SUM(pal_amount) as total_paid
                              FROM payment_allocation_pal GROUP BY fk_inv_id) as paid'),
                    'inv.inv_id', '=', 'paid.fk_inv_id'
                )
                ->where('inv.fk_ptr_id', $ptrId)
                ->whereIn('inv.inv_operation', $operations)
                ->whereIn('inv.inv_status', [InvoiceModel::STATUS_FINALIZED, InvoiceModel::STATUS_ACCOUNTED])
                ->select([
                    'inv.inv_id as id',
                    'inv.inv_number as number',
                    'inv.inv_date as date',
                    'inv.inv_totalttc as totalttc',
                    DB::raw('COALESCE(paid.total_paid, 0) as amount_paid'),
                    DB::raw('inv.inv_totalttc - COALESCE(paid.total_paid, 0) as amount_remaining'),
                ])
                ->havingRaw('amount_remaining > 0')
                ->orderBy('inv.inv_date', 'ASC')
                ->get();

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crée un règlement autonome (sans document parent obligatoire)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function saveStandalonePayment(Request $request): JsonResponse
    {
        $request->validate([
            'pay_date'      => 'required|date',
            'pay_amount'    => 'required|numeric|min:0.01',
            'fk_bts_id'     => 'required|integer|exists:bank_details_bts,bts_id',
            'fk_pam_id'     => 'required|integer|exists:payment_mode_pam,pam_id',
            'pay_reference' => 'nullable|string|max:255',
            'fk_ptr_id'     => 'required|integer|exists:partner_ptr,ptr_id',
            'inv_operation' => 'required|integer',
            'allocations'   => 'present|array',
            'allocations.*.fk_inv_id' => 'integer|exists:invoice_inv,inv_id',
            'allocations.*.amount'    => 'required|numeric|min:0.01',
        ], [
            'pay_date.required'    => 'La date de paiement est obligatoire.',
            'pay_date.date'        => 'La date de paiement est invalide.',
            'pay_amount.required'  => 'Le montant est obligatoire.',
            'pay_amount.numeric'   => 'Le montant doit être un nombre.',
            'pay_amount.min'       => 'Le montant doit être supérieur à 0.',
            'fk_bts_id.required'   => 'Le compte bancaire est obligatoire.',
            'fk_bts_id.exists'     => 'Le compte bancaire sélectionné est invalide.',
            'fk_pam_id.required'   => 'Le mode de règlement est obligatoire.',
            'fk_pam_id.exists'     => 'Le mode de règlement sélectionné est invalide.',
            'fk_ptr_id.required'   => 'Le tiers est obligatoire.',
            'fk_ptr_id.exists'     => 'Le tiers sélectionné est invalide.',
            'inv_operation.required' => 'Le type d\'opération est obligatoire.',
            'allocations.present'  => 'Le champ allocations est requis.',
            'allocations.array'    => 'Le format des allocations est invalide.',
            'allocations.*.amount.required' => 'Le montant de chaque allocation est obligatoire.',
            'allocations.*.amount.numeric'  => 'Le montant de chaque allocation doit être un nombre.',
            'allocations.*.amount.min'      => 'Le montant de chaque allocation doit être supérieur à 0.',
            'allocations.*.fk_inv_id.exists' => 'Une des factures sélectionnées est invalide.',
        ]);

        // Injecter les champs attendus par PaymentService::savePayment
        $request->merge([
            'module' => 'invoice',
        ]);

        try {
            $paymentService = new PaymentService();
            $result = $paymentService->savePayment($request);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Supprime un paiement
     *
     * @param int $payId
     * @return JsonResponse
     */
    public function deletePayment($payId): JsonResponse
    {
        try {
            $paymentService = new PaymentService();
            $result = $paymentService->deletePayment($payId, 'invoice');

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage(),
            ], 500);
        }
    }
}
