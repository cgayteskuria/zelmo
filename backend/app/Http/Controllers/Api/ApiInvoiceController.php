<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Services\PaymentService;
use App\Services\InvoiceService;
use App\Models\PaymentModel;
use App\Models\PaymentAllocationModel;
use App\Models\DurationsModel;
use App\Models\AccountTaxPositionCorrespondenceModel;
use App\Models\AccountTaxModel;
use App\Models\AccountConfigModel;

use App\Services\Pdf\DocumentPdfService;
use App\Services\EInvoicing\FactureXGeneratorService;
use App\Traits\HasGridFilters;


class ApiInvoiceController extends ApiBizDocumentController
{
    use HasGridFilters;
    /**
     * Implémentation des méthodes abstraites de ApiBizDocumentController
     */

    protected function getDocumentModel(): string
    {
        return InvoiceModel::class;
    }

    protected function getLineModel(): string
    {
        return InvoiceLineModel::class;
    }

    protected function getDocumentPrimaryKey(): string
    {
        return 'inv_id';
    }

    protected function getLinePrimaryKey(): string
    {
        return 'inl_id';
    }

    protected function getLineForeignKey(): string
    {
        return 'fk_inv_id';
    }

    protected function getLinesRelationshipName(): string
    {
        return 'lines';
    }

    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'inv_id',
            'number' => 'inv_number',
            'date' => 'inv_date',
            'status' => 'inv_status',
            // 'beingEdited' => 'inv_being_edited',
            'totalHt' => 'inv_totalht',
            'totalTax' => 'inv_totaltax',
            'totalTtc' => 'inv_totalttc',
            'amountRemaining' => 'inv_amount_remaining',

