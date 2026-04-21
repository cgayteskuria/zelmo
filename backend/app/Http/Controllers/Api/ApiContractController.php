<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

use App\Models\ContractModel;
use App\Models\ContractLineModel;
use App\Models\DurationsModel;
use App\Models\ContractInvoiceModel;
use App\Models\InvoiceModel;
use App\Models\SaleOrderModel;


use App\Services\Pdf\DocumentPdfService;
use App\Services\ContractInvoiceService;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Traits\HasGridFilters;

class ApiContractController extends ApiBizDocumentController
{
    use HasGridFilters;
    /**
     * Implémentation des méthodes abstraites de BaseDocumentController
     */

    protected function getDocumentModel(): string
    {
        return ContractModel::class;
    }

    protected function getLineModel(): string
    {
        return ContractLineModel::class;
    }

    protected function getDocumentPrimaryKey(): string
    {
        return 'con_id';
    }

    protected function getLinePrimaryKey(): string
    {
        return 'col_id';
    }

    protected function getLineForeignKey(): string
    {
        return 'fk_con_id';
    }

    protected function getLinesRelationshipName(): string
    {
        return 'lines';
    }

    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'con_id',
            'number' => 'con_number',
            'date' => 'con_date',
            'status' => 'con_status',
            'beingEdited' => 'con_being_edited',
            'totalHt' => 'con_totalht',
            'totalHtSub' => 'con_totalhtsub',
            'totalHtComm' => 'con_totalhtcomm',
            'totalTax' => 'con_totaltax',
            'totalTtc' => 'con_totalttc',

