<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

use App\Http\Requests\StoreSaleOrderRequest;
use App\Http\Resources\SaleOrderResource;
use App\Services\SaleOrderService;
use App\Services\InvoiceService;
use App\Services\ContractService;
use App\Services\Pdf\DocumentPdfService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Models\SaleOrderModel;
use App\Models\SaleOrderLineModel;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\ContractModel;
use App\Models\ContractLineModel;
use App\Models\DurationsModel;
use App\Models\DeliveryNoteModel;
use App\Traits\HasGridFilters;


class ApiSaleOrderController extends ApiBizDocumentController
{
    use HasGridFilters;
    /**
     * Implémentation des méthodes abstraites de BaseDocumentController
     */

    protected function getDocumentModel(): string
    {
        return SaleOrderModel::class;
    }

    protected function getLineModel(): string
    {
        return SaleOrderLineModel::class;
    }

    protected function getDocumentPrimaryKey(): string
    {
        return 'ord_id';
    }

    protected function getLinePrimaryKey(): string
    {
        return 'orl_id';
    }

    protected function getLineForeignKey(): string
    {
        return 'fk_ord_id';
    }

    protected function getLinesRelationshipName(): string
    {
        return 'lines';
    }

    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'ord_id',
            'number' => 'ord_number',
            'date' => 'ord_date',
            'status' => 'ord_status',
            'beingEdited' => 'ord_being_edited',
            'totalHt' => 'ord_totalht',
            'totalHtSub' => 'ord_totalhtsub',
            'totalHtComm' => 'ord_totalhtcomm',
            'totalTax' => 'ord_totaltax',
            'totalTtc' => 'ord_totalttc',
            'invoicingState' => 'ord_invoicing_state',
            'deliveryState' => 'ord_delivery_state',