            // Line fields
            'lineId' => 'inl_id',
            'fk_parent_id' => 'fk_inv_id',
            'lineOrder' => 'inl_order',
            'lineType' => 'inl_type',
            'fk_prt_id' => 'fk_prt_id',
            'fk_tax_id' => 'fk_tax_id',
            'qty' => 'inl_qty',
            'priceUnitHt' => 'inl_priceunitht',
            'purchasePriceUnitHt' => 'inl_purchasepriceunitht',
            'discount' => 'inl_discount',
            'totalHt' => 'inl_mtht',
            'taxRate' => 'inl_tax_rate',
            'prtLib' => 'inl_prtlib',
            'prtDesc' => 'inl_prtdesc',
            'prtType' => 'inl_prttype',
            'isSubscription' => 'inl_is_subscription',
        ];
    }

    /**
     * Surcharge de buildDocumentTotals pour ajouter les infos de paiement
     * spécifiques aux factures
     *
     * @param mixed $document Instance du document
     * @param array $fieldMap Mapping des champs
     * @return object|null Totaux du document avec infos de paiement
     */
    protected function buildDocumentTotals($document, array $fieldMap): ?object
    {
        // Appeler la méthode parente pour les totaux standards
        $totals = parent::buildDocumentTotals($document, $fieldMap);

        if (!$totals || !$document) {
            return $totals;
        }

        // Ajouter les informations de paiement spécifiques aux factures
        $totalTtc = $document->{$fieldMap['totalTtc']} ?? 0;
        $amountRemaining = $document->{$fieldMap['amountRemaining']} ?? 0;

        // Calculer le montant payé : Total TTC - Reste à payer
        $totals->totalPaid = $totalTtc - $amountRemaining;
        $totals->amountRemaining = $amountRemaining;

        return $totals;
    }

    /**
     * Display the specified .
     */
    public function show($id)
    {
        $data = InvoiceModel::withCount('documents')
            ->with([
                'partner:ptr_id,ptr_name',
                'paymentCondition:dur_id,dur_label',
                'paymentMode:pam_id,pam_label',
                'taxPosition:tap_id,tap_label',
                'contact' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("ctc_id, TRIM(CONCAT_WS(' ', ctc_firstname, ctc_lastname)) as label");
                },
                'seller' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                }
            ])
            ->where('inv_id', $id)->firstOrFail();

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }
        return response()->json([
            'status' => true,
            'data' => $data
        ], 200);
    }


    /**
     * Méthodes CRUD overridées pour utiliser InvoiceService
     */

    /**
     * Crée une nouvelle facture via InvoiceService
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $invoiceService = new InvoiceService();
            $userId = $request->user()->usr_id;

            $invoice = $invoiceService->createInvoice(
                $request->all(),
                $userId
            );

            return response()->json([
                'status' => true,
                'message' => 'Facture créée avec succès',
                'data' => ['inv_id' => $invoice->inv_id]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Met à jour une facture via InvoiceService
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $invoice = InvoiceModel::findOrFail($id);
            $invoiceService = new InvoiceService();
            $userId = $request->user()->usr_id;

            $invoice = $invoiceService->updateInvoice(
                $invoice,
                $request->all(),
                $userId
            );

            $invoice->loadMissing('partner:ptr_id,ptr_name');

            return response()->json([
                'status' => true,
                'message' => 'Facture mise à jour avec succès',
                'data' => [
                    'inv_id' => $invoice->inv_id,
                    'inv_number' => $invoice->inv_number,
                    'partner' => $invoice->partner ? ['ptr_name' => $invoice->partner->ptr_name] : null,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Supprime une facture via InvoiceService
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy($id): JsonResponse
    {
        try {
            $invoice = InvoiceModel::findOrFail($id);
            $invoiceService = new InvoiceService();

            $invoiceService->deleteInvoice($invoice);

            return response()->json([
                'status' => true,
                'message' => 'Facture supprimée avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Méthodes spécifiques à Invoice
     */

    /**
     * Affiche la liste des factures selon la requête SQL fournie
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request, string $gridKey = null)
    {
        // --- Gestion des grid settings ---
        // Si pas de sort_by dans la requête → chargement initial → restaurer les settings
        if ($gridKey && !$request->has('sort_by')) {
            $saved = $this->loadGridSettings($gridKey);
            if ($saved) {
                $merge = [];
                if (!empty($saved['sort_by'])) $merge['sort_by'] = $saved['sort_by'];
                if (!empty($saved['sort_order'])) $merge['sort_order'] = $saved['sort_order'];
                if (!empty($saved['filters'])) $merge['filters'] = $saved['filters'];
                if (!empty($saved['page_size'])) $merge['limit'] = $saved['page_size'];
                $request->merge($merge);
            }
        }

        $query = InvoiceModel::from('invoice_inv as inv')
            ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'inv.inv_id as id',
                'inv_number',
                'ptr_name',
                'inv_externalreference',
                'inv_date',
                'inv_duedate',
                'inv_totalht',
                'inv_totalttc',
                'inv_status',
                'inv_payment_progress'
            ]);

        // Filtrer par type si spécifié (customer ou supplier)
        if ($request->has('type')) {
            $type = $request->input('type');
            if ($type === 'customer') {
                $query->whereIn('inv.inv_operation', [
                    InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                    InvoiceModel::OPERATION_CUSTOMER_REFUND,
                    InvoiceModel::OPERATION_CUSTOMER_DEPOSIT
                ]);
            } elseif ($type === 'supplier') {
                $query->whereIn('inv.inv_operation', [
                    InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                    InvoiceModel::OPERATION_SUPPLIER_REFUND,
                    InvoiceModel::OPERATION_SUPPLIER_DEPOSIT
                ]);
            }
        }

        // Map des colonnes autorisées pour le tri et le filtrage
        $columnMap = [
            'id'                    => 'inv.inv_id',
            'inv_number'            => 'inv.inv_id',
            'ptr_name'              => 'ptr.ptr_name',
            'inv_externalreference' => 'inv.inv_externalreference',
            'inv_date'              => 'inv.inv_date',
            'inv_duedate'           => 'inv.inv_duedate',
            'inv_totalht'           => 'inv.inv_totalht',
            'inv_totalttc'          => 'inv.inv_totalttc',
            'inv_status'            => 'inv.inv_status',
            'inv_payment_progress'  => 'inv.inv_payment_progress',
        ];

        // Traitement spécial du filtre inv_payment_progress (catégories : "0", "partial", "100")
        $paymentFilter = $request->input('filters.inv_payment_progress');
        if (is_array($paymentFilter) && !empty($paymentFilter)) {
            $query->where(function ($q) use ($paymentFilter) {
                foreach ($paymentFilter as $cat) {
                    if ($cat === '0' || $cat === 0) {
                        $q->orWhere(function ($sub) {
                            $sub->where('inv.inv_payment_progress', '=', 0)
                                ->orWhereNull('inv.inv_payment_progress');
                        });
                    } elseif ($cat === 'partial') {
                        $q->orWhere(function ($sub) {
                            $sub->where('inv.inv_payment_progress', '>', 0)
                                ->where('inv.inv_payment_progress', '<', 100);
                        });
                    } elseif ($cat === '100' || $cat === 100) {
                        $q->orWhere('inv.inv_payment_progress', '>=', 100);
                    }
                }
            });
            // Retirer du filtre pour éviter le double traitement par le trait
            $filters = $request->input('filters', []);
            unset($filters['inv_payment_progress']);
            $request->merge(['filters' => $filters]);
        }

        // Appliquer les filtres dynamiques (sauf inv_number qui nécessite un LIKE sur inv_number, pas inv_id)
        $filterColumnMap = array_merge($columnMap, ['inv_number' => 'inv.inv_number']);
        $this->applyGridFilters($query, $request, $filterColumnMap);

        // Total après filtres, avant pagination
        $total = $query->count();

        // Tri et pagination
        $this->applyGridSort($query, $request, $columnMap, 'inv_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        // Construire les gridSettings courantes (réintégrer inv_payment_progress qui a été retiré de la request)
        $savedFilters = $request->input('filters', []);
        if (!empty($paymentFilter)) {
            $savedFilters['inv_payment_progress'] = $paymentFilter;
        }
        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'inv_number'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $savedFilters,
            'page_size'  => (int) $request->input('limit', 50),
        ];

        // Sauvegarder les settings si gridKey présent
        if ($gridKey) {
            $this->saveGridSettings($gridKey, $currentSettings);
        }

        return response()->json([
            'data'         => $data,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Affiche la liste des factures client
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexCustomerInvoices(Request $request)
    {
        $request->merge(['type' => 'customer']);
        return $this->index($request, 'customer-invoices');
    }

    /**
     * Affiche la liste des factures fournisseur
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexSupplierInvoices(Request $request)
    {
        $request->merge(['type' => 'supplier']);
        return $this->index($request, 'supplier-invoices');
    }

    /**
     * Les méthodes suivantes sont héritées de ApiBizDocumentController :
     * - show($id) : Affiche une facture
     * - store(Request $request) : Crée une facture
     * - update(Request $request, $id) : Met à jour une facture
     * - destroy($id) : Supprime une facture
     * - getLines($id) : Récupère les lignes de facture
     * - saveLine($invId, Request $request) : Sauvegarde une ligne
     * - deleteLine($invId, $lineId) : Supprime une ligne
     * - updateLinesOrder($invId, Request $request) : Réorganise les lignes
     * - duplicate($id) : Duplique une facture avec toutes ses lignes
     */

    /**
     * Récupère tous les objets liés à une facture
     *
     * @param int $invId
     * @return JsonResponse
     */
    public function getLinkedObjects($invId): JsonResponse
    {
        try {

            $queries = [];

            // Commande client           
            $queries[] = DB::table('invoice_inv as inv')
                ->join('sale_order_ord as ord', 'inv.fk_ord_id', '=', 'ord.ord_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.inv_id', $invId)
                ->selectRaw("
                ord.ord_id as id,
                'saleorders' as object,
                'Commande client' as type,
                ord.ord_number as number,
                ord.ord_date as date,
                ptr.ptr_name,
                ord.ord_totalht as totalht,
                ord.ord_totalttc as totalttc
            ");

            // Commande fournisseur
            $queries[] = DB::table('invoice_inv as inv')
                ->join('purchase_order_por as por', 'inv.fk_por_id', '=', 'por.por_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.inv_id', $invId)
                ->selectRaw("
                por.por_id as id,
                'purchaseorders' as object,
                'Commande fournisseur' as type,
                por.por_number as number,
                por.por_date as date,
                ptr.ptr_name,
                por.por_totalht as totalht,
                por.por_totalttc as totalttc
            ");

            // Contrat client
            $queries[] = DB::table('contract_con as con')
                ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
                ->join('contract_invoice_coi as coi', 'con.con_id', '=', 'coi.fk_con_id')
                ->where('coi.fk_inv_id', $invId)
                ->selectRaw("
                con.con_id as id,
                'customercontracts' as object,
                'Contrat client' as type,
                con.con_number as number,
                con.con_date as date,
                ptr.ptr_name,
                '' as totalht,
                con.con_totalttc as totalttc
            ");

            // Avoir client
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_pay as pay', 'inv.inv_id', '=', 'pay.fk_inv_id_refund')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pal.fk_inv_id', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_CUSTOMER_REFUND)
                ->selectRaw("
                inv.inv_id as id,
                'customerinvoices' as object,
                'Avoir' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Facture liée à un avoir client
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_allocation_pal as pal', 'inv.inv_id', '=', 'pal.fk_inv_id')
                ->join('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pay.fk_inv_id_refund', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_CUSTOMER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'customerinvoices' as object,
                'Facture' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Avoir Frs (première requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_pay as pay', 'inv.inv_id', '=', 'pay.fk_inv_id_refund')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pal.fk_inv_id', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_SUPPLIER_REFUND)
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Avoir' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Avoir Frs (deuxième requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_allocation_pal as pal', 'inv.inv_id', '=', 'pal.fk_inv_id')
                ->join('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pay.fk_inv_id_refund', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_SUPPLIER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Avoir' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Acompte Frs (première requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_pay as pay', 'inv.inv_id', '=', 'pay.fk_inv_id_deposit')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pal.fk_inv_id', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_SUPPLIER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Acompte' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Acompte Frs (deuxième requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_allocation_pal as pal', 'inv.inv_id', '=', 'pal.fk_inv_id')
                ->join('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pay.fk_inv_id_deposit', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_SUPPLIER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Acompte' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Acompte Clt (première requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_pay as pay', 'inv.inv_id', '=', 'pay.fk_inv_id_deposit')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pal.fk_inv_id', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_CUSTOMER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'customerinvoices' as object,
                'Acompte' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Acompte Clt (deuxième requête)
            $queries[] = DB::table('invoice_inv as inv')
                ->join('payment_allocation_pal as pal', 'inv.inv_id', '=', 'pal.fk_inv_id')
                ->join('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('pay.fk_inv_id_deposit', $invId)
                ->where('inv.inv_operation', InvoiceModel::OPERATION_CUSTOMER_INVOICE)
                ->selectRaw("
                inv.inv_id as id,
                'customerinvoices' as object,
                'Acompte' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Avoirs liés via fk_inv_id
            $queries[] = DB::table('invoice_inv as inv')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.fk_inv_id', $invId)
                ->whereIn('inv.inv_operation', [InvoiceModel::OPERATION_CUSTOMER_REFUND, InvoiceModel::OPERATION_SUPPLIER_REFUND])
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Avoir' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Facture parente si la facture actuelle est un avoir
            $queries[] = DB::table('invoice_inv as inv')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.inv_id', $invId)
                ->whereNotNull('inv.fk_inv_id')
                ->whereIn('inv.inv_operation', [InvoiceModel::OPERATION_CUSTOMER_REFUND, InvoiceModel::OPERATION_SUPPLIER_REFUND])
                ->selectRaw("
                inv.inv_id as id,
                'supplierinvoices' as object,
                'Avoir' as type,
                inv.inv_number as number,
                inv.inv_date as date,
                ptr.ptr_name,
                inv.inv_totalht as totalht,
                inv.inv_totalttc as totalttc
            ");

            // Construction finale avec UNION ALL
            $query = array_shift($queries);
            foreach ($queries as $q) {
                $query->unionAll($q);
            }

            $data = DB::query()
                ->fromSub($query, 'linked')
                ->where('id', '<>', $invId)
                ->distinct()
                ->orderBy('type')
                ->orderBy('date')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des objets liés: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Vérifie si un avoir ou acompte est utilisé dans des paiements
     *
     * @param int $id ID de la facture
     * @return JsonResponse
     */
    public function checkUsage($id): JsonResponse
    {
        try {
            $invoice = InvoiceModel::findOrFail($id);
            $invOperation = $invoice->inv_operation;

            $isUsed = false;
            $usedBy = [];

            // Pour les factures d'acompte (5 = custdeposit, 6 = supplierdeposit)
            if ($invOperation == InvoiceModel::OPERATION_CUSTOMER_DEPOSIT || $invOperation == InvoiceModel::OPERATION_SUPPLIER_DEPOSIT) {
                $results = PaymentModel::from('payment_pay as pay')
                    ->leftJoin('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                    ->leftJoin('invoice_inv as inv', 'pal.fk_inv_id', '=', 'inv.inv_id')
                    ->where('pay.fk_inv_id_deposit', $id)
                    ->select('pay.pay_id', 'inv.inv_number')
                    ->get();

                if ($results->isNotEmpty()) {
                    $isUsed = true;
                    $usedBy = $results->pluck('inv_number')->unique()->values()->toArray();
                }
            }

            // Pour les avoirs (2 = custrefund, 4 = supplierrefund)
            if ($invOperation == InvoiceModel::OPERATION_CUSTOMER_REFUND || $invOperation == InvoiceModel::OPERATION_SUPPLIER_REFUND) {
                $results = PaymentModel::from('payment_pay as pay')
                    ->leftJoin('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                    ->leftJoin('invoice_inv as inv', 'pal.fk_inv_id', '=', 'inv.inv_id')
                    ->where('pay.fk_inv_id_refund', $id)
                    ->select('pay.pay_id', 'inv.inv_number')
                    ->get();

                if ($results->isNotEmpty()) {
                    $isUsed = true;
                    $usedBy = $results->pluck('inv_number')->unique()->values()->toArray();
                }

                //Test si l'avoir est auto crée
                /*   $results = PaymentModel::from('payment_pay as pay')
                    ->leftJoin('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                    ->leftJoin('invoice_inv as inv', 'pal.fk_inv_id', '=', 'inv.inv_id')
                    ->where('pay.fk_inv_id_credit_generated', $id)
                    ->select('pay.pay_id', 'inv.inv_number')
                    ->get();

                if ($results->isNotEmpty()) {
                    $isUsed = true;
                    $usedBy = $results->pluck('inv_number')->unique()->values()->toArray();
                }*/
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'isUsed' => $isUsed,
                    'usedBy' => $usedBy,
                    'operation' => $invOperation,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la vérification: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère et retourne le PDF d'une facture
     *
     * @param int $id ID de la facture
     * @return JsonResponse
     */
    public function printPdf($id): JsonResponse
    {
        try {
            $invoice = InvoiceModel::with(['partner', 'lines'])->findOrFail($id);

            if ($invoice->inv_being_edited) {
                return response()->json([
                    'status' => false,
                    'message' => 'Impossible d\'imprimer une facture en cours de modification',
                ], 422);
            }

            $typeMapping = [
                InvoiceModel::OPERATION_CUSTOMER_INVOICE => 'Facture',
                InvoiceModel::OPERATION_CUSTOMER_REFUND  => 'Avoir',
                InvoiceModel::OPERATION_SUPPLIER_INVOICE => 'FactureFrs',
                InvoiceModel::OPERATION_SUPPLIER_REFUND  => 'AvoirFrs',
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT => 'Acompte',
                InvoiceModel::OPERATION_SUPPLIER_DEPOSIT => 'AcompteFrs',
            ];
            $prefix   = $typeMapping[$invoice->inv_operation] ?? 'Facture';
            $fileName = $prefix . '_' . ($invoice->inv_number ?? $id) . '.pdf';

            $isCustomerInvoice = in_array($invoice->inv_operation, [
                InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                InvoiceModel::OPERATION_CUSTOMER_REFUND,
            ]);
            $isFinalized = $invoice->inv_status >= InvoiceModel::STATUS_FINALIZED;

            if ($isCustomerInvoice && $isFinalized) {
                // Facture-X : PDF/A-3 + XML CII embarqué
                $factureXService = app(FactureXGeneratorService::class);
                $pdfBinary       = $factureXService->generateFromInvoice($invoice);
                $pdfBase64       = base64_encode($pdfBinary);
            } else {
                // PDF simple (brouillon, facture fournisseur, acompte…)
                $pdfBase64 = (new DocumentPdfService())->generateInvoicePdf($id);
            }

            return response()->json([
                'success' => true,
                'message' => 'PDF généré avec succès',
                'data' => [
                    'pdf'      => $pdfBase64,
                    'fileName' => $fileName,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération du PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Met à jour les taxes des lignes de facture en fonction de la nouvelle position fiscale.
     * Si fk_tap_id est null, restaure la taxe d'origine depuis le produit.
     * Le taux effectif (inl_tax_rate) est calculé automatiquement via le hook saving de BizDocumentLineModel.
     */
    public function updateLinesTaxPosition(Request $request, $invId): JsonResponse
    {
        $request->validate([
            'fk_tap_id' => 'nullable|integer|exists:account_tax_position_tap,tap_id',
        ]);

        try {
            DB::beginTransaction();

            $tapId  = $request->input('fk_tap_id');
            $userId = $request->user()->usr_id;

            $invoice = InvoiceModel::findOrFail($invId);
            $invoice->fk_tap_id = $tapId;
            $invoice->save();

            $isCustomerOperation = in_array($invoice->inv_operation, [
                InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                InvoiceModel::OPERATION_CUSTOMER_REFUND,
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT,
            ]);

            $lines = InvoiceLineModel::where('fk_inv_id', $invId)
                ->where('inl_type', 0)
                ->with('product')
                ->get();

            $updatedLines = 0;

            foreach ($lines as $line) {
                // Taxe canonique du produit (source de vérité, indépendante de l'historique)
                $product     = $line->product;
                $productTaxId = null;

                if ($product) {
                    $productTaxId = $isCustomerOperation
                        ? $product->fk_tax_id_sale
                        : $product->fk_tax_id_purchase;

                    if (!$productTaxId) {
                        $accountConfig = AccountConfigModel::first();
                        if ($accountConfig) {
                            $productTaxId = $accountConfig->fk_tax_id_product_sale;
                        }
                    }
                }

                if (!$productTaxId) continue;

                if ($tapId === null) {
                    // Cas 1 : pas de position fiscale → taxe produit
                    $newTaxId = $productTaxId;
                } else {
                    // Cas 2 : position fiscale → chercher la correspondance depuis la taxe produit
                    $correspondence = AccountTaxPositionCorrespondenceModel::where('fk_tap_id', $tapId)
                        ->where('fk_tax_id_source', $productTaxId)
                        ->first();

                    if (!$correspondence) continue;

                    $newTaxId = $correspondence->fk_tax_id_target;
                }

                if ($line->fk_tax_id == $newTaxId) continue;

                $line->fk_tax_id         = $newTaxId;
                $line->fk_usr_id_updater = $userId;           
                $line->save();
                $updatedLines++;
            }

            // Recalculer les totaux de la facture
            $invoice->recalculateTotals();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $updatedLines . ' ligne(s) mise(s) à jour',
                'data' => [
                    'updated_lines' => $updatedLines,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour des taxes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère tous les paiements associés à une facture
     *
     * @param int $invId
     * @return JsonResponse
     */
    public function getPayments($invId): JsonResponse
    {
        try {
            $data = DB::table('payment_pay as pay')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('payment_mode_pam as pam', 'pay.fk_pam_id', '=', 'pam.pam_id')
                ->leftJoin('bank_details_bts as bts', 'pay.fk_bts_id', '=', 'bts.bts_id')
                ->leftJoin('invoice_inv as deposit_inv', 'pay.fk_inv_id_deposit', '=', 'deposit_inv.inv_id')
                ->leftJoin('invoice_inv as refund_inv', 'pay.fk_inv_id_refund', '=', 'refund_inv.inv_id')
                ->where('pal.fk_inv_id', $invId)
                ->select([
                    'pay.pay_id',
                    'pay.fk_inv_id_deposit',
                    'pay.fk_inv_id_refund',
                    'pay.pay_date',
                    'pay.pay_reference',
                    'pay.pay_number',
                    'pay.pay_status',
                    'pal.pal_amount',
                    DB::raw("
                        CASE
                            WHEN pay.fk_inv_id_deposit IS NOT NULL THEN 'Acompte'
                            WHEN pay.fk_inv_id_refund IS NOT NULL THEN 'Avoir'
                            ELSE 'Paiement'
                        END AS payment_type
                    "),
                    DB::raw("
                        CASE
                            WHEN pay.fk_inv_id_deposit IS NOT NULL THEN CONCAT(deposit_inv.inv_number, ' (', pay.pay_number ,') ')
                            WHEN pay.fk_inv_id_refund IS NOT NULL THEN  CONCAT(refund_inv.inv_number, ' (', pay.pay_number ,') ')
                            ELSE pay.pay_number
                        END AS paynumber
                    "),
                    DB::raw("
                        CASE
                            WHEN pay.fk_inv_id_deposit IS NOT NULL THEN CONCAT('Acompte n° ', deposit_inv.inv_number)
                            WHEN pay.fk_inv_id_refund IS NOT NULL THEN CONCAT('Avoir n° ', refund_inv.inv_number)
                            ELSE pam.pam_label
                        END AS payment_mode
                    "),
                    DB::raw("
                        CASE
                            WHEN pay.fk_inv_id_deposit IS NOT NULL THEN deposit_inv.inv_totalttc
                            WHEN pay.fk_inv_id_refund IS NOT NULL THEN refund_inv.inv_totalttc
                            ELSE pay.pay_amount
                        END AS amount
                    "),
                    'deposit_inv.inv_number as deposit_number',
                    'refund_inv.inv_number as refund_number',
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
     * Récupère les acomptes et avoirs disponibles pour une facture et un parteners
     *
     * @param int $invId
     * @return JsonResponse
     */
    public function getAvailableCredits($invId): JsonResponse
    {
        try {
            $invoice = InvoiceModel::findOrFail($invId);
            $ptrId = $invoice->fk_ptr_id;

            $invOperation = $invoice->inv_operation;

            // Déterminer le type d'opération pour filtrer les acomptes/avoirs correspondants
            // 1 = facture client, 3 = facture fournisseur
            if ($invOperation == InvoiceModel::OPERATION_CUSTOMER_INVOICE) {
                // Pour facture client: chercher acomptes client (5) et avoirs client (2)
                $depositOperation = InvoiceModel::OPERATION_CUSTOMER_DEPOSIT;
                $refundOperation = InvoiceModel::OPERATION_CUSTOMER_REFUND;
            } elseif ($invOperation == InvoiceModel::OPERATION_SUPPLIER_INVOICE) {
                // Pour facture fournisseur: chercher acomptes fournisseur (6) et avoirs fournisseur (4)
                $depositOperation = InvoiceModel::OPERATION_SUPPLIER_DEPOSIT;
                $refundOperation = InvoiceModel::OPERATION_SUPPLIER_REFUND;
            } else {
                // Pas d'acomptes/avoirs disponibles pour les autres types
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }

            // Query pour les acomptes disponibles (100% payés)
            $depositsQuery = InvoiceModel::from('invoice_inv as inv')
                ->leftJoin('payment_pay as pay', 'pay.fk_inv_id_deposit', '=', 'inv.inv_id')
                ->leftJoin('payment_allocation_pal as pal', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->where('inv.inv_payment_progress', 100)
                ->where('inv.inv_operation', $depositOperation)
                ->where('inv.fk_ptr_id', $ptrId)
                ->groupBy('inv.inv_id', 'inv.inv_number', 'inv.inv_totalttc')
                ->select([
                    DB::raw("CONCAT('inv_',inv.inv_id) as id"),
                    DB::raw("CONCAT('Acompte - ', inv.inv_number, ' (', ROUND(inv.inv_totalttc - COALESCE(SUM(pal.pal_amount), 0), 2), '€)') as label"),
                    DB::raw('(inv.inv_totalttc - COALESCE(SUM(pal.pal_amount), 0)) as balance')
                ])
                ->havingRaw('balance > 0');

            // Query pour les avoirs disponibles
            $refundsQuery = InvoiceModel::from('invoice_inv as inv')
                ->leftJoin('payment_pay as pay', 'pay.fk_inv_id_refund', '=', 'inv.inv_id')
                ->leftJoin('payment_allocation_pal as pal_via_pay', 'pal_via_pay.fk_pay_id', '=', 'pay.pay_id')
                ->leftJoin('payment_allocation_pal as pal_direct', 'pal_direct.fk_inv_id', '=', 'inv.inv_id')
                ->where('inv.inv_operation', $refundOperation)
                ->whereIn('inv.inv_status', [InvoiceModel::STATUS_FINALIZED, InvoiceModel::STATUS_ACCOUNTED])
                ->where('inv.fk_ptr_id', $ptrId)
                ->groupBy('inv.inv_id', 'inv.inv_number', 'inv.inv_totalttc')
                ->select([
                    DB::raw("CONCAT('inv_',inv.inv_id) as id"),
                    DB::raw("CONCAT('Avoir - ', inv.inv_number, ' (', ROUND(inv.inv_totalttc - COALESCE(SUM(pal_via_pay.pal_amount), 0) - COALESCE(SUM(pal_direct.pal_amount), 0), 2), '€)') as label"),
                    DB::raw('(inv.inv_totalttc - COALESCE(SUM(pal_via_pay.pal_amount), 0) - COALESCE(SUM(pal_direct.pal_amount), 0)) as balance')
                ])
                ->havingRaw('balance > 0');

            $payAmountAvailable = PaymentModel::from('payment_pay')
                ->where('fk_ptr_id', $ptrId)
                ->where('pay_amount_available', '>', 0)
                ->select([
                    DB::raw("CONCAT('pay_',pay_id) as id"),
                    DB::raw("CONCAT('Trop versé paiement - ', pay_number ,' (',ROUND(pay_amount_available, 2), '€)')COLLATE utf8mb4_general_ci  as label"),
                    DB::raw('pay_amount_available as balance')
                ]);

            // UNION des deux queries et tri par label
            $data = $depositsQuery
                ->unionAll($refundsQuery)
                ->unionAll($payAmountAvailable)
                ->orderBy('label')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des crédits disponibles: ' . $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Récupère les factures impayées d'un tiers
     *
     * @param Request $request
     * @param int $invId
     * @return JsonResponse
     */
    public function getUnpaidInvoices(Request $request, $invId, $payId): JsonResponse
    {
        try {

            $invoice = InvoiceModel::findOrFail($invId);
            $ptrId = $invoice->fk_ptr_id;
            $invOperation = $invoice->inv_operation;

            // Déterminer les types d'opérations à chercher
            $operations = [];
            if ($invOperation == InvoiceModel::OPERATION_CUSTOMER_INVOICE || $invOperation == InvoiceModel::OPERATION_CUSTOMER_DEPOSIT) {
                $operations = [InvoiceModel::OPERATION_CUSTOMER_INVOICE, InvoiceModel::OPERATION_CUSTOMER_DEPOSIT];
            } elseif ($invOperation ==  InvoiceModel::OPERATION_CUSTOMER_REFUND) {
                $operations = [InvoiceModel::OPERATION_CUSTOMER_REFUND];
            } elseif ($invOperation == InvoiceModel::OPERATION_SUPPLIER_INVOICE  || $invOperation == InvoiceModel::OPERATION_SUPPLIER_DEPOSIT) {
                $operations = [InvoiceModel::OPERATION_SUPPLIER_INVOICE, InvoiceModel::OPERATION_SUPPLIER_DEPOSIT];
            } else {
                $operations = [InvoiceModel::OPERATION_SUPPLIER_REFUND]; // Factures et acomptes fournisseurs
            }

            // En mode édition (payId fourni), exclure le règlement en cours du total payé
            // pour que amount_remaining reflète uniquement les autres règlements.
            $payIdInt   = $payId ? (int) $payId : null;
            $paidSubSql = $payIdInt
                ? "(SELECT fk_inv_id, SUM(pal_amount) as total_paid
                    FROM payment_allocation_pal
                    WHERE fk_pay_id != {$payIdInt}
                    GROUP BY fk_inv_id) as paid"
                : "(SELECT fk_inv_id, SUM(pal_amount) as total_paid
                    FROM payment_allocation_pal
                    GROUP BY fk_inv_id) as paid";

            $baseQuery = InvoiceModel::from('invoice_inv as inv')
                ->leftJoin(DB::raw($paidSubSql), 'inv.inv_id', '=', 'paid.fk_inv_id')
                ->where('inv.fk_ptr_id', $ptrId)
                ->whereIn('inv.inv_operation', $operations)
                ->whereIn('inv.inv_status', [InvoiceModel::STATUS_FINALIZED, InvoiceModel::STATUS_ACCOUNTED])
                ->select([
                    'inv.inv_id as id',
                    'inv.inv_number as number',
                    'inv.inv_date as date',
                    'inv.inv_totalttc as totalttc',
                    DB::raw('COALESCE(paid.total_paid, 0) as amount_paid'),
                    DB::raw('inv.inv_totalttc - COALESCE(paid.total_paid, 0) as amount_remaining')
                ])
                ->havingRaw('amount_remaining > 0');

            if ($payIdInt) {
                // UNION : ajouter les factures allouées au règlement en cours
                // (elles peuvent avoir amount_remaining = 0 si entièrement couvertes par ce règlement)
                $allocationQuery = InvoiceModel::from('invoice_inv as inv')
                    ->join('payment_allocation_pal as pal', 'pal.fk_inv_id', '=', 'inv.inv_id')
                    ->leftJoin(DB::raw($paidSubSql), 'inv.inv_id', '=', 'paid.fk_inv_id')
                    ->where('pal.fk_pay_id', $payIdInt)
                    ->select([
                        'inv.inv_id as id',
                        'inv.inv_number as number',
                        'inv.inv_date as date',
                        'inv.inv_totalttc as totalttc',
                        DB::raw('COALESCE(paid.total_paid, 0) as amount_paid'),
                        DB::raw('inv.inv_totalttc - COALESCE(paid.total_paid, 0) as amount_remaining')
                    ]);

                $baseQuery->union($allocationQuery);
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
                'message' => 'Erreur lors de la récupération des factures impayées: ' . $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Utilise un avoir ou un acompte ou trop ve pour régler une facture
     *
     * @param Request $request
     * @param int $invId - ID de la facture à régler
     * @return JsonResponse
     */
    public function useCredit(Request $request, $invId): JsonResponse
    {
        $request->validate([
            'credit_id' => 'required|string',
        ]);

        try {
            $paymentService = new PaymentService();
            $userId = $request->user()->usr_id;

            $result = $paymentService->useCredit($invId, $request->credit_id, $userId);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }



    /**
     * Calcule la date d'echeance
     *
     * @param int $invId
     * @param Request $request
     * @return JsonResponse
     */
    public function calculateDueDate(Request $request): JsonResponse
    {
        try {
            $durId = $request->input('dur_id');
            $baseDate = $request->input('base_date');

            // Calculer la date d'echeance
            // Utiliser la méthode du modèle DurationsModel pour calculer la date
            $endDate = DurationsModel::calculateNextDate($durId, $baseDate);

            return response()->json([
                'success' => true,
                'data' => [
                    'nextDate' => $endDate,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du calcul de la date de fin d\'engagement: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function removePaymentAllocation(Request $request, $invId, $payId): JsonResponse
    {
        try {
            (new PaymentService())->removeAllocation((int)$payId, 'fk_inv_id', (int)$invId);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Génère un avoir (brouillon) à partir d'une facture avec les lignes sélectionnées.
     *
     * @param int $invId ID de la facture source
     * @param Request $request { lines: [{ line_id, qty, line_type }] }
     * @return JsonResponse
     */
    public function generateRefund(int $invId, Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $userId   = $request->user()->usr_id;
            $selected = $request->input('lines', []);

            if (empty($selected)) {
                return response()->json(['success' => false, 'message' => 'Veuillez sélectionner au moins une ligne'], 400);
            }

            $sourceInvoice = InvoiceModel::with(['lines' => fn($q) => $q->orderBy('inl_order')])
                ->findOrFail($invId);

            if (!in_array($sourceInvoice->inv_status, [InvoiceModel::STATUS_FINALIZED, InvoiceModel::STATUS_ACCOUNTED])) {
                return response()->json(['success' => false, 'message' => 'Seules les factures validées peuvent générer un avoir'], 400);
            }

            // Point 1 : facture totalement réglée
            if ((float) $sourceInvoice->inv_payment_progress >= 100) {
                return response()->json(['success' => false, 'message' => 'La facture est entièrement réglée, impossible de générer un avoir'], 400);
            }

            $refundOperation = $sourceInvoice->inv_operation === InvoiceModel::OPERATION_CUSTOMER_INVOICE
                ? InvoiceModel::OPERATION_CUSTOMER_REFUND
                : InvoiceModel::OPERATION_SUPPLIER_REFUND;

            // Indexer les lignes sélectionnées par ID
            $qtyMap    = array_column($selected, 'qty', 'line_id');
            $typeMap   = array_column($selected, 'line_type', 'line_id');
            $selectedIds = array_column($selected, 'line_id');

            // Calculer les totaux et préparer les lignes à copier
            $totalHt  = 0;
            $totalTax = 0;
            $linesToCopy = [];

            foreach ($sourceInvoice->lines as $line) {
                $isNormal = $line->inl_type === 0;

                if ($isNormal && !in_array($line->inl_id, $selectedIds)) {
                    continue;
                }

                $qty    = $isNormal ? (float) ($qtyMap[$line->inl_id] ?? 0) : 1;
                if ($isNormal && $qty <= 0) continue;

                $lineHt  = $isNormal ? round($line->inl_priceunitht * $qty * (1 - $line->inl_discount / 100), 4) : 0;
                $lineTax = $isNormal ? round($lineHt * $line->inl_tax_rate / 100, 4) : 0;

                $totalHt  += $lineHt;
                $totalTax += $lineTax;

                $linesToCopy[] = ['line' => $line, 'qty' => $qty, 'lineHt' => $lineHt];
            }

            $totalTtc = round($totalHt + $totalTax, 3);
            $amountRemaining = (float) $sourceInvoice->inv_amount_remaining;

            // Point 3 : montant avoir ne peut pas dépasser le restant dû
            if ($totalTtc > $amountRemaining + 0.01) {
                return response()->json([
                    'success' => false,
                    'message' => sprintf(
                        "Le montant de l'avoir (%.2f €) ne peut pas dépasser le montant restant dû (%.2f €)",
                        $totalTtc,
                        $amountRemaining
                    ),
                ], 400);
            }

            // Créer l'avoir en brouillon via InvoiceService
            $invoiceService = new InvoiceService();
            $avoir = $invoiceService->createInvoice([
                'inv_date'                    => now()->format('Y-m-d'),
                'inv_duedate'                 => now()->format('Y-m-d'),
                'inv_operation'               => $refundOperation,
                'fk_ptr_id'                   => $sourceInvoice->fk_ptr_id,
                'fk_ctc_id'                   => $sourceInvoice->fk_ctc_id,
                'fk_pam_id'                   => $sourceInvoice->fk_pam_id,
                'fk_dur_id_payment_condition' => $sourceInvoice->fk_dur_id_payment_condition,
                'fk_tap_id'                   => $sourceInvoice->fk_tap_id,
                'fk_inv_id'                   => $invId,
                'inv_totalht'   => round($totalHt, 3),
                'inv_totaltax'  => round($totalTax, 3),
                'inv_totalttc'  => $totalTtc,
                'inv_status'    => InvoiceModel::STATUS_DRAFT,
            ], $userId);

            // Copier les lignes vers l'avoir
            $order = 1;
            foreach ($linesToCopy as $item) {
                $src = $item['line'];
                $line = new InvoiceLineModel();
                $line->fk_inv_id              = $avoir->inv_id;
                $line->inl_order              = $order++;
                $line->inl_type               = $src->inl_type;
                $line->fk_prt_id              = $src->fk_prt_id;
                $line->fk_tax_id              = $src->fk_tax_id;
                $line->inl_qty                = $item['qty'];
                $line->inl_priceunitht        = $src->inl_priceunitht;
                $line->inl_purchasepriceunitht = $src->inl_purchasepriceunitht;
                $line->inl_discount           = $src->inl_discount;
                $line->inl_mtht               = $item['lineHt'];
                $line->inl_tax_rate           = $src->inl_tax_rate;
                $line->inl_prtlib             = $src->inl_prtlib;
                $line->inl_prtdesc            = $src->inl_prtdesc;
                $line->inl_prttype            = in_array($src->inl_prttype, ['conso', 'service']) ? $src->inl_prttype : null;
                $line->inl_is_subscription    = $src->inl_is_subscription;
                $line->inl_note               = $src->inl_note;
                $line->fk_usr_id_author       = $userId;
                $line->fk_usr_id_updater      = $userId;
                $line->save();
            }

            // Point 2 : créer le paiement par avoir et l'allocation sur la facture source
            $payOperation = $sourceInvoice->inv_operation === InvoiceModel::OPERATION_CUSTOMER_INVOICE
                ? PaymentModel::OPERATION_CUSTOMER_PAYMENT
                : PaymentModel::OPERATION_SUPPLIER_PAYMENT;

            $payAmount = min($totalTtc, $amountRemaining);

            $payment = new PaymentModel();
            $payment->pay_date            = now()->format('Y-m-d');
            $payment->pay_amount          = $payAmount;
            $payment->fk_bts_id           = null;
            $payment->fk_pam_id           = $sourceInvoice->fk_pam_id;
            $payment->pay_reference       = null;
            $payment->pay_status          = PaymentModel::STATUS_DRAFT;
            $payment->pay_operation       = $payOperation;
            $payment->fk_inv_id_refund    = $avoir->inv_id;
            $payment->fk_ptr_id           = $sourceInvoice->fk_ptr_id;
            $payment->fk_usr_id_author    = $userId;
            $payment->save();

            $allocation = new PaymentAllocationModel();
            $allocation->fk_pay_id        = $payment->pay_id;
            $allocation->fk_inv_id        = $invId;
            $allocation->pal_amount       = $payAmount;
            $allocation->fk_usr_id_author = $userId;
            $allocation->save();

            // Mettre à jour les montants restants
            $sourceInvoice->updateAmountRemaining();
            $avoir->updateAmountRemaining();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Avoir généré avec succès',
                'data'    => ['id' => $avoir->inv_id, 'number' => $avoir->inv_number],
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Erreur lors de la génération de l\'avoir : ' . $e->getMessage()], 500);
        }
    }
}
