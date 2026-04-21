<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Requests\StoreProductRequest;
use App\Models\ProductModel;
use App\Models\WarehouseModel;
use App\Models\DeliveryNoteModel;
use App\Traits\HasGridFilters;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Auth;


class ApiProductController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'products';

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

        // Sous-requête stock
        $stockSubQuery = DB::table('product_stock_psk')
            ->select(
                'fk_prt_id',
                DB::raw('SUM(psk_qty_physical) AS stock_physical'),
                DB::raw('SUM(psk_qty_virtual) AS stock_virtual')
            )
            ->groupBy('fk_prt_id');

        $query = ProductModel::from('product_prt as prt')
            ->leftJoinSub($stockSubQuery, 'stock', function ($join) {
                $join->on('prt.prt_id', '=', 'stock.fk_prt_id');
            })
            ->select([
                'prt.prt_id as id',
                'prt.prt_ref',
                'prt.prt_label',
                'prt.prt_priceunitht',
                'prt.prt_type',
                'prt_is_active',
                'prt_is_purchasable',
                'prt_is_sellable',
                'prt_subscription',
                'prt_stockable',
                DB::raw("COALESCE(stock.stock_physical, 0) AS stock_physical"),
                DB::raw("COALESCE(stock.stock_virtual, 0) AS stock_virtual"),
            ]);

        $this->applyGridFilters($query, $request, [
            'prt_ref'   => 'prt.prt_ref',
            'prt_label' => 'prt.prt_label',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'              => 'prt.prt_id',
            'prt_ref'         => 'prt.prt_ref',
            'prt_label'       => 'prt.prt_label',
            'prt_priceunitht' => 'prt.prt_priceunitht',
            'prt_type'        => 'prt.prt_type',
            'stock_physical'  => 'stock.stock_physical',
        ], 'id', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $products = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'id'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $products,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }


    /**
     * Récupère les contacts sous forme d'options pour un Select
     * Support des filtres 
     */
    public function options(Request $request)
    {

        $request->validate([
            'search'         => 'nullable|string|max:100',
            'limit'          => 'nullable|integer|min:1|max:200',
            'is_active'      => 'nullable|boolean',
            'is_purchasable' => 'nullable|boolean',
            'is_sellable'    => 'nullable|boolean',
            'is_saleable'    => 'nullable|boolean',
            'is_stockable'   => 'nullable|boolean',
            'prt_id'         => 'nullable|integer',
            'prt_ref'        => 'nullable|string',
            'prt_label'      => 'nullable|string',
            'prt_type'       => 'nullable|string|in:conso,service',
        ]);

        $query = ProductModel::from('product_prt')
            ->select([
                'prt_id as id',
                DB::raw("
                   TRIM(CONCAT_WS(' - ' , prt_ref, prt_label)) as label
                ")
            ]);

        /**
         * Recherche textuelle
         */
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('prt_ref', 'LIKE', "%{$search}%")
                    ->orWhere('prt_label', 'LIKE', "%{$search}%");
            });
        }

        /**
         * Mapping des filtres
         */
        if ($request->filled('prt_id')) {
            $query->where('prt_id', (int) $request->input('prt_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('prt_is_active', (int) $request->input('is_active'));
        }

        if ($request->filled('is_purchasable')) {
            $query->where('prt_is_purchasable', (int) $request->input('is_purchasable'));
        }

        if ($request->filled('is_sellable')) {
            $query->where('prt_is_sellable', (int) $request->input('is_sellable'));
        }

        if ($request->filled('is_saleable')) {
            $query->where('prt_is_sellable', (int) $request->input('is_saleable'));
        }

        if ($request->filled('is_stockable')) {
            $query->where('prt_stockable', (int) $request->input('is_stockable'));
        }

        if ($request->filled('prt_type')) {
            $query->where('prt_type', $request->input('prt_type'));
        }

        // Limite de résultats
        $limit = $request->input('limit', 50);

        $data = $query->orderBy("label", "asc")
            ->limit($limit)
            ->get();
        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Display the specified tax.
     */
    public function show($id)
    {
        $data = ProductModel::with([
            'taxSale:tax_id,tax_label',
            'taxPurchase:tax_id,tax_label',
            'accountSale:acc_id,acc_label,acc_code',
            'accountPurchase:acc_id,acc_label,acc_code',
        ])
            ->where('prt_id', $id)->firstOrFail();

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
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            // Validation de base
            $baseRules = [
                'prt_ref' => 'required|string|max:50|unique:product_prt,prt_ref',
                'prt_label' => 'required|string|max:255',
                'prt_is_active' => 'boolean',
                'prt_type' => 'required|string|in:conso,service',
                'prt_is_purchasable' => 'boolean',
                'prt_is_sellable' => 'boolean',
                'prt_desc' => 'nullable|string',
                'prt_subscription' => 'boolean',
                'prt_stock_alert_threshold' => 'nullable|numeric|min:0',
                'prt_stockable'             => 'boolean',
            ];

            // Règles conditionnelles pour les produits achetables
            if ($request->input('prt_is_purchasable')) {
                $baseRules['prt_pricehtcost'] = 'required|numeric|min:0';
                $baseRules['fk_tax_id_purchase'] = 'required|exists:account_tax_tax,tax_id';
            }

            // Règles conditionnelles pour les produits vendables
            if ($request->input('prt_is_sellable')) {
                $baseRules['prt_priceunitht'] = 'required|numeric|min:0';
                $baseRules['fk_tax_id_sale'] = 'required|exists:account_tax_tax,tax_id';
            }

            $baseRules['fk_acc_id_sale']     = 'nullable|exists:account_account_acc,acc_id';
            $baseRules['fk_acc_id_purchase'] = 'nullable|exists:account_account_acc,acc_id';
            // Règles de comptabilité si achetable OU vendable
            // if ($request->input('prt_is_purchasable') || $request->input('prt_is_sellable')) {
            //    $baseRules['fk_acc_id_sale'] = 'required|exists:account_account_acc,acc_id';
            //    $baseRules['fk_acc_id_purchase'] = 'required|exists:account_account_acc,acc_id';
            // }


            $validated = $request->validate($baseRules, [
                'prt_ref.required' => 'La référence est obligatoire',
                'prt_ref.unique' => 'Cette référence existe déjà',
                'prt_label.required' => 'Le libellé est obligatoire',
                'prt_pricehtcost.required' => 'Le prix d\'achat est requis pour un produit achetable',
                'prt_pricehtcost.min' => 'Le prix d\'achat doit être positif',
                'fk_tax_id_purchase.required' => 'La TVA sur achat est requise',
                'fk_tax_id_purchase.exists' => 'La TVA sélectionnée n\'existe pas',
                'prt_priceunitht.required' => 'Le prix de vente est requis pour un produit vendable',
                'prt_priceunitht.min' => 'Le prix de vente doit être positif',
                'fk_tax_id_sale.required' => 'La TVA sur vente est requise',
                'fk_tax_id_sale.exists' => 'La TVA sélectionnée n\'existe pas',
                'fk_acc_id_sale.required' => 'Le compte de vente est requis',
                'fk_acc_id_sale.exists' => 'Le compte de vente n\'existe pas',
                'fk_acc_id_purchase.required' => 'Le compte d\'achat est requis',
                'fk_acc_id_purchase.exists' => 'Le compte d\'achat n\'existe pas',
            ]);


            $product = ProductModel::create($validated);
            // Si c'est un service, on force prt_stockable à false par sécurité
            if ($product->prt_type === ProductModel::TYPE_SERVICE) {
                $product->prt_stockable = false;
            }
            $product->save();

            return response()->json([
                'message' => 'Produit créé avec succès',
                'data'    => $product
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Erreur lors de la création du produit',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Met à jour un produit existant
     */
    public function update(Request $request, $id): JsonResponse
    {
        $product = ProductModel::findOrFail($id);

        try {
            // Validation de base (même structure que store, unique avec ignore sur l'id courant)
            $baseRules = [
                'prt_ref'                   => 'required|string|max:50|unique:product_prt,prt_ref,' . $id . ',prt_id',
                'prt_label'                 => 'required|string|max:255',
                'prt_is_active'             => 'boolean',
                'prt_type'                  => 'required|string|in:conso,service',
                'prt_is_purchasable'        => 'boolean',
                'prt_is_sellable'           => 'boolean',
                'prt_desc'                  => 'nullable|string',
                'prt_subscription'          => 'boolean',
                'prt_stock_alert_threshold' => 'nullable|numeric|min:0',
                'prt_stockable'             => 'boolean',
            ];

            // Règles conditionnelles pour les produits achetables
            if ($request->input('prt_is_purchasable')) {
                $baseRules['prt_pricehtcost']       = 'required|numeric|min:0';
                $baseRules['fk_tax_id_purchase']    = 'required|exists:account_tax_tax,tax_id';
            } else {
                $baseRules['prt_pricehtcost']       = 'nullable|numeric|min:0';
                $baseRules['fk_tax_id_purchase']    = 'nullable|exists:account_tax_tax,tax_id';
            }

            // Règles conditionnelles pour les produits vendables
            if ($request->input('prt_is_sellable')) {
                $baseRules['prt_priceunitht']   = 'required|numeric|min:0';
                $baseRules['fk_tax_id_sale']    = 'required|exists:account_tax_tax,tax_id';
            } else {
                $baseRules['prt_priceunitht']   = 'nullable|numeric|min:0';
                $baseRules['fk_tax_id_sale']    = 'nullable|exists:account_tax_tax,tax_id';
            }

            // Règles de comptabilité si achetable OU vendable
            // if ($request->input('prt_is_purchasable') || $request->input('prt_is_sellable')) {
            //     $baseRules['fk_acc_id_sale']     = 'required|exists:account_account_acc,acc_id';
            //     $baseRules['fk_acc_id_purchase'] = 'required|exists:account_account_acc,acc_id';
            //  } else {
            $baseRules['fk_acc_id_sale']     = 'nullable|exists:account_account_acc,acc_id';
            $baseRules['fk_acc_id_purchase'] = 'nullable|exists:account_account_acc,acc_id';
            //  }

            $validated = $request->validate($baseRules, [
                'prt_ref.required'              => 'La référence est obligatoire',
                'prt_ref.unique'                => 'Cette référence existe déjà',
                'prt_label.required'            => 'Le libellé est obligatoire',
                'prt_pricehtcost.required'      => 'Le prix d\'achat est requis pour un produit achetable',
                'prt_pricehtcost.min'           => 'Le prix d\'achat doit être positif',
                'fk_tax_id_purchase.required'   => 'La TVA sur achat est requise',
                'fk_tax_id_purchase.exists'     => 'La TVA sélectionnée n\'existe pas',
                'prt_priceunitht.required'      => 'Le prix de vente est requis pour un produit vendable',
                'prt_priceunitht.min'           => 'Le prix de vente doit être positif',
                'fk_tax_id_sale.required'       => 'La TVA sur vente est requise',
                'fk_tax_id_sale.exists'         => 'La TVA sélectionnée n\'existe pas',
                'fk_acc_id_sale.required'       => 'Le compte de vente est requis',
                'fk_acc_id_sale.exists'         => 'Le compte de vente n\'existe pas',
                'fk_acc_id_purchase.required'   => 'Le compte d\'achat est requis',
                'fk_acc_id_purchase.exists'     => 'Le compte d\'achat n\'existe pas',
            ]);

            return DB::transaction(function () use ($product, $validated) {

                // Si on change le type en Service, on désactive la gestion de stock d'office
                if (isset($validated['prt_type']) && $validated['prt_type'] === ProductModel::TYPE_SERVICE) {
                    $validated['prt_stockable'] = false;
                }

                // Mise à jour de l'utilisateur qui modifie
                $product->fk_usr_id_updater = Auth::id();

                // Application des modifications
                $product->update($validated);

                return response()->json([
                    'success' => true,
                    'message' => 'Produit mis à jour avec succès',
                    'data'    => $product->fresh() // Charge les données fraîches de la BDD
                ]);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()
            ], 500);
        }
    }

    public function getStockData($id): JsonResponse
    {
        try {
            // Récupération des stocks par entrepôt
            $warehouseStocks = DB::table('product_stock_psk as psk')
                ->select([
                    'psk.psk_id',
                    'whs.whs_code',
                    'whs.whs_label',
                    'psk.psk_qty_physical',
                    'psk.psk_qty_virtual',
                    DB::raw('COALESCE(pending_sales.qty_pending, 0) as qty_pending_delivery'),
                    DB::raw('COALESCE(pending_purchases.qty_pending, 0) as qty_pending_reception'),
                    DB::raw("DATE_FORMAT(psk.psk_last_movement_date, '%d/%m/%Y %H:%i') as last_movement")
                ])
                ->join('warehouse_whs as whs', 'psk.fk_whs_id', '=', 'whs.whs_id')

                // Sous-requête pour les ventes en attente de livraison
                ->leftJoinSub(
                    DB::table('sale_order_line_orl as orl')
                        ->select([
                            'orl.fk_prt_id',
                            DB::raw('SUM(orl.orl_qty - COALESCE(delivered.qty_delivered, 0)) as qty_pending')
                        ])
                        ->join('sale_order_ord as ord', 'orl.fk_ord_id', '=', 'ord.ord_id')
                        ->leftJoinSub(
                            DB::table('delivery_note_line_dnl as dnl')
                                ->select([
                                    'dnl.fk_orl_id',
                                    DB::raw('SUM(dnl.dnl_qty) as qty_delivered')
                                ])
                                ->join('delivery_note_dln as dln', 'dnl.fk_dln_id', '=', 'dln.dln_id')
                                ->where('dln.dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
                                ->where('dln.dln_status', DeliveryNoteModel::STATUS_VALIDATED)
                                ->groupBy('dnl.fk_orl_id'),
                            'delivered',
                            'orl.orl_id',
                            '=',
                            'delivered.fk_orl_id'
                        )
                        ->where('ord.ord_status', '>=', 2)
                        ->where('ord.ord_status', '<', 5)
                        ->where('orl.orl_prttype', 0)
                        ->whereRaw('orl.orl_qty > COALESCE(delivered.qty_delivered, 0)')
                        ->groupBy('orl.fk_prt_id'),
                    'pending_sales',
                    'psk.fk_prt_id',
                    '=',
                    'pending_sales.fk_prt_id'
                )

                // Sous-requête pour les achats en attente de réception
                ->leftJoinSub(
                    DB::table('purchase_order_line_pol as pol')
                        ->select([
                            'pol.fk_prt_id',
                            DB::raw('SUM(pol.pol_qty - COALESCE(received.qty_received, 0)) as qty_pending')
                        ])
                        ->join('purchase_order_por as por', 'pol.fk_por_id', '=', 'por.por_id')
                        ->leftJoinSub(
                            DB::table('delivery_note_line_dnl as dnl')
                                ->select([
                                    'dnl.fk_pol_id',
                                    DB::raw('SUM(dnl.dnl_qty) as qty_received')
                                ])
                                ->join('delivery_note_dln as dln', 'dnl.fk_dln_id', '=', 'dln.dln_id')
                                ->where('dln.dln_operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
                                ->where('dln.dln_status', DeliveryNoteModel::STATUS_VALIDATED)
                                ->groupBy('dnl.fk_pol_id'),
                            'received',
                            'pol.pol_id',
                            '=',
                            'received.fk_pol_id'
                        )
                        ->where('por.por_status', 3)
                        ->where('pol.pol_prttype', 0)
                        ->whereRaw('pol.pol_qty > COALESCE(received.qty_received, 0)')
                        ->groupBy('pol.fk_prt_id'),
                    'pending_purchases',
                    'psk.fk_prt_id',
                    '=',
                    'pending_purchases.fk_prt_id'
                )
                ->where('psk.fk_prt_id', $id)
                ->orderByDesc('whs.whs_is_default')
                ->orderBy('whs.whs_label')
                ->get();

            // Calcul des totaux
            $stockTotal = $warehouseStocks->sum('psk_qty_physical');
            $stockVirtuelTotal = $warehouseStocks->sum('psk_qty_virtual');
            $totalALivrer = $warehouseStocks->sum('qty_pending_delivery');
            $totalARecevoir = $warehouseStocks->sum('qty_pending_reception');

            return response()->json([
                'success' => true,
                'data' => [
                    'stock_total' => (float) $stockTotal,
                    'stock_virtuel_total' => (float) $stockVirtuelTotal,
                    'total_a_livrer' => (float) $totalALivrer,
                    'total_a_recevoir' => (float) $totalARecevoir,
                    'warehouse_stocks' => $warehouseStocks->map(function ($stock) {
                        return [
                            'psk_id' => $stock->psk_id,
                            'whs_code' => $stock->whs_code,
                            'whs_label' => $stock->whs_label,
                            'psk_qty_physical' => (float) $stock->psk_qty_physical,
                            'psk_qty_virtual' => (float) $stock->psk_qty_virtual,
                            'qty_pending_delivery' => (float) $stock->qty_pending_delivery,
                            'qty_pending_reception' => (float) $stock->qty_pending_reception,
                            'last_movement' => $stock->last_movement,
                        ];
                    })
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des données de stock',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
