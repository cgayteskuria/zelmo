<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

use App\Models\PurchaseOrderModel;
use App\Models\PurchaseOrderLineModel;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\DurationsModel;
use App\Models\DeliveryNoteModel;
use App\Services\PurchaseOrderService;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\DB;
use App\Traits\HasGridFilters;


class ApiPurchaseOrderController extends ApiBizDocumentController
{
    use HasGridFilters;

    /**
     * Implémentation des méthodes abstraites de ApiBizDocumentController
     */

    protected function getDocumentModel(): string
    {
        return PurchaseOrderModel::class;
    }

    protected function getLineModel(): string
    {
        return PurchaseOrderLineModel::class;
    }

    protected function getDocumentPrimaryKey(): string
    {
        return 'por_id';
    }

    protected function getLinePrimaryKey(): string
    {
        return 'pol_id';
    }

    protected function getLineForeignKey(): string
    {
        return 'fk_por_id';
    }

    protected function getLinesRelationshipName(): string
    {
        return 'lines';
    }

    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'por_id',
            'number' => 'por_number',
            'date' => 'por_date',
            'status' => 'por_status',
            'beingEdited' => 'por_being_edited',
            'totalHt' => 'por_totalht',
            'totalTax' => 'por_totaltax',
            'totalTtc' => 'por_totalttc',
            'invoicingState' => 'por_invoicing_state',
            'receptionState' => 'por_delivery_state',