            // Line fields
            'lineId' => 'orl_id',
            'fk_parent_id' => 'fk_ord_id',
            'lineOrder' => 'orl_order',
            'lineType' => 'orl_type',
            'fk_prt_id' => 'fk_prt_id',
            'fk_tax_id' => 'fk_tax_id',
            'qty' => 'orl_qty',
            'priceUnitHt' => 'orl_priceunitht',
            'purchasePriceUnitHt' => 'orl_purchasepriceunitht',
            'discount' => 'orl_discount',
            'totalHt' => 'orl_mtht',
            'taxRate' => 'orl_tax_rate',
            'prtLib' => 'orl_prtlib',
            'prtDesc' => 'orl_prtdesc',
            'prtType' => 'orl_prttype',
            'isSubscription' => 'orl_is_subscription',
        ];
    }

    /**
     * Méthodes spécifiques à SaleOrder
     * (Les méthodes getLines, saveLine, deleteLine, updateLinesOrder, duplicate
     * sont héritées de BaseDocumentController)
     */

    /**
     * Affiche la liste des commandes/devis
     *
     * @param Request $request
     * @return JsonResponse
     */
    /**
     * Map des colonnes autorisées pour le tri et le filtrage des commandes/devis.
     */
    /**
     * Map pour le TRI des colonnes (ord_number → ord_id pour un tri naturel).
     */
    private function getSaleOrderSortColumnMap(): array
    {
        return [
            'id'                  => 'ord.ord_id',
            'ord_number'          => 'ord.ord_id',
            'ord_date'            => 'ord.ord_date',
            'ptr_name'            => 'ptr.ptr_name',
            'ord_refclient'       => 'ord.ord_refclient',
            'ord_status'          => 'ord.ord_status',
            'ord_invoicing_state' => 'ord.ord_invoicing_state',
            'ord_delivery_state'  => 'ord.ord_delivery_state',
            'ord_totalht'         => 'ord.ord_totalht',
            'ord_totalttc'        => 'ord.ord_totalttc',
        ];
    }

    /**
     * Map pour le FILTRAGE des colonnes (ord_number → ord_number pour LIKE).
     */
    private function getSaleOrderFilterColumnMap(): array
    {
        return [
            'id'                  => 'ord.ord_id',
            'ord_number'          => 'ord.ord_number',
            'ord_date'            => 'ord.ord_date',
            'ptr_name'            => 'ptr.ptr_name',
            'ord_refclient'       => 'ord.ord_refclient',
            'ord_status'          => 'ord.ord_status',
            'ord_invoicing_state' => 'ord.ord_invoicing_state',
            'ord_delivery_state'  => 'ord.ord_delivery_state',
            'ord_totalht'         => 'ord.ord_totalht',
            'ord_totalttc'        => 'ord.ord_totalttc',
        ];
    }

    public function index(Request $request)
    {
        $query = SaleOrderModel::from('sale_order_ord as ord')
            ->leftJoin('partner_ptr as ptr', 'ord.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'ord.ord_id as id',
                'ord_number',
                'ord_date',
                'ptr_name',
                'ord_refclient',
                'ord_totalht',
                'ord_totalttc',
                'ord_status',
                'ord_invoicing_state',
                'ord_delivery_state',
                'ord_note'
            ]);

        $this->applyGridFilters($query, $request, $this->getSaleOrderFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getSaleOrderSortColumnMap(), 'ord_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        return response()->json([
            'data'  => $data,
            'total' => $total,
        ]);
    }

    /**
     * Affiche la liste des devis (ord_status < 3 ou null)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexQuotations(Request $request)
    {
        $gridKey = 'sale-quotations';

        // Chargement initial → restaurer les settings sauvegardés
        if (!$request->has('sort_by')) {
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

        $query = SaleOrderModel::from('sale_order_ord as ord')
            ->leftJoin('partner_ptr as ptr', 'ord.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'ord.ord_id as id',
                'ord_number',
                'ord_date',
                'ptr_name',
                'ord_refclient',
                'ord_totalht',
                'ord_totalttc',
                'ord_status',
                'ord_invoicing_state',
                'ord_delivery_state',
                'ord_note'
            ])
            ->where(function ($q) {
                $q->where('ord.ord_status', '<', SaleOrderModel::STATUS_IN_PROGRESS)
                    ->orWhereNull('ord.ord_status');
            });

        $this->applyGridFilters($query, $request, $this->getSaleOrderFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getSaleOrderSortColumnMap(), 'ord_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ord_number'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];
        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $data,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Affiche la liste des commandes (ord_status >= 3)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexOrders(Request $request)
    {
        $gridKey = 'sale-orders';

        // Chargement initial → restaurer les settings sauvegardés
        if (!$request->has('sort_by')) {
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

        $query = SaleOrderModel::from('sale_order_ord as ord')
            ->leftJoin('partner_ptr as ptr', 'ord.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'ord.ord_id as id',
                'ord_number',
                'ord_date',
                'ptr_name',
                'ord_refclient',
                'ord_totalht',
                'ord_totalttc',
                'ord_status',
                'ord_invoicing_state',
                'ord_delivery_state',
                'ord_note'
            ])
            ->where('ord.ord_status', '>=', SaleOrderModel::STATUS_IN_PROGRESS);

        $this->applyGridFilters($query, $request, $this->getSaleOrderFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getSaleOrderSortColumnMap(), 'ord_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ord_number'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];
        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $data,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Display the specified .
     */
    public function show($id)
    {
        $data = SaleOrderModel::withCount('documents')
            ->with([
                'partner:ptr_id,ptr_name',
                'paymentCondition:dur_id,dur_label',
                'paymentMode:pam_id,pam_label',
                'taxPosition:tap_id,tap_label',
                'commitmentDuration:dur_id,dur_label',
                'warehouse:whs_id,whs_label',
                'contact' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("ctc_id, TRIM(CONCAT_WS(' ', ctc_firstname, ctc_lastname, ctc_email)) as label");
                },
                'seller' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                }
            ])
            ->where('ord_id', $id)->firstOrFail();

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        // Vérifier si un BL livré existe pour cette commande
        $hasDeliveredNote = DB::table('delivery_note_dln')
            ->where('fk_ord_id', $id)
            ->where('dln_status', DeliveryNoteModel::STATUS_VALIDATED) // STATUS_VALIDATED = livré
            ->where('dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY) // OPERATION_CUSTOMER_DELIVERY
            ->exists();

        $responseData = $data->toArray();
        $responseData['is_locked_by_delivery'] = $hasDeliveredNote;

        return response()->json([
            'status' => true,
            'data' => $responseData
        ], 200);
    }

    /**
     * Les méthodes suivantes sont héritées de BaseDocumentController :
     * - getLines($id) : Récupère les lignes de commande
     * - saveLine($orderId, Request $request) : Sauvegarde une ligne
     * - deleteLine($orderId, $lineId) : Supprime une ligne
     * - updateLinesOrder($orderId, Request $request) : Réorganise les lignes
     * - duplicate($id) : Duplique une commande avec toutes ses lignes
     */

    /**
     * Surcharge de buildLineSelectFields pour ajouter les quantités facturées et livrées
     *
     * @param array $fieldMap Mapping des champs
     * @return array Liste des champs à sélectionner
     */
    protected function buildLineSelectFields(array $fieldMap): array
    {
        // Récupérer les champs de base de la classe parente
        $selectFields = parent::buildLineSelectFields($fieldMap);

        // Ajouter la quantité facturée via une sous-requête
        $selectFields[] = DB::raw('(SELECT COALESCE(SUM(inl.inl_qty), 0)
            FROM invoice_line_inl AS inl
            INNER JOIN invoice_inv AS inv ON inl.fk_inv_id = inv.inv_id
            WHERE inl.fk_orl_id = line.' . $fieldMap['lineId'] . '
            AND inv.inv_status IN (' . InvoiceModel::STATUS_DRAFT . ', ' . InvoiceModel::STATUS_FINALIZED . ')
        ) AS qtyInvoiced');

        // Ajouter la quantité livrée via une sous-requête
        $selectFields[] = DB::raw('(SELECT COALESCE(SUM(dnl.dnl_qty), 0)
            FROM delivery_note_line_dnl AS dnl
            INNER JOIN delivery_note_dln AS dln ON dnl.fk_dln_id = dln.dln_id
            WHERE dnl.fk_orl_id = line.' . $fieldMap['lineId'] . '
            AND dln.dln_status = ' . DeliveryNoteModel::STATUS_DRAFT . '
        ) AS qtyDelivered');

        return $selectFields;
    }

    /**
     * Récupère tous les objets liés à une commande
     * (Commandes fournisseur, bons de livraison, factures, contrats)
     *
     * @param int $orderId
     * @return JsonResponse
     */
    public function getLinkedObjects($orderId): JsonResponse
    {
        try {
            // Commandes fournisseur
            $purchaseOrders = DB::table('purchase_order_por')
                ->leftJoin('partner_ptr', 'purchase_order_por.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_ord_id', $orderId)
                ->select(
                    'por_id as id',
                    DB::raw("'purchaseorder' as object"),
                    DB::raw("'Commande fournisseur' as type"),
                    'por_number as number',
                    'por_date as date',
                    'ptr_name',
                    'por_totalht as totalht'
                )
                ->get();

            // Bons de livraison
            $deliveryNotes = DB::table('delivery_note_dln')
                ->leftJoin('partner_ptr', 'delivery_note_dln.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_ord_id', $orderId)
                ->where('dln_operation', 1)
                ->select(
                    'dln_id as id',
                    DB::raw("'custdeliverynote' as object"),
                    DB::raw("'Bon de livraison' as type"),
                    'dln_number as number',
                    'dln_date as date',
                    'ptr_name',
                    DB::raw("NULL as totalht")
                )
                ->get();

            // Factures client
            $invoices = DB::table('invoice_inv')
                ->leftJoin('partner_ptr', 'invoice_inv.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_ord_id', $orderId)
                ->where('inv_operation', 1)
                ->select(
                    'inv_id as id',
                    DB::raw("'customerinvoices' as object"),
                    DB::raw("'Facture client' as type"),
                    'inv_number as number',
                    'inv_date as date',
                    'ptr_name',
                    'inv_totalht as totalht'
                )
                ->get();

            // Contrats client
            $contracts = DB::table('contract_con')
                ->leftJoin('partner_ptr', 'contract_con.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_ord_id', $orderId)
                ->select(
                    'con_id as id',
                    DB::raw("'customercontracts' as object"),
                    DB::raw("'Contrat client' as type"),
                    'con_number as number',
                    'con_date as date',
                    'ptr_name',
                    DB::raw("'' as totalht")
                )
                ->get();

            // Bons de réception (via commandes fournisseur liées)
            $receptionNotes = DB::table('delivery_note_dln')
                ->leftJoin('partner_ptr', 'delivery_note_dln.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->leftJoin('purchase_order_por', 'delivery_note_dln.fk_por_id', '=', 'purchase_order_por.por_id')
                ->where('purchase_order_por.fk_ord_id', $orderId)
                ->where('dln_operation', 2)
                ->select(
                    'dln_id as id',
                    DB::raw("'suppreceptionnote' as object"),
                    DB::raw("'Bon de réception' as type"),
                    'dln_number as number',
                    'dln_date as date',
                    'ptr_name',
                    DB::raw("NULL as totalht")
                )
                ->get();

            // Fusionner tous les résultats
            $linkedObjects = collect()
                ->concat($purchaseOrders)
                ->concat($deliveryNotes)
                ->concat($receptionNotes)
                ->concat($invoices)
                ->concat($contracts)
                ->sortBy([
                    ['type', 'asc'],
                    ['date', 'asc']
                ])
                ->values();

            return response()->json([
                'success' => true,
                'data' => $linkedObjects,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des objets liés: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère et retourne le PDF d'une commande/devis
     *
     * @param int $id ID de la commande
     * @return JsonResponse
     */
    public function printPdf($id): JsonResponse
    {
        try {

            $pdfService = new DocumentPdfService();
            $pdfBase64 = $pdfService->generateSaleOrderPdf($id);

            // Récupérer les infos de base pour le nom du fichier
            $saleOrder = SaleOrderModel::findOrFail($id);
            $fileName = ($saleOrder->ord_status <= 2 ? 'Devis_' : 'Commande_') . $saleOrder->ord_number . '.pdf';

            return response()->json([
                'success' => true,
                'data' => [
                    'pdf' => $pdfBase64,
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
     * Génère une facture à partir d'une commande avec les lignes sélectionnées
     *
     * @param int $orderId ID de la commande
     * @param Request $request
     * @return JsonResponse
     */
    public function generateInvoiceAndContract($orderId, Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Récupérer les lignes sélectionnées avec leurs quantités
            $selectedLinesData = $request->input('lines', []);

            if (empty($selectedLinesData)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Veuillez sélectionner au moins une ligne',
                ], 400);
            }

            // Charger la commande avec toutes ses lignes (pour analyser le contexte des titres)
            $saleOrder = SaleOrderModel::with(['lines' => function ($query) {
                $query->orderBy('orl_order');
            }])->findOrFail($orderId);

            // Vérifier que la commande est confirmée
            if ($saleOrder->ord_status != SaleOrderModel::STATUS_IN_PROGRESS) {
                return response()->json([
                    'success' => false,
                    'message' => 'Seules les commandes confirmées peuvent être facturées',
                ], 400);
            }

            // Récupérer les quantités déjà facturées pour chaque ligne
            $invoicedQuantities = InvoiceLineModel::join('invoice_inv', 'invoice_line_inl.fk_inv_id', '=', 'invoice_inv.inv_id')
                ->where('invoice_inv.fk_ord_id', $orderId)
                ->whereIn('invoice_inv.inv_status', [InvoiceModel::STATUS_DRAFT, InvoiceModel::STATUS_FINALIZED])
                ->select('fk_orl_id', DB::raw('SUM(inl_qty) as total_invoiced'))
                ->groupBy('fk_orl_id')
                ->pluck('total_invoiced', 'fk_orl_id');

            // Extraire les IDs des lignes sélectionnées
            $selectedLineIds = array_column($selectedLinesData, 'line_id');
            $selectedQtyMap = [];
            foreach ($selectedLinesData as $lineData) {
                $selectedQtyMap[$lineData['line_id']] = $lineData['qty'];
            }

            // Récupérer toutes les lignes de la commande ordonnées
            $allLines = $saleOrder->lines;

            // Séparer les lignes en deux collections: facture et contrat
            $invoiceLines = [];
            $contractLines = [];

            foreach ($allLines as $line) {
                // Ignorer les lignes normales non sélectionnées
                if (!in_array($line->orl_id, $selectedLineIds) && $line->orl_type == 0) {
                    continue;
                }

                if ($line->orl_type == 0) {
                    // Ligne normale: valider et affecter selon is_subscription
                    $qtyToProcess = $selectedQtyMap[$line->orl_id] ?? 0;

                    // Calculer la quantité déjà facturée
                    $alreadyInvoiced = $invoicedQuantities[$line->orl_id] ?? 0;
                    $remainingQty = $line->orl_qty - $alreadyInvoiced;

                    // Valider les quantités
                    if ($qtyToProcess > $remainingQty) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "La quantité ({$qtyToProcess}) pour '{$line->orl_prtlib}' dépasse la quantité restante ({$remainingQty})",
                        ], 400);
                    }

                    if ($qtyToProcess <= 0) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "La quantité doit être supérieure à 0 pour '{$line->orl_prtlib}'",
                        ], 400);
                    }

                    // Calculer le montant HT pour cette quantité
                    $lineHt = $line->orl_priceunitht * $qtyToProcess * (1 - $line->orl_discount / 100);

                    $lineData = [
                        'orderLine' => $line,
                        'qty' => $qtyToProcess,
                        'lineHt' => $lineHt,
                    ];

                    // Affecter selon is_subscription
                    if ($line->orl_is_subscription) {
                        $contractLines[] = $lineData;
                    } else {
                        $invoiceLines[] = $lineData;
                    }
                } else {
                    // Titre (type 1) ou sous-total (type 2)
                    $titleData = [
                        'orderLine' => $line,
                        'qty' => 1,
                        'lineHt' => 0,
                    ];

                    $hasSubscription = false;
                    $hasNormal = false;

                    if ($line->orl_type == 1) {
                        // TITRE (SEPARATOR) : analyser les lignes qui SUIVENT
                        $nextLines = $this->getNextNormalLines($allLines, $line->orl_order, $selectedLineIds);

                        foreach ($nextLines as $nextLine) {
                            if ($nextLine->orl_is_subscription) {
                                $hasSubscription = true;
                            } else {
                                $hasNormal = true;
                            }
                        }
                    } else if ($line->orl_type == 2) {
                        // SOUS-TOTAL (SUBTOTAL) : analyser les lignes qui PRÉCÈDENT depuis le dernier titre
                        $prevLines = $this->getPreviousNormalLinesSinceLastSeparator($allLines, $line->orl_order, $selectedLineIds);

                        foreach ($prevLines as $prevLine) {
                            if ($prevLine->orl_is_subscription) {
                                $hasSubscription = true;
                            } else {
                                $hasNormal = true;
                            }
                        }
                    }

                    // Affecter le titre/sous-total selon le contexte
                    if ($hasSubscription && !$hasNormal) {
                        // Toutes les lignes concernées sont des abonnements
                        $contractLines[] = $titleData;
                    } else if ($hasNormal && !$hasSubscription) {
                        // Toutes les lignes concernées sont normales
                        $invoiceLines[] = $titleData;
                    } else if ($hasSubscription && $hasNormal) {
                        // Mélange: dupliquer le titre/sous-total dans les deux documents
                        $invoiceLines[] = $titleData;
                        $contractLines[] = $titleData;
                    }
                    // Sinon: aucune ligne concernée, on ignore le titre/sous-total
                }
            }

            // Variables pour stocker les documents créés
            $invoice = null;
            $contract = null;
            $userId = (int) $request->user()->usr_id;

            // === CRÉATION DE LA FACTURE (lignes sans abonnement) ===
            if (!empty($invoiceLines)) {
                // Calculer les totaux pour la facture (uniquement lignes normales)
                $invoiceTotalHt = 0;
                $invoiceTotalTax = 0;
                foreach ($invoiceLines as $lineData) {
                    if ($lineData['orderLine']->orl_type == 0) {
                        $invoiceTotalHt += $lineData['lineHt'];
                        $invoiceTotalTax += $lineData['lineHt'] * $lineData['orderLine']->orl_tax_rate / 100;
                    }
                }
                $invoiceTotalTtc = $invoiceTotalHt + $invoiceTotalTax;

                // Calculer la date d'échéance
                $dueDate = $saleOrder->ord_date;
                if ($saleOrder->fk_dur_id_payment_condition) {
                    $dueDate = DurationsModel::calculateNextDate($saleOrder->fk_dur_id_payment_condition, $saleOrder->ord_date);
                }

                // Créer la facture via InvoiceService
                $invoiceService = new InvoiceService();
                $invoice = $invoiceService->createInvoice([
                    'inv_date' => $saleOrder->ord_date,
                    'inv_duedate' => $dueDate,
                    'inv_operation' => InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                    'fk_ptr_id' => $saleOrder->fk_ptr_id,
                    'inv_ptr_address' => $saleOrder->ord_ptr_address,
                    'fk_ctc_id' => $saleOrder->fk_ctc_id,
                    'fk_pam_id' => $saleOrder->fk_pam_id,
                    'fk_dur_id_payment_condition' => $saleOrder->fk_dur_id_payment_condition,
                    'fk_tap_id' => $saleOrder->fk_tap_id,
                    'inv_note' => $saleOrder->ord_note,
                    'inv_externalreference' => $saleOrder->ord_number . " " . $saleOrder->ord_refclient,
                    'inv_totalht' => $invoiceTotalHt,
                    'inv_totaltax' => $invoiceTotalTax,
                    'inv_totalttc' => $invoiceTotalTtc,
                    'fk_ord_id' => $saleOrder->ord_id,
                    'inv_status' => InvoiceModel::STATUS_DRAFT,
                ], $userId);

                // Copier les lignes vers la facture
                $lineOrder = 1;
                foreach ($invoiceLines as $lineData) {
                    $orderLine = $lineData['orderLine'];
                    $invoiceLine = new InvoiceLineModel();
                    $invoiceLine->fk_inv_id = $invoice->inv_id;

                    // Ne pas définir fk_orl_id pour les titres/sous-totaux
                    if ($orderLine->orl_type == 0) {
                        $invoiceLine->fk_orl_id = $orderLine->orl_id;
                        $invoiceLine->inl_qty = $lineData['qty'];
                        $invoiceLine->inl_mtht = $lineData['lineHt'];
                    } else {
                        $invoiceLine->inl_qty = 1;
                        $invoiceLine->inl_mtht = 0;
                    }

                    $invoiceLine->inl_order = $lineOrder++;
                    $invoiceLine->inl_type = $orderLine->orl_type;
                    $invoiceLine->fk_prt_id = $orderLine->fk_prt_id;
                    $invoiceLine->fk_tax_id = $orderLine->fk_tax_id;
                    $invoiceLine->inl_priceunitht = $orderLine->orl_priceunitht;
                    $invoiceLine->inl_purchasepriceunitht = $orderLine->orl_purchasepriceunitht;
                    $invoiceLine->inl_discount = $orderLine->orl_discount;
                    $invoiceLine->inl_tax_rate = $orderLine->orl_tax_rate;
                    $invoiceLine->inl_prtlib = $orderLine->orl_prtlib;
                    $invoiceLine->inl_prtdesc = $orderLine->orl_prtdesc;
                    $invoiceLine->inl_prttype = $orderLine->orl_prttype;
                    $invoiceLine->inl_note = $orderLine->orl_note;
                    $invoiceLine->fk_usr_id_author = $userId;
                    $invoiceLine->fk_usr_id_updater = $userId;
                    $invoiceLine->save();
                }
            }

            // === CRÉATION DU CONTRAT (lignes avec abonnement) ===
            if (!empty($contractLines)) {
                // Calculer les totaux pour le contrat (uniquement lignes normales)
                $contractTotalHt = 0;
                $contractTotalTax = 0;
                foreach ($contractLines as $lineData) {
                    if ($lineData['orderLine']->orl_type == 0) {
                        $contractTotalHt += $lineData['lineHt'];
                        $contractTotalTax += $lineData['lineHt'] * $lineData['orderLine']->orl_tax_rate / 100;
                    }
                }
                $contractTotalTtc = $contractTotalHt + $contractTotalTax;

                // Créer le contrat via ContractService
                $contractService = new ContractService();
                $contract = $contractService->createContract([
                    'con_date' => $saleOrder->ord_date,
                    'con_operation' => ContractModel::OPERATION_CUSTOMER_CONTRACT,
                    'con_label' => $saleOrder->ord_number,
                    'fk_ptr_id' => $saleOrder->fk_ptr_id,
                    'fk_ctc_id' => $saleOrder->fk_ctc_id,
                    'fk_pam_id' => $saleOrder->fk_pam_id,
                    'fk_dur_id_payment_condition' => $saleOrder->fk_dur_id_payment_condition,
                    'fk_dur_id_commitment' => $saleOrder->fk_dur_id_commitment ?? null,
                    'fk_dur_id_renew' => $saleOrder->fk_dur_id_renew ?? null,
                    'fk_dur_id_notice' => $saleOrder->fk_dur_id_notice ?? null,
                    'fk_dur_id_invoicing' => $saleOrder->fk_dur_id_invoicing ?? null,
                    'fk_tap_id' => $saleOrder->fk_tap_id,
                    'con_note' => $saleOrder->ord_note,
                    'con_totalht' => $contractTotalHt,
                    'con_totaltax' => $contractTotalTax,
                    'con_totalttc' => $contractTotalTtc,
                    'fk_ord_id' => $saleOrder->ord_id,
                    'con_status' => ContractModel::STATUS_DRAFT,
                ], $userId);

                // Copier les lignes vers le contrat
                $lineOrder = 1;
                foreach ($contractLines as $lineData) {
                    $orderLine = $lineData['orderLine'];
                    $contractLine = new ContractLineModel();
                    $contractLine->fk_con_id = $contract->con_id;

                    // Ne pas définir fk_orl_id (n'existe pas dans ContractLineModel)
                    if ($orderLine->orl_type == 0) {
                        $contractLine->col_qty = $lineData['qty'];
                        $contractLine->col_mtht = $lineData['lineHt'];
                    } else {
                        $contractLine->col_qty = 1;
                        $contractLine->col_mtht = 0;
                    }

                    $contractLine->col_order = $lineOrder++;
                    $contractLine->col_type = $orderLine->orl_type;
                    $contractLine->fk_prt_id = $orderLine->fk_prt_id;
                    $contractLine->fk_tax_id = $orderLine->fk_tax_id;
                    $contractLine->col_priceunitht = $orderLine->orl_priceunitht;
                    $contractLine->col_purchasepriceunitht = $orderLine->orl_purchasepriceunitht;
                    $contractLine->col_discount = $orderLine->orl_discount;
                    $contractLine->col_tax_rate = $orderLine->orl_tax_rate;
                    $contractLine->col_prtlib = $orderLine->orl_prtlib;
                    $contractLine->col_prtdesc = $orderLine->orl_prtdesc;
                    $contractLine->col_prttype = $orderLine->orl_prttype;
                    $contractLine->col_note = $orderLine->orl_note;
                    $contractLine->fk_usr_id_author = $userId;
                    $contractLine->fk_usr_id_updater = $userId;
                    $contractLine->save();
                }
            }

            DB::commit();

            // Préparer le message de réponse
            if ($invoice && $contract) {
                $message = 'Facture et contrat générés avec succès';
            } elseif ($invoice) {
                $message = 'Facture générée avec succès';
            } elseif ($contract) {
                $message = 'Contrat généré avec succès';
            } else {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Aucun document généré',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'invoice' => $invoice ? [
                        'id' => $invoice->inv_id,
                        'number' => $invoice->inv_number,
                    ] : null,
                    'contract' => $contract ? [
                        'id' => $contract->con_id,
                        'number' => $contract->con_number,
                    ] : null,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Méthode helper pour récupérer les lignes normales qui suivent un titre/sous-total
     *
     * @param \Illuminate\Database\Eloquent\Collection $allLines Toutes les lignes de la commande
     * @param int $currentOrder Position du titre/sous-total actuel
     * @param array $selectedLineIds IDs des lignes sélectionnées
     * @return array Lignes normales sélectionnées qui suivent
     */
    private function getNextNormalLines($allLines, $currentOrder, $selectedLineIds)
    {
        $nextLines = [];

        foreach ($allLines as $line) {
            // Ignorer les lignes avant le titre actuel
            if ($line->orl_order <= $currentOrder) {
                continue;
            }

            // Arrêter au prochain titre ou sous-total
            if ($line->orl_type == 1 || $line->orl_type == 2) {
                break;
            }

            // Ajouter seulement les lignes normales sélectionnées
            if ($line->orl_type == 0 && in_array($line->orl_id, $selectedLineIds)) {
                $nextLines[] = $line;
            }
        }

        return $nextLines;
    }

    /**
     * Méthode helper pour récupérer les lignes normales qui précèdent un sous-total
     * depuis le dernier titre (SEPARATOR)
     *
     * @param \Illuminate\Database\Eloquent\Collection $allLines Toutes les lignes de la commande
     * @param int $currentOrder Position du sous-total actuel
     * @param array $selectedLineIds IDs des lignes sélectionnées
     * @return array Lignes normales sélectionnées qui précèdent depuis le dernier titre
     */
    private function getPreviousNormalLinesSinceLastSeparator($allLines, $currentOrder, $selectedLineIds)
    {
        $prevLines = [];

        // Parcourir les lignes en ordre inverse depuis le sous-total
        foreach ($allLines->reverse() as $line) {
            // Ignorer les lignes après le sous-total actuel
            if ($line->orl_order >= $currentOrder) {
                continue;
            }

            // Arrêter au titre (SEPARATOR) précédent
            if ($line->orl_type == 1) {
                break;
            }

            // Ajouter seulement les lignes normales sélectionnées
            if ($line->orl_type == 0 && in_array($line->orl_id, $selectedLineIds)) {
                $prevLines[] = $line;
            }
        }

        return $prevLines;
    }
}