            // Line fields
            'lineId' => 'col_id',
            'fk_parent_id' => 'fk_con_id',
            'lineOrder' => 'col_order',
            'lineType' => 'col_type',
            'fk_prt_id' => 'fk_prt_id',
            'fk_tax_id' => 'fk_tax_id',
            'qty' => 'col_qty',
            'priceUnitHt' => 'col_priceunitht',
            'purchasePriceUnitHt' => 'col_purchasepriceunitht',
            'discount' => 'col_discount',
            'totalHt' => 'col_mtht',
            'taxRate' => 'col_tax_rate',
            'prtLib' => 'col_prtlib',
            'prtDesc' => 'col_prtdesc',
            'prtType' => 'col_prttype',
            'isSubscription' => 'col_is_subscription',
        ];
    }

    /**
     * Méthodes spécifiques à Contract
     */

    /**
     * Map pour le TRI des colonnes (con_number → con_id pour un tri naturel).
     */
    private function getContractSortColumnMap(): array
    {
        return [
            'id'                   => 'con.con_id',
            'con_number'           => 'con.con_id',
            'con_date'             => 'con.con_date',
            'ptr_name'             => 'ptr.ptr_name',
            'con_status'           => 'con.con_status',
            'con_totalhtsub'       => 'con.con_totalhtsub',
            'con_totalht'          => 'con.con_totalht',
            'con_totalttc'         => 'con.con_totalttc',
            'con_next_invoice_date' => 'con.con_next_invoice_date',
        ];
    }

    /**
     * Map pour le FILTRAGE des colonnes (con_number → con_number pour LIKE).
     */
    private function getContractFilterColumnMap(): array
    {
        return [
            'id'                   => 'con.con_id',
            'con_number'           => 'con.con_number',
            'con_date'             => 'con.con_date',
            'ptr_name'             => 'ptr.ptr_name',
            'con_status'           => 'con.con_status',
            'con_totalhtsub'       => 'con.con_totalhtsub',
            'con_totalht'          => 'con.con_totalht',
            'con_totalttc'         => 'con.con_totalttc',
            'con_next_invoice_date' => 'con.con_next_invoice_date',
        ];
    }

    /**
     * Affiche la liste de tous les contrats
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request)
    {
        $query = ContractModel::from('contract_con as con')
            ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'con.con_id as id',
                'con_number',
                'con_date',
                'ptr_name',
                'con_totalht',
                'con_totalhtsub',
                'con_totalttc',
                'con_status',
                'con_next_invoice_date',
                'con_operation'
            ]);

        $this->applyGridFilters($query, $request, $this->getContractFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getContractSortColumnMap(), 'con_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        return response()->json([
            'data'  => $data,
            'total' => $total,
        ]);
    }

    /**
     * Display the specified .
     */
    public function show($id)
    {
        $data = ContractModel::withCount('documents')
            ->with([
                'partner:ptr_id,ptr_name',
                'paymentCondition:dur_id,dur_label',
                'paymentMode:pam_id,pam_label',
                'taxPosition:tap_id,tap_label',
                'commitmentDuration:dur_id,dur_label',
                'renewDuration:dur_id,dur_label',
                'noticeDuration:dur_id,dur_label',
                'invoicingDuration:dur_id,dur_label',
                'seller' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                }
            ])
            ->where('con_id', $id)->firstOrFail();

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
     * Affiche la liste des contrats clients (con_operation = 1)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexCustomerContracts(Request $request)
    {
        $gridKey = 'customer-contracts';

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

        $query = ContractModel::from('contract_con as con')
            ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'con.con_id as id',
                'con_number',
                'con_date',
                'ptr_name',
                'con_totalht',
                'con_totalhtsub',
                'con_totalttc',
                'con_status',
                'con_next_invoice_date',
                'con_operation'
            ])
            ->where('con.con_operation', 1);

        $this->applyGridFilters($query, $request, $this->getContractFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getContractSortColumnMap(), 'con_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'con_number'),
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
     * Affiche la liste des contrats fournisseurs (con_operation = 2)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexSupplierContracts(Request $request)
    {
        $gridKey = 'supplier-contracts';

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

        $query = ContractModel::from('contract_con as con')
            ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'con.con_id as id',
                'con_number',
                'con_date',
                'ptr_name',
                'con_totalht',
                'con_totalhtsub',
                'con_totalttc',
                'con_status',
                'con_next_invoice_date',
                'con_operation'
            ])
            ->where('con.con_operation', 2);

        $this->applyGridFilters($query, $request, $this->getContractFilterColumnMap());
        $total = $query->count();
        $this->applyGridSort($query, $request, $this->getContractSortColumnMap(), 'con_number', 'DESC');
        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'con_number'),
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
     * Calcule la prochaine date de facturation
     *
     * @param int $contractId
     * @param Request $request
     * @return JsonResponse
     */
    public function calculateNextInvoiceDate($contractId, Request $request): JsonResponse
    {
        try {
            $durId = $request->input('dur_id');
            $baseDate = $request->input('base_date');

            $hasNoInvoices = ContractInvoiceModel::where('fk_con_id', $contractId)->count() === 0;
            $isFirstDur = $hasNoInvoices ? "true" : "false";
            $nextDate = DurationsModel::calculateNextDate($durId, $baseDate, $isFirstDur);

            return response()->json([
                'success' => true,
                'data' => [
                    'nextDate' => $nextDate,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du calcul de la prochaine date de facturation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calcule la date de fin d'engagement
     *
     * @param int $contractId
     * @param Request $request
     * @return JsonResponse
     */
    public function calculateEndCommitmentDate(Request $request): JsonResponse
    {
        try {
            $durId = $request->input('dur_id');
            $baseDate = $request->input('base_date');

            // Calculer la date de préavis (date à partir de laquelle on peut résilier en respectant le préavis)
            // Utiliser la méthode du modèle DurationsModel pour calculer la date
            $endDate = DurationsModel::calculateNextDate($durId, $baseDate, false);

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

    /**
     * Récupère les données nécessaires pour la modale de résiliation
     *
     * @param int $contractId
     * @return JsonResponse
     */
    public function getTerminationData($contractId): JsonResponse
    {
        try {
            $contract = ContractModel::findOrFail($contractId);

            // Récupérer la date de la première facture liée au contrat
            $firstInvoice = DB::table('contract_invoice_coi as coi')
                ->join('invoice_inv as inv', 'coi.fk_inv_id', '=', 'inv.inv_id')
                ->where('fk_con_id', $contractId)
                ->select('inv.inv_date')
                ->orderBy('inv.inv_date', 'ASC')
                ->first();

            // Date minimum de résiliation : max entre la date de la première facture et la date du contrat
            $terminatedDateMin = $firstInvoice && !empty($firstInvoice->inv_date)
                ? $firstInvoice->inv_date
                : $contract->con_date;

            // Date maximum de résiliation
            $terminatedDateMax = '2099-09-19';

            // Calculer la date de préavis (date à partir de laquelle on peut résilier en respectant le préavis)
            // Utiliser la méthode du modèle DurationsModel pour calculer la date
            $dateNotice = DurationsModel::calculateNextDate($contract->fk_dur_id_notice, Carbon::now()->format('Y-m-d'), false);

            // Date de résiliation par défaut
            $conTerminatedDate = $dateNotice;

            return response()->json([
                'success' => true,
                'data' => [
                    'con_end_commitment' => $contract->con_end_commitment,
                    'terminated_date_min' => $terminatedDateMin,
                    'terminated_date_max' => $terminatedDateMax,
                    'date_notice' => $dateNotice,
                    'con_terminated_date' => $conTerminatedDate,
                    'fk_dur_id_notice' => $contract->fk_dur_id_notice,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des données de résiliation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Résilie un contrat
     *
     * @param int $contractId
     * @param Request $request
     * @return JsonResponse
     */
    public function terminate($contractId, Request $request): JsonResponse
    {
        try {
            $contract = ContractModel::findOrFail($contractId);

            $contract->con_status = ContractModel::STATUS_TERMINATED;
            $contract->con_terminated_date = $request->input('terminated_date');
            $contract->con_terminated_invoice_date = $request->input('terminated_invoice_date');
            $contract->con_terminated_reason = $request->input('terminated_reason');
            $contract->save();

            return response()->json([
                'success' => true,
                'message' => 'Contrat résilié avec succès',
                'data' => $contract,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la résiliation du contrat: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère tous les objets liés à un contrat
     * (Factures, commandes liées)
     *
     * @param int $contractId
     * @return JsonResponse
     */
    public function getLinkedObjects($contractId): JsonResponse
    {
        try {
            // Factures client liées au contrat
            $invoices = InvoiceModel::query()
                ->leftJoin('partner_ptr as ptr', 'invoice_inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->join('contract_invoice_coi as coi', 'invoice_inv.inv_id', '=', 'coi.fk_inv_id')
                ->where('coi.fk_con_id', $contractId)
                ->select([
                    'invoice_inv.inv_id as id',
                    DB::raw("'customerinvoices' as object"),
                    DB::raw("'Facture client' as type"),
                    'invoice_inv.inv_number as number',
                    'invoice_inv.inv_date as date',
                    'ptr.ptr_name',
                    'invoice_inv.inv_totalht as totalht',
                ])
                ->get();

            // Commandes clients liées au contrat
            $saleOrders = SaleOrderModel::query()
                ->join('contract_con as con', 'con.fk_ord_id', '=', 'sale_order_ord.ord_id')
                ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('con.con_id', $contractId)
                ->select([
                    'sale_order_ord.ord_id as id',
                    DB::raw("'saleorders' as object"),
                    DB::raw("'Commande client' as type"),
                    'sale_order_ord.ord_number as number',
                    'sale_order_ord.ord_date as date',
                    'ptr.ptr_name',
                    'sale_order_ord.ord_totalht as totalht',
                ])
                ->get();

            // Fusionner tous les résultats
            $linkedObjects = collect()
                ->concat($invoices)
                ->concat($saleOrders)
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
     * Génère et retourne le PDF d'un contrat
     *
     * @param int $id ID du contrat
     * @return JsonResponse
     */
    public function printPdf($id): JsonResponse
    {
        try {
            $pdfService = new DocumentPdfService();
            // TODO: Implémenter la génération de PDF pour les contrats
            // $pdfBase64 = $pdfService->generateContractPdf($id);

            // Pour l'instant, retourner un message d'erreur
            throw new \Exception("La génération de PDF pour les contrats n'est pas encore implémentée");

            // Récupérer les infos de base pour le nom du fichier
            // $contract = ContractModel::findOrFail($id);
            // $fileName = 'Contrat_' . $contract->con_number . '.pdf';

            // return response()->json([
            //     'success' => true,
            //     'data' => [
            //         'pdf' => $pdfBase64,
            //         'fileName' => $fileName,
            //     ],
            // ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération du PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les contrats éligibles à la facturation
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getEligibleForInvoicing(Request $request): JsonResponse
    {

        try {



            $data = ContractModel::join('partner_ptr', 'partner_ptr.ptr_id', '=', 'contract_con.fk_ptr_id')
                ->where('con_operation', 1) // Contrats clients
                ->where('con_is_invoicing_mgmt', 1) // Contrats facturable
                ->whereIn('con_status', [1, 2]) // ACTIVE ou TERMINATING
                ->whereNotNull('con_next_invoice_date')
                ->select([
                    'con_id as id',
                    'con_number',
                    'con_date',
                    'con_label',
                    'ptr_name',
                    'con_totalhtsub',
                    'con_totalttc',
                    'con_next_invoice_date',
                    'con_status',
                    'con_operation'
                ])
                ->orderBy('con_next_invoice_date', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des contrats éligibles: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère des factures à partir d'une liste de contrats
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function generateInvoices(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'contract_ids' => 'required|array|min:1',
                'contract_ids.*' => 'required|integer|exists:contract_con,con_id',
            ]);

            $contractIds = $request->input('contract_ids');

            $userId = $request->user()->usr_id;
            $contractInvoiceService = new ContractInvoiceService();
            $result = $contractInvoiceService->generateInvoicesFromContracts($contractIds, $userId);

            return response()->json([
                'success' => true,
                'data' => $result['summary'],
                'message' => $result['success']
                    ? "{$result['summary']['success']} facture(s) générée(s) avec succès"
                    : "Traitement effectué avec erreurs",
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération des factures: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère une facture à partir d'un contrat spécifique
     *
     * @param int $id ID du contrat
     * @param Request $request
     * @return JsonResponse
     */
    public function generateInvoice($id, Request $request): JsonResponse
    {
        try {
            $options = [
                'invoice_date' => $request->input('invoice_date', date('Y-m-d')),
            ];

            $userId = $request->user()->usr_id;
            $contractInvoiceService = new ContractInvoiceService(app(\App\Services\InvoiceService::class));

            $result = $contractInvoiceService->generateInvoiceFromContract($id, $userId, $options);

            return response()->json([
                'success' => $result['success'],
                'data' => $result['invoice'],
                'message' => $result['message'],
            ], $result['success'] ? 200 : 400);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération de la facture: ' . $e->getMessage(),
            ], 500);
        }
    }
}