            // Line fields
            'lineId' => 'pol_id',
            'fk_parent_id' => 'fk_por_id',
            'lineOrder' => 'pol_order',
            'lineType' => 'pol_type',
            'fk_prt_id' => 'fk_prt_id',
            'fk_tax_id' => 'fk_tax_id',
            'qty' => 'pol_qty',
            'priceUnitHt' => 'pol_priceunitht',
            'discount' => 'pol_discount',
            'totalHt' => 'pol_mtht',
            'taxRate' => 'pol_tax_rate',
            'prtLib' => 'pol_prtlib',
            'prtDesc' => 'pol_prtdesc',
            'prtType' => 'pol_prttype',
            'isSubscription' => 'pol_is_subscription',
        ];
    }

    /**
     * Méthodes spécifiques à PurchaseOrder
     */

    /**
     * Map pour le TRI des colonnes (por_number → por_id pour un tri naturel).
     */
    private function getPurchaseOrderSortColumnMap(): array
    {
        return [
            'id'                  => 'por.por_id',
            'por_number'          => 'por.por_id',
            'por_date'            => 'por.por_date',
            'ptr_name'            => 'ptr.ptr_name',
            'por_externalreference' => 'por.por_externalreference',
            'por_status'          => 'por.por_status',
            'por_delivery_state' => 'por.por_delivery_state',
            'por_invoicing_state' => 'por.por_invoicing_state',
            'por_totalht'         => 'por.por_totalht',
            'por_totalttc'        => 'por.por_totalttc',
        ];
    }

    /**
     * Map pour le FILTRAGE des colonnes (por_number → por_number pour LIKE).
     */
    private function getPurchaseOrderFilterColumnMap(): array
    {
        return [
            'id'                  => 'por.por_id',
            'por_number'          => 'por.por_number',
            'por_date'            => 'por.por_date',
            'ptr_name'            => 'ptr.ptr_name',
            'por_externalreference' => 'por.por_externalreference',
            'por_status'          => 'por.por_status',
            'por_delivery_state' => 'por.por_delivery_state',
            'por_invoicing_state' => 'por.por_invoicing_state',
            'por_totalht'         => 'por.por_totalht',
            'por_totalttc'        => 'por.por_totalttc',
        ];
    }

    /**
     * Affiche la liste des commandes fournisseurs (por_status >= 3)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request)
    {
        $gridKey = 'purchase-orders';

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

        $query = PurchaseOrderModel::from('purchase_order_por as por')
            ->leftJoin('partner_ptr as ptr', 'por.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'por.por_id as id',
                'por_number',
                'por_date',
                'ptr_name',
                'por_externalreference',
                'por_totalht',
                'por_totalttc',
                'por_status',
                'por_invoicing_state',
                'por_delivery_state',
                'por_note'
            ]);

        $this->applyGridFilters($query, $request, $this->getPurchaseOrderFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getPurchaseOrderSortColumnMap(), 'por_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'por_number'),
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
     * Affiche la liste des devis fournisseurs (por_status < 3 ou null)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexQuotations(Request $request)
    {
        $gridKey = 'purchase-quotations';

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

        $query = PurchaseOrderModel::from('purchase_order_por as por')
            ->leftJoin('partner_ptr as ptr', 'por.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'por.por_id as id',
                'por_number',
                'por_date',
                'ptr_name',
                'por_externalreference',
                'por_totalht',
                'por_totalttc',
                'por_status',
                'por_invoicing_state',
                'por_delivery_state',
                'por_note'
            ])
            ->where(function ($q) {
                $q->where('por.por_status', '<', PurchaseOrderModel::STATUS_IN_PROGRESS)
                    ->orWhereNull('por.por_status');
            });

        $this->applyGridFilters($query, $request, $this->getPurchaseOrderFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getPurchaseOrderSortColumnMap(), 'por_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'por_number'),
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
        $data = PurchaseOrderModel::withCount('documents')
            ->with([
                'partner:ptr_id,ptr_name',
                'paymentCondition:dur_id,dur_label',
                'paymentMode:pam_id,pam_label',
                'taxPosition:tap_id,tap_label',
                'warehouse:whs_id,whs_label',
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
            ->where('por_id', $id)->firstOrFail();

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
     * Récupère tous les objets liés à une commande fournisseur
     * (Commandes clients, bons de réception, factures fournisseur)
     *
     * @param int $porId
     * @return JsonResponse
     */
    public function getLinkedObjects($porId): JsonResponse
    {
        try {
            // Commandes clients liées
            $saleOrders = DB::table('sale_order_ord')
                ->leftJoin('partner_ptr', 'sale_order_ord.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->leftJoin('purchase_order_por', 'purchase_order_por.fk_ord_id', '=', 'sale_order_ord.ord_id')
                ->where('purchase_order_por.por_id', $porId)
                ->select(
                    'ord_id as id',
                    DB::raw("'saleorder' as object"),
                    DB::raw("'Commande client' as type"),
                    'ord_number as number',
                    'ord_date as date',
                    'ptr_name',
                    'ord_totalht as totalht'
                )
                ->get();

            // Bons de réception
            $receptionNotes = DB::table('delivery_note_dln')
                ->leftJoin('partner_ptr', 'delivery_note_dln.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_por_id', $porId)
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

            // Factures fournisseur
            $invoices = DB::table('invoice_inv')
                ->leftJoin('partner_ptr', 'invoice_inv.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                ->where('fk_por_id', $porId)
                ->where('inv_operation', 2)
                ->select(
                    'inv_id as id',
                    DB::raw("'suppinvoice' as object"),
                    DB::raw("'Facture fournisseur' as type"),
                    'inv_number as number',
                    'inv_date as date',
                    'ptr_name',
                    'inv_totalht as totalht'
                )
                ->get();

            // Fusionner tous les résultats
            $linkedObjects = collect()
                ->concat($saleOrders)
                ->concat($receptionNotes)
                ->concat($invoices)
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
     * Génère et retourne le PDF d'une commande fournisseur
     *
     * @param int $id ID de la commande
     * @return JsonResponse
     */
    public function printPdf($id): JsonResponse
    {
        try {
            // TODO: Implémenter la génération du PDF pour les commandes fournisseur
            // Pour l'instant, retourner une erreur indiquant que cette fonctionnalité n'est pas encore implémentée

            $purchaseOrder = PurchaseOrderModel::findOrFail($id);
            $fileName = 'Commande_' . $purchaseOrder->por_number . '.pdf';

            return response()->json([
                'success' => false,
                'message' => 'La génération de PDF pour les commandes fournisseur n\'est pas encore implémentée',
            ], 501);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération du PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère une facture fournisseur à partir d'une commande avec les lignes sélectionnées
     *
     * @param int $porId ID de la commande fournisseur
     * @param Request $request
     * @return JsonResponse
     */
    public function generateInvoice($porId, Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Récupérer les lignes sélectionnées avec leurs quantités
            $selectedLinesData = $request->input('lines', []);

            if (empty($selectedLinesData)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Veuillez sélectionner au moins une ligne à facturer',
                ], 400);
            }

            // Charger la commande avec ses lignes
            $purchaseOrder = PurchaseOrderModel::with('lines')->findOrFail($porId);

            // Vérifier que la commande est confirmée
            if ($purchaseOrder->por_status != PurchaseOrderModel::STATUS_IN_PROGRESS) {
                return response()->json([
                    'success' => false,
                    'message' => 'Seules les commandes confirmées peuvent être facturées',
                ], 400);
            }

            // Récupérer les quantités déjà facturées pour chaque ligne
            $invoicedQuantities = InvoiceLineModel::join('invoice_inv', 'invoice_line_inl.fk_inv_id', '=', 'invoice_inv.inv_id')
                ->where('invoice_inv.fk_por_id', $porId)
                ->whereIn('invoice_inv.inv_status', [InvoiceModel::STATUS_DRAFT, InvoiceModel::STATUS_FINALIZED])
                ->select('fk_pol_id', DB::raw('SUM(inl_qty) as total_invoiced'))
                ->groupBy('fk_pol_id')
                ->pluck('total_invoiced', 'fk_pol_id');

            // Valider et préparer les lignes
            $linesToInvoice = [];
            $totalHt = 0;
            $totalTax = 0;

            foreach ($selectedLinesData as $lineData) {
                $lineId = $lineData['line_id'];
                $qtyToInvoice = $lineData['qty'];

                // Récupérer la ligne de commande
                $orderLine = $purchaseOrder->lines()->where('pol_id', $lineId)->first();

                if (!$orderLine) {
                    return response()->json([
                        'success' => false,
                        'message' => "Ligne de commande {$lineId} introuvable",
                    ], 400);
                }

                // Calculer la quantité déjà facturée
                $alreadyInvoiced = $invoicedQuantities[$lineId] ?? 0;
                $remainingQty = $orderLine->pol_qty - $alreadyInvoiced;

                // Valider que la quantité ne dépasse pas le restant à facturer
                if ($qtyToInvoice > $remainingQty) {
                    return response()->json([
                        'success' => false,
                        'message' => "La quantité à facturer ({$qtyToInvoice}) pour la ligne '{$orderLine->pol_prtlib}' dépasse la quantité restante ({$remainingQty})",
                    ], 400);
                }

                if ($qtyToInvoice <= 0) {
                    return response()->json([
                        'success' => false,
                        'message' => "La quantité à facturer doit être supérieure à 0 pour la ligne '{$orderLine->pol_prtlib}'",
                    ], 400);
                }

                // Calculer le montant HT pour cette quantité
                $lineHt = $orderLine->pol_priceunitht * $qtyToInvoice * (1 - $orderLine->pol_discount / 100);
                $lineTax = $lineHt * $orderLine->pol_tax_rate / 100;

                $totalHt += $lineHt;
                $totalTax += $lineTax;

                $linesToInvoice[] = [
                    'orderLine' => $orderLine,
                    'qty' => $qtyToInvoice,
                    'lineHt' => $lineHt,
                ];
            }

            $totalTtc = $totalHt + $totalTax;

            // Calculer la date d'échéance si condition de paiement définie
            $dueDate = $purchaseOrder->por_date;
            if ($purchaseOrder->fk_dur_id_payment_condition) {
                $dueDate = DurationsModel::calculateNextDate($purchaseOrder->fk_dur_id_payment_condition, $purchaseOrder->por_date);
            }

            // Créer la facture via InvoiceService
            $invoiceService = new InvoiceService();
            $invoice = $invoiceService->createInvoice([
                'inv_date' => $purchaseOrder->por_date,
                'inv_duedate' => $dueDate,
                'inv_operation' => InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                'fk_ptr_id' => $purchaseOrder->fk_ptr_id,
                'inv_ptr_address' => $purchaseOrder->por_ptr_address ?? null,
                'fk_ctc_id' => $purchaseOrder->fk_ctc_id ?? null,
                'fk_pam_id' => $purchaseOrder->fk_pam_id ?? null,
                'fk_dur_id_payment_condition' => $purchaseOrder->fk_dur_id_payment_condition ?? null,
                'fk_tap_id' => $purchaseOrder->fk_tap_id ?? null,
                'inv_note' => $purchaseOrder->por_note ?? null,
                'inv_externalreference' => $purchaseOrder->por_externalreference ?? null,
                'inv_totalht' => $totalHt,
                'inv_totaltax' => $totalTax,
                'inv_totalttc' => $totalTtc,
                'fk_por_id' => $purchaseOrder->por_id,
                'inv_status' => InvoiceModel::STATUS_DRAFT,
            ], (int) $request->user()->usr_id);

            usort($linesToInvoice, function ($a, $b) {
                return $a['orderLine']->pol_order <=> $b['orderLine']->pol_order;
            });

            // Copier les lignes sélectionnées vers la facture
            $lineOrder = 1;
            foreach ($linesToInvoice as $lineToInvoice) {
                $orderLine = $lineToInvoice['orderLine'];
                $qtyToInvoice = $lineToInvoice['qty'];
                $lineHt = $lineToInvoice['lineHt'];

                $invoiceLine = new InvoiceLineModel();
                $invoiceLine->fk_inv_id = $invoice->inv_id;
                if ($orderLine->pol_id == 0) {
                    $invoiceLine->fk_pol_id = $orderLine->pol_id; // Lien vers la ligne de commande fournisseur
                }
                $invoiceLine->inl_order = $lineOrder++;
                $invoiceLine->inl_type = $orderLine->pol_type;
                $invoiceLine->fk_prt_id = $orderLine->fk_prt_id;
                $invoiceLine->fk_tax_id = $orderLine->fk_tax_id;
                $invoiceLine->inl_qty = $qtyToInvoice;
                $invoiceLine->inl_priceunitht = $orderLine->pol_priceunitht;
                $invoiceLine->inl_discount = $orderLine->pol_discount;
                $invoiceLine->inl_mtht = $lineHt;
                $invoiceLine->inl_tax_rate = $orderLine->pol_tax_rate;
                $invoiceLine->inl_prtlib = $orderLine->pol_prtlib;
                $invoiceLine->inl_prtdesc = $orderLine->pol_prtdesc;
                $invoiceLine->inl_prttype = $orderLine->pol_prttype;
                $invoiceLine->inl_note = $orderLine->pol_note ?? null;
                $invoiceLine->fk_usr_id_author = (int) $request->user()->usr_id;
                $invoiceLine->fk_usr_id_updater = (int) $request->user()->usr_id;
                $invoiceLine->save();
            }

            // L'état de facturation est mis à jour automatiquement via le hook boot() de InvoiceLineModel

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Facture fournisseur générée avec succès',
                'data' => [
                    'invoice_id' => $invoice->inv_id,
                    'invoice_number' => $invoice->inv_number,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération de la facture: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Les méthodes suivantes sont héritées de ApiBizDocumentController :
     * - getLines($id) : Récupère les lignes de commande
     * - saveLine($porId, Request $request) : Sauvegarde une ligne
     * - deleteLine($porId, $lineId) : Supprime une ligne
     * - updateLinesOrder($porId, Request $request) : Réorganise les lignes
     * - duplicate($id) : Duplique une commande avec toutes ses lignes
     * - store(Request $request) : Crée une nouvelle commande
     * - show($id) : Affiche une commande
     * - update(Request $request, $id) : Met à jour une commande
     * - destroy($id) : Supprime une commande
     * - getDocuments($id) : Récupère les documents liés
     * - uploadDocuments($id, Request $request) : Upload des documents
     */

    /**
     * Surcharge de buildLineSelectFields pour ajouter les quantités facturées
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
            WHERE inl.fk_pol_id = line.' . $fieldMap['lineId'] . '
            AND inv.inv_status IN (' . InvoiceModel::STATUS_DRAFT . ', ' . InvoiceModel::STATUS_FINALIZED . ')
        ) AS qtyInvoiced');

        // Ajouter la quantité réceptionnée via une sous-requête
        $selectFields[] = DB::raw('(SELECT COALESCE(SUM(dnl.dnl_qty), 0)
            FROM delivery_note_line_dnl AS dnl
            INNER JOIN delivery_note_dln AS dln ON dnl.fk_dln_id = dln.dln_id
            WHERE dnl.fk_pol_id = line.' . $fieldMap['lineId'] . '
            AND dln.dln_status = ' . DeliveryNoteModel::STATUS_DRAFT . '
        ) AS qtyDelivered');

        return $selectFields;
    }
}
