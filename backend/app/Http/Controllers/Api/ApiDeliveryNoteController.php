<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Models\DeliveryNoteModel;
use App\Models\DeliveryNoteLineModel;
use App\Models\SaleOrderModel;
use App\Models\SaleOrderLineModel;
use App\Models\PurchaseOrderModel;
use App\Models\PurchaseOrderLineModel;
use App\Models\StockMovementModel;
use App\Models\WarehouseModel;
use App\Services\Pdf\DocumentPdfService;
use App\Services\StockService;


class ApiDeliveryNoteController
{

    /**
     * Liste des bons de livraison client
     */
    public function indexCustomer(Request $request): JsonResponse
    {
        return $this->index($request, DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY);
    }

    /**
     * Liste des bons de réception fournisseur
     */
    public function indexSupplier(Request $request): JsonResponse
    {
        return $this->index($request, DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY);
    }

    /**
     * Liste des bons selon le type d'opération
     */
    public function index(Request $request, int $operation): JsonResponse
    {
        $query = DeliveryNoteModel::from('delivery_note_dln as dln')
            ->leftJoin('partner_ptr as ptr', 'dln.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoin('contact_ctc as ctc', 'dln.fk_ctc_id', '=', 'ctc.ctc_id')
            // ->leftJoin('warehouse_whs as whs', 'dln.fk_whs_id', '=', 'whs.whs_id')
            ->select([
                'dln.dln_id as id',
                'dln.dln_number',
                'dln.dln_date',
                'dln.dln_expected_date',
                'dln.dln_status',
                'dln.dln_externalreference',
                'dln.dln_carrier',
                'dln.dln_tracking_number',
                'dln.dln_note',
                'ptr.ptr_id',
                'ptr.ptr_name',
                'ctc.ctc_firstname',
                'ctc.ctc_lastname',
                //   'whs.whs_label as warehouse_name',
                'dln.fk_ord_id',
                'dln.fk_por_id',
            ])
            ->where('dln.dln_operation', $operation);

        // Filtre par recherche
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('dln.dln_number', 'like', "%{$search}%")
                    ->orWhere('ptr.ptr_name', 'like', "%{$search}%")
                    ->orWhere('dln.dln_externalreference', 'like', "%{$search}%")
                    ->orWhere('dln.dln_carrier', 'like', "%{$search}%");
            });
        }

        // Filtre par statut
        if ($request->has('status') && $request->status !== null) {
            $query->where('dln.dln_status', $request->status);
        }

        // Filtre par partenaire
        if ($request->has('partner_id') && $request->partner_id) {
            $query->where('dln.fk_ptr_id', $request->partner_id);
        }

        // Filtre par dates
        if ($request->has('date_from') && $request->date_from) {
            $query->where('dln.dln_date', '>=', $request->date_from);
        }
        if ($request->has('date_to') && $request->date_to) {
            $query->where('dln.dln_date', '<=', $request->date_to . ' 23:59:59');
        }

        $total = $query->count();

        $sortBy    = $request->input('sort_by', 'dln_date');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

        $sortColumnMap = [
            'id'         => 'dln.dln_id',
            'dln_number' => 'dln.dln_number',
            'dln_date'   => 'dln.dln_date',
            'ptr_name'   => 'ptr.ptr_name',
        ];
        $sortColumn = $sortColumnMap[$sortBy] ?? 'dln.dln_date';

        $offset = (int) $request->input('offset', 0);
        $limit  = (int) $request->input('limit', 50);

        $data = $query->orderBy($sortColumn, $sortOrder)
            ->orderBy('dln.dln_id', 'DESC')
            ->skip($offset)
            ->take($limit)
            ->get();

        return response()->json([
            'data'  => $data,
            'total' => $total,
        ]);
    }

    /**
     * Récupérer un bon de livraison/réception
     */
    public function show($id): JsonResponse
    {
        $data = DeliveryNoteModel::withCount('documents')
            ->with([
                'partner:ptr_id,ptr_name',
                'warehouse:whs_id,whs_label',
                'contact' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("ctc_id, TRIM(CONCAT_WS(' ', ctc_firstname, ctc_lastname)) as label");
                },
            ])
            ->where('dln_id', $id)->firstOrFail();

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        // Vérifier si la commande parente est en cours d'édition
        $parentBeingEdited = false;
        if ($data->fk_ord_id) {
            $parentBeingEdited = (bool) SaleOrderModel::where('ord_id', $data->fk_ord_id)->value('ord_being_edited');
        } elseif ($data->fk_por_id) {
            $parentBeingEdited = (bool) PurchaseOrderModel::where('por_id', $data->fk_por_id)->value('por_being_edited');
        }
        $data->parent_being_edited = $parentBeingEdited;

        return response()->json([
            'status' => true,
            'data' => $data
        ], 200);
    }

    /**
     * Créer un bon de livraison client
     */
    public function storeCustomer(Request $request): JsonResponse
    {
        return $this->store($request, DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY);
    }

    /**
     * Créer un bon de réception fournisseur
     */
    public function storeSupplier(Request $request): JsonResponse
    {
        return $this->store($request, DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY);
    }

    /**
     * Créer un bon de livraison/réception
     */
    private function store(Request $request, int $operation): JsonResponse
    {
        $validated = $request->validate([
            'fk_ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|integer|exists:contact_ctc,ctc_id',
            'fk_whs_id' => 'required|integer|exists:warehouse_whs,whs_id',
            'fk_ord_id' => 'nullable|integer|exists:sale_order_ord,ord_id',
            'fk_por_id' => 'nullable|integer|exists:purchase_order_por,por_id',
            'dln_date' => 'required|date',
            'dln_expected_date' => 'nullable|date',
            'dln_externalreference' => 'nullable|string|max:100',
            'dln_carrier' => 'nullable|string|max:100',
            'dln_tracking_number' => 'nullable|string|max:100',
            'dln_note' => 'nullable|string',
            'lines' => 'nullable|array',
        ]);

        try {
            DB::beginTransaction();

            $deliveryNote = new DeliveryNoteModel();
            $deliveryNote->dln_operation = $operation;
            $deliveryNote->dln_status = DeliveryNoteModel::STATUS_DRAFT;
            $deliveryNote->fk_ptr_id = $validated['fk_ptr_id'];
            $deliveryNote->fk_ctc_id = $validated['fk_ctc_id'] ?? null;
            $deliveryNote->fk_whs_id = $validated['fk_whs_id'];
            $deliveryNote->fk_ord_id = $validated['fk_ord_id'] ?? null;
            $deliveryNote->fk_por_id = $validated['fk_por_id'] ?? null;
            $deliveryNote->dln_date = $validated['dln_date'];
            $deliveryNote->dln_expected_date = $validated['dln_expected_date'] ?? null;
            $deliveryNote->dln_externalreference = $validated['dln_externalreference'] ?? null;
            $deliveryNote->dln_carrier = $validated['dln_carrier'] ?? null;
            $deliveryNote->dln_tracking_number = $validated['dln_tracking_number'] ?? null;
            $deliveryNote->dln_note = $validated['dln_note'] ?? null;

            $deliveryNote->save();

            // Créer les lignes si fournies
            if (!empty($validated['lines'])) {
                $this->saveLines($deliveryNote->dln_id, $validated['lines']);
            }

            DB::commit();

            return response()->json([
                'message' => 'Bon créé avec succès',
                'data' => $deliveryNote
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la création',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour un bon de livraison/réception
     */
    public function update(Request $request, $id): JsonResponse
    {
        $deliveryNote = DeliveryNoteModel::find($id);

        if (!$deliveryNote) {
            return response()->json(['message' => 'Bon non trouvé'], 404);
        }

        if ($deliveryNote->dln_status == DeliveryNoteModel::STATUS_VALIDATED) {
            return response()->json(['message' => 'Un bon validé ne peut pas être modifié'], 403);
        }

        $validated = $request->validate([
            'fk_ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|integer|exists:contact_ctc,ctc_id',
            'fk_whs_id' => 'required|integer|exists:warehouse_whs,whs_id',
            'dln_date' => 'required|date',
            'dln_expected_date' => 'nullable|date',
            'dln_externalreference' => 'nullable|string|max:100',
            'dln_carrier' => 'nullable|string|max:100',
            'dln_tracking_number' => 'nullable|string|max:100',
            'dln_note' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $deliveryNote->fk_ptr_id = $validated['fk_ptr_id'];
            $deliveryNote->fk_ctc_id = $validated['fk_ctc_id'] ?? null;
            $deliveryNote->fk_whs_id = $validated['fk_whs_id'];
            $deliveryNote->dln_date = $validated['dln_date'];
            $deliveryNote->dln_expected_date = $validated['dln_expected_date'] ?? null;
            $deliveryNote->dln_externalreference = $validated['dln_externalreference'] ?? null;
            $deliveryNote->dln_carrier = $validated['dln_carrier'] ?? null;
            $deliveryNote->dln_tracking_number = $validated['dln_tracking_number'] ?? null;
            $deliveryNote->dln_note = $validated['dln_note'] ?? null;

            $deliveryNote->save();

            DB::commit();

            return response()->json([
                'message' => 'Bon mis à jour avec succès',
                'data' => $deliveryNote
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la mise à jour',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un bon de livraison/réception
     */
    public function destroy($id): JsonResponse
    {
        $deliveryNote = DeliveryNoteModel::find($id);

        if (!$deliveryNote) {
            return response()->json(['message' => 'Bon non trouvé'], 404);
        }

        if ($deliveryNote->dln_status == DeliveryNoteModel::STATUS_VALIDATED) {
            return response()->json(['message' => 'Un bon validé ne peut pas être supprimé'], 403);
        }

        try {
            DB::beginTransaction();

            // Supprimer les lignes d'abord
            DeliveryNoteLineModel::where('fk_dln_id', $id)->delete();

            // Supprimer le bon
            $deliveryNote->delete();

            DB::commit();

            return response()->json(['message' => 'Bon supprimé avec succès']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la suppression',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupérer les lignes d'un bon
     */
    public function getLines($id): JsonResponse
    {
        $lines = DeliveryNoteLineModel::query()
            ->where('fk_dln_id', $id)
            ->with(['product:prt_id,prt_ref,prt_type', 'saleOrderLine', 'purchaseOrderLine'])
            ->withSum(['allDeliveriesBySaleOrder as qty_delivered_sum' => function ($query) {
                $query->whereHas('deliveryNote', function ($q) {
                    $q->where('dln_status', DeliveryNoteModel::STATUS_VALIDATED);
                });
            }], 'dnl_qty')
            ->withSum(['allDeliveriesByPurchaseOrder as qty_received_sum' => function ($query) {
                $query->whereHas('deliveryNote', function ($q) {
                    $q->where('dln_status', DeliveryNoteModel::STATUS_VALIDATED);
                });
            }], 'dnl_qty')
            ->orderBy('dnl_order')
            ->get();

        // On formate la réponse pour correspondre à tes besoins
        $data = $lines->map(function ($line) {
            return [
                'id' => $line->dnl_id,
                'dnl_order' => $line->dnl_order,
                'dnl_type' => $line->dnl_type,
                'fk_prt_id' => $line->fk_prt_id,
                'prt_ref' => $line->product->prt_ref ?? null,
                'prt_type' => $line->product->prt_type ?? null,
                'dnl_prtlib' => $line->dnl_prtlib,
                'dnl_prtdesc' => $line->dnl_prtdesc,
                'dnl_qty' => $line->dnl_qty,
                'dnl_lot_number' => $line->dnl_lot_number,
                'dnl_serial_number' => $line->dnl_serial_number,
                'fk_orl_id' => $line->fk_orl_id,
                'fk_pol_id' => $line->fk_pol_id,
                'qty_ordered' => $line->saleOrderLine->orl_qty ?? $line->purchaseOrderLine->pol_qty ?? 0,
                'qty_already_delivered' => $line->qty_delivered_sum ?? $line->qty_received_sum ?? 0,
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * Sauvegarder une ligne
     */
    public function saveLine($dlnId, Request $request): JsonResponse
    {
        $deliveryNote = DeliveryNoteModel::find($dlnId);

        if (!$deliveryNote) {
            return response()->json(['message' => 'Bon non trouvé'], 404);
        }

        if ($deliveryNote->dln_status == DeliveryNoteModel::STATUS_VALIDATED) {
            return response()->json(['message' => 'Un bon validé ne peut pas être modifié'], 403);
        }

        $validated = $request->validate([
            'dnl_id' => 'nullable|integer',
            'dnl_qty' => 'required|numeric|min:0',
            'dnl_lot_number' => 'nullable|string|max:255',
            'dnl_serial_number' => 'nullable|string|max:255',
        ]);

        try {
            DB::beginTransaction();

            if (!empty($validated['dnl_id'])) {
                $line = DeliveryNoteLineModel::find($validated['dnl_id']);
                if (!$line) {
                    return response()->json(['message' => 'Ligne non trouvée'], 404);
                }
            } else {
                $line = new DeliveryNoteLineModel();
                $line->fk_dln_id = $dlnId;

                // Calculer l'ordre de la nouvelle ligne
                $maxOrder = DeliveryNoteLineModel::where('fk_dln_id', $dlnId)->max('dnl_order') ?? 0;
                $line->dnl_order = $maxOrder + 1;
            }


            $line->dnl_qty = $validated['dnl_qty'];
            $line->dnl_lot_number = $validated['dnl_lot_number'] ?? null;
            $line->dnl_serial_number = $validated['dnl_serial_number'] ?? null;

            $line->save();

            DB::commit();

            return response()->json([
                'message' => 'Ligne sauvegardée avec succès',
                'data' => $line
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la sauvegarde',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer une ligne
     */
    public function deleteLine($dlnId, $lineId): JsonResponse
    {
        $deliveryNote = DeliveryNoteModel::find($dlnId);

        if (!$deliveryNote) {
            return response()->json(['message' => 'Bon non trouvé'], 404);
        }

        if ($deliveryNote->dln_status == DeliveryNoteModel::STATUS_VALIDATED) {
            return response()->json(['message' => 'Un bon validé ne peut pas être modifié'], 403);
        }

        $line = DeliveryNoteLineModel::where('dnl_id', $lineId)
            ->where('fk_dln_id', $dlnId)
            ->first();

        if (!$line) {
            return response()->json(['message' => 'Ligne non trouvée'], 404);
        }

        try {
            $line->delete();
            return response()->json(['message' => 'Ligne supprimée avec succès']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la suppression',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Valider un bon de livraison/réception
     */
    public function validate($id): JsonResponse
    {
        $deliveryNote = DeliveryNoteModel::find($id);

        if (!$deliveryNote) {
            return response()->json(['message' => 'Bon non trouvé'], 404);
        }

        if ($deliveryNote->dln_status == DeliveryNoteModel::STATUS_VALIDATED) {
            return response()->json(['message' => 'Ce bon est déjà validé'], 400);
        }

        // Vérifier que la commande parente n'est pas en cours d'édition
        if ($deliveryNote->fk_ord_id) {
            $saleOrder = SaleOrderModel::find($deliveryNote->fk_ord_id);
            if ($saleOrder && $saleOrder->ord_being_edited) {
                return response()->json(['message' => 'La commande client liée est en cours de modification. Veuillez attendre la fin de l\'édition avant de valider ce bon.'], 400);
            }
        }
        if ($deliveryNote->fk_por_id) {
            $purchaseOrder = PurchaseOrderModel::find($deliveryNote->fk_por_id);
            if ($purchaseOrder && $purchaseOrder->por_being_edited) {
                return response()->json(['message' => 'La commande fournisseur liée est en cours de modification. Veuillez attendre la fin de l\'édition avant de valider ce bon.'], 400);
            }
        }

        // Vérifier qu'il y a au moins une ligne
        $linesCount = DeliveryNoteLineModel::where('fk_dln_id', $id)->count();
        if ($linesCount == 0) {
            return response()->json(['message' => 'Le bon doit contenir au moins une ligne'], 400);
        }

        try {
            DB::beginTransaction();

            // Valider le bon
            $deliveryNote->dln_status = DeliveryNoteModel::STATUS_VALIDATED;
            $deliveryNote->save();

            // Créer les mouvements de stock
            $this->createStockMovements($deliveryNote);

            // Mettre à jour l'état de livraison de la commande
            $remainderNote = null;
            if ($deliveryNote->dln_operation == DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY && $deliveryNote->fk_ord_id) {
                $this->updateSaleOrderDeliveryState($deliveryNote->fk_ord_id);
                // Auto-générer un BL brouillon pour le reliquat
                $order = SaleOrderModel::find($deliveryNote->fk_ord_id);
                if ($order) {
                    self::autoGenerateFromSaleOrder($order);
                    $remainderNote = DeliveryNoteModel::where('fk_ord_id', $order->ord_id)
                        ->where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
                        ->where('dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
                        ->first();
                }
            } elseif ($deliveryNote->dln_operation == DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY && $deliveryNote->fk_por_id) {
                $this->updatePurchaseOrderDeliveryState($deliveryNote->fk_por_id);            
                // Auto-générer un BR brouillon pour le reliquat
                $order = PurchaseOrderModel::find($deliveryNote->fk_por_id);
                if ($order) {
                    self::autoGenerateFromPurchaseOrder($order);
                    $remainderNote = DeliveryNoteModel::where('fk_por_id', $order->por_id)
                        ->where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
                        ->where('dln_operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
                        ->first();
                }
            }

            DB::commit();

            $response = [
                'message' => 'Bon validé avec succès',
                'data' => $deliveryNote
            ];
            if ($remainderNote) {
                $response['remainder_note'] = $remainderNote;
                $response['message'] = 'Bon validé avec succès. Un nouveau bon brouillon a été créé pour le reliquat.';
            }

            return response()->json($response);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la validation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Créer les mouvements de stock à la validation
     */
    private function createStockMovements(DeliveryNoteModel $deliveryNote): void
    {
        // Eager loading du produit pour éviter les requêtes N+1
        $lines = $deliveryNote->lines()
            ->with('product')
            ->where('dnl_type', 0)
            ->whereNotNull('fk_prt_id')
            ->whereHas('product', function ($q) {
                $q->where('prt_type', 'conso') // Type stockable
                    ->where('prt_stockable', 1); // Gestion stock activée
            })
            ->get();

        $isSupplier = $deliveryNote->dln_operation == DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY;
        $direction  = $isSupplier ? 1 : -1;
        $docType    = $isSupplier ? 'reception' : 'delivery';
        $label      = $isSupplier ? 'Réception fournisseur' : 'Livraison client';

        // Note : Il vaut mieux injecter le service dans le constructeur, 
        // mais si tu restes ainsi, utilise au moins l'instance :
        $stockService = app(StockService::class);

        foreach ($lines as $line) {
            $stockService->createMovement([
                'fk_prt_id'           => $line->fk_prt_id,
                'fk_whs_id'           => $deliveryNote->fk_whs_id,
                'stm_direction'       => $direction,
                'stm_qty'             => $line->dnl_qty,
                'stm_date'            => $deliveryNote->dln_date,
                'stm_label'           => $label,
                'stm_origin_doc_type' => $docType,
                'stm_origin_doc_ref'  => $deliveryNote->dln_number,
                'stm_lot_number'      => $line->dnl_lot_number,
                'fk_dln_id'           => $deliveryNote->dln_id,
            ], $line->product); // On passe l'objet product déjà chargé !
        }
    }

    /**
     * Mettre à jour l'état de livraison d'une commande client
     */
    private function updateSaleOrderDeliveryState(int $ordId): void
    {
        $result = DB::table('sale_order_line_orl as orl')
            ->leftJoin('delivery_note_line_dnl as dnl', 'orl.orl_id', '=', 'dnl.fk_orl_id')
            ->leftJoin('delivery_note_dln as dln', function ($join) {
                $join->on('dnl.fk_dln_id', '=', 'dln.dln_id')
                    ->where('dln.dln_status', '=', DeliveryNoteModel::STATUS_VALIDATED);
            })
            ->where('orl.fk_ord_id', $ordId)
            ->where('orl.orl_type', 0)
            ->select([
                DB::raw('SUM(orl.orl_qty) as total_ordered'),
                DB::raw('COALESCE(SUM(dnl.dnl_qty), 0) as total_delivered')
            ])
            ->first();

        $deliveryState = 0; // Non livré
        if ($result && $result->total_delivered > 0) {
            if ($result->total_delivered >= $result->total_ordered) {
                $deliveryState = 2; // Entièrement livré
            } else {
                $deliveryState = 1; // Partiellement livré
            }
        }

        SaleOrderModel::where('ord_id', $ordId)->update(['ord_delivery_state' => $deliveryState]);
    }

    /**
     * Mettre à jour l'état de réception d'une commande fournisseur
     */
    private function updatePurchaseOrderDeliveryState(int $porId): void
    {
        
        $result = DB::table('purchase_order_line_pol as pol')
            ->leftJoin('delivery_note_line_dnl as dnl', 'pol.pol_id', '=', 'dnl.fk_pol_id')
            ->leftJoin('delivery_note_dln as dln', function ($join) {
                $join->on('dnl.fk_dln_id', '=', 'dln.dln_id')
                    ->where('dln.dln_status', '=', DeliveryNoteModel::STATUS_VALIDATED);
            })
            ->where('pol.fk_por_id', $porId)
            ->where('pol.pol_type', 0)
            ->select([
                DB::raw('SUM(pol.pol_qty) as total_ordered'),
                DB::raw('COALESCE(SUM(dnl.dnl_qty), 0) as total_received')
            ])
            ->first();

        $deliveryState = 0; // Non reçu
        if ($result && $result->total_received > 0) {
            if ($result->total_received >= $result->total_ordered) {
                $deliveryState = 2; // Entièrement reçu
            } else {
                $deliveryState = 1; // Partiellement reçu
            }
        }

        PurchaseOrderModel::where('por_id', $porId)->update(['por_delivery_state' => $deliveryState]);
    }

    /**
     * Récupérer les produits restant à livrer d'une commande client
     */
    public function getProductsToDeliver($orderId): JsonResponse
    {
        $products = DB::table('sale_order_line_orl as orl')
            ->leftJoin('product_prt as prt', 'orl.fk_prt_id', '=', 'prt.prt_id')
            ->leftJoin('delivery_note_line_dnl as dnl', 'orl.orl_id', '=', 'dnl.fk_orl_id')
            ->leftJoin('delivery_note_dln as dln', function ($join) {
                $join->on('dnl.fk_dln_id', '=', 'dln.dln_id')
                    ->where('dln.dln_status', '=', DeliveryNoteModel::STATUS_VALIDATED);
            })
            ->where('orl.fk_ord_id', $orderId)
            ->where('orl.orl_type', 0)
            ->select([
                'orl.orl_id as id',
                'orl.fk_prt_id',
                'prt.prt_ref',
                'orl.orl_prtlib as product_label',
                'orl.orl_prtdesc as product_desc',
                'orl.orl_qty as qty_ordered',
                DB::raw('COALESCE(SUM(dnl.dnl_qty), 0) as qty_delivered'),
                DB::raw('orl.orl_qty - COALESCE(SUM(dnl.dnl_qty), 0) as qty_remaining')
            ])
            ->groupBy('orl.orl_id', 'orl.fk_prt_id', 'prt.prt_ref', 'orl.orl_prtlib', 'orl.orl_prtdesc', 'orl.orl_qty')
            ->havingRaw('qty_remaining > 0')
            ->orderBy('orl.orl_order')
            ->get();

        return response()->json(['data' => $products]);
    }

    /**
     * Récupérer les produits restant à réceptionner d'une commande fournisseur
     */
    public function getProductsToReceive($porId): JsonResponse
    {
        $products = DB::table('purchase_order_line_pol as pol')
            ->leftJoin('product_prt as prt', 'pol.fk_prt_id', '=', 'prt.prt_id')
            ->leftJoin('delivery_note_line_dnl as dnl', 'pol.pol_id', '=', 'dnl.fk_pol_id')
            ->leftJoin('delivery_note_dln as dln', function ($join) {
                $join->on('dnl.fk_dln_id', '=', 'dln.dln_id')
                    ->where('dln.dln_status', '=', DeliveryNoteModel::STATUS_VALIDATED);
            })
            ->where('pol.fk_por_id', $porId)
            ->where('pol.pol_type', 0)
            ->select([
                'pol.pol_id as id',
                'pol.fk_prt_id',
                'prt.prt_ref',
                'pol.pol_prtlib as product_label',
                'pol.pol_prtdesc as product_desc',
                'pol.pol_qty as qty_ordered',
                DB::raw('COALESCE(SUM(dnl.dnl_qty), 0) as qty_received'),
                DB::raw('pol.pol_qty - COALESCE(SUM(dnl.dnl_qty), 0) as qty_remaining')
            ])
            ->groupBy('pol.pol_id', 'pol.fk_prt_id', 'prt.prt_ref', 'pol.pol_prtlib', 'pol.pol_prtdesc', 'pol.pol_qty')
            ->havingRaw('qty_remaining > 0')
            ->orderBy('pol.pol_order')
            ->get();

        return response()->json(['data' => $products]);
    }

    /**
     * Sauvegarder plusieurs lignes
     */
    private function saveLines(int $dlnId, array $lines): void
    {
        $order = 1;
        foreach ($lines as $lineData) {
            $line = new DeliveryNoteLineModel();
            $line->fk_dln_id = $dlnId;
            $line->dnl_order = $order++;
            $line->dnl_type = $lineData['dnl_type'] ?? 0;
            $line->fk_prt_id = $lineData['fk_prt_id'] ?? null;
            $line->dnl_prtlib = $lineData['dnl_prtlib'] ?? '';
            $line->dnl_prtdesc = $lineData['dnl_prtdesc'] ?? null;
            $line->dnl_prttype = $lineData['prt_type'] ?? null;
            $line->dnl_qty = $lineData['dnl_qty'] ?? 0;
            $line->dnl_lot_number = $lineData['dnl_lot_number'] ?? null;
            $line->fk_orl_id = $lineData['fk_orl_id'] ?? null;
            $line->fk_pol_id = $lineData['fk_pol_id'] ?? null;
            $line->save();
        }
    }


    /**
     * Générer et retourner le PDF d'un bon de livraison/réception
     */
    public function printPdf($id): JsonResponse
    {
        try {
            $pdfService = new DocumentPdfService();
            $pdfBase64 = $pdfService->generateDeliveryNotePdf($id);

            $deliveryNote = DeliveryNoteModel::findOrFail($id);
            $prefix = $deliveryNote->dln_operation == DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY ? 'BL_' : 'BR_';
            $fileName = $prefix . $deliveryNote->dln_number . '.pdf';

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
     * Retourner le nombre de BL/BR brouillons
     * GET /api/delivery-notes/draft-counts
     */
    public function getDraftCounts(): JsonResponse
    {
        $customerDrafts = DeliveryNoteModel::where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
            ->where('dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
            ->count();

        $supplierDrafts = DeliveryNoteModel::where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
            ->where('dln_operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
            ->count();

        return response()->json([
            'customer_drafts' => $customerDrafts,
            'supplier_drafts' => $supplierDrafts,
        ]);
    }

    /**
     * Récupérer les objets liés à un bon de livraison/réception
     */
    public function getLinkedObjects($id): JsonResponse
    {
        try {
            $deliveryNote = DeliveryNoteModel::find($id);

            if (!$deliveryNote) {
                return response()->json(['success' => false, 'message' => 'Bon non trouvé'], 404);
            }

            $linkedObjects = collect();

            // Commande client liée
            if ($deliveryNote->fk_ord_id) {
                $saleOrders = DB::table('sale_order_ord')
                    ->leftJoin('partner_ptr', 'sale_order_ord.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                    ->where('ord_id', $deliveryNote->fk_ord_id)
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

                $linkedObjects = $linkedObjects->concat($saleOrders);
            }

            // Commande fournisseur liée
            if ($deliveryNote->fk_por_id) {
                $purchaseOrders = DB::table('purchase_order_por')
                    ->leftJoin('partner_ptr', 'purchase_order_por.fk_ptr_id', '=', 'partner_ptr.ptr_id')
                    ->where('por_id', $deliveryNote->fk_por_id)
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

                $linkedObjects = $linkedObjects->concat($purchaseOrders);
            }

            return response()->json([
                'success' => true,
                'data' => $linkedObjects->values(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des objets liés: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Auto-génération d'un BL brouillon à la confirmation d'une commande client.
     * Si un BL brouillon existe déjà pour cette commande, on le met à jour.
     */
    public static function autoGenerateFromSaleOrder(SaleOrderModel $order): void
    {
       
        try {
            $orderLines = DB::table('sale_order_line_orl as orl')
                ->leftJoin('product_prt as prt', 'fk_prt_id', '=', 'prt.prt_id')
                ->leftJoin(DB::raw('(
                    SELECT dnl.fk_orl_id, SUM(dnl.dnl_qty) as qty_received
                    FROM delivery_note_line_dnl dnl
                    INNER JOIN delivery_note_dln dln ON dnl.fk_dln_id = dln.dln_id
                    WHERE dln.dln_status = ' . DeliveryNoteModel::STATUS_VALIDATED . '
                    AND dln.dln_operation = ' . DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY . '
                    GROUP BY dnl.fk_orl_id
                ) as received'), 'orl_id', '=', 'received.fk_orl_id')
                ->where('fk_ord_id', $order->ord_id)
                ->where('orl_type', 0) // Lignes produit uniquement
                ->whereNotNull('fk_prt_id')
                ->select([
                    'orl_id',
                    'fk_prt_id',
                    'orl_prtlib',
                    'orl_prtdesc',
                    'orl_prttype',
                    'orl_qty',
                    'orl_order',
                    DB::raw('COALESCE(received.qty_received, 0) as qty_received'),
                    DB::raw('orl_qty - COALESCE(received.qty_received, 0) as qty_remaining'),
                ])
                ->havingRaw('qty_remaining > 0')
                ->orderBy('orl_order')
                ->get();

            // Chercher un BR brouillon existant pour cette commande
            $existingDraft = DeliveryNoteModel::where('fk_ord_id', $order->ord_id)
                ->where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
                ->where('dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
                ->first();

            // Si aucune ligne restante, ne pas créer de BR et marquer la commande comme entièrement reçue
            if ($orderLines->isEmpty()) {
                if ($existingDraft) {
                    DeliveryNoteLineModel::where('fk_dln_id', $existingDraft->dln_id)->delete();
                    $existingDraft->delete();
                }
                $order->ord_delivery_state = PurchaseOrderModel::RECEPTION_FULLY;
                $order->save();
                return;
            }

            if ($existingDraft) {
                // Supprimer les lignes existantes et les recréer
                DeliveryNoteLineModel::where('fk_dln_id', $existingDraft->dln_id)->delete();
                $deliveryNote = $existingDraft;
            } else {
                // Créer un nouveau BR brouillon
                $defaultWarehouse = WarehouseModel::default()->first();

                $deliveryNote = new DeliveryNoteModel();
                $deliveryNote->dln_operation = DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY;
                $deliveryNote->dln_status = DeliveryNoteModel::STATUS_DRAFT;
                $deliveryNote->fk_ptr_id = $order->fk_ptr_id;
                $deliveryNote->fk_ctc_id = $order->fk_ctc_id ?? null;
                $deliveryNote->fk_ord_id = $order->ord_id;
                $deliveryNote->fk_whs_id = $order->fk_whs_id ?? ($defaultWarehouse ? $defaultWarehouse->whs_id : null);
                $deliveryNote->dln_date = now()->format('Y-m-d');
                $deliveryNote->save();
            }

            // Créer les lignes du BR
            $lineOrder = 1;
            foreach ($orderLines as $line) {
                $dnlLine = new DeliveryNoteLineModel();
                $dnlLine->fk_dln_id = $deliveryNote->dln_id;
                $dnlLine->dnl_order = $lineOrder++;
                $dnlLine->dnl_type = 0;
                $dnlLine->fk_prt_id = $line->fk_prt_id;
                $dnlLine->dnl_prtlib = $line->orl_prtlib;
                $dnlLine->dnl_prtdesc = $line->orl_prtdesc;
                $dnlLine->dnl_prttype = $line->orl_prttype;
                $dnlLine->dnl_qty = $line->qty_remaining;
                $dnlLine->fk_orl_id = $line->orl_id;
                $dnlLine->save();
            }
        } catch (\Exception $e) {
            var_dump($e);
            throw $e;
            //\Log::error('Auto-génération BR échouée pour commande ' . $order->ord_id . ': ' . $e->getMessage());
        }
    }

    /**
     * Auto-génération d'un BR brouillon à la confirmation d'une commande fournisseur.
     * Si un BR brouillon existe déjà pour cette commande, on le met à jour.
     */
    public static function autoGenerateFromPurchaseOrder(PurchaseOrderModel $order): void
    {
        try {
            // Récupérer les lignes de commande avec les quantités déjà reçues (BR validés)
            $orderLines = DB::table('purchase_order_line_pol as pol')
                ->leftJoin('product_prt as prt', 'pol.fk_prt_id', '=', 'prt.prt_id')
                ->leftJoin(DB::raw('(
                    SELECT dnl.fk_pol_id, SUM(dnl.dnl_qty) as qty_received
                    FROM delivery_note_line_dnl dnl
                    INNER JOIN delivery_note_dln dln ON dnl.fk_dln_id = dln.dln_id
                    WHERE dln.dln_status = ' . DeliveryNoteModel::STATUS_VALIDATED . '
                    AND dln.dln_operation = ' . DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY . '
                    GROUP BY dnl.fk_pol_id
                ) as received'), 'pol.pol_id', '=', 'received.fk_pol_id')
                ->where('pol.fk_por_id', $order->por_id)
                ->where('pol.pol_type', 0) // Lignes produit uniquement
                ->whereNotNull('pol.fk_prt_id')
                ->select([
                    'pol.pol_id',
                    'pol.fk_prt_id',
                    'pol.pol_prtlib',
                    'pol.pol_prtdesc',
                    'pol.pol_prttype',
                    'pol.pol_qty',
                    'pol.pol_order',
                    DB::raw('COALESCE(received.qty_received, 0) as qty_received'),
                    DB::raw('pol.pol_qty - COALESCE(received.qty_received, 0) as qty_remaining'),
                ])
                ->havingRaw('qty_remaining > 0')
                ->orderBy('pol.pol_order')
                ->get();

            // Chercher un BR brouillon existant pour cette commande
            $existingDraft = DeliveryNoteModel::where('fk_por_id', $order->por_id)
                ->where('dln_status', DeliveryNoteModel::STATUS_DRAFT)
                ->where('dln_operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
                ->first();

            // Si aucune ligne restante, ne pas créer de BR et marquer la commande comme entièrement reçue
            if ($orderLines->isEmpty()) {
                if ($existingDraft) {
                    DeliveryNoteLineModel::where('fk_dln_id', $existingDraft->dln_id)->delete();
                    $existingDraft->delete();
                }
                $order->por_delivery_state = PurchaseOrderModel::RECEPTION_FULLY;
                $order->save();
                return;
            }

            if ($existingDraft) {
                // Supprimer les lignes existantes et les recréer
                DeliveryNoteLineModel::where('fk_dln_id', $existingDraft->dln_id)->delete();
                $deliveryNote = $existingDraft;
            } else {
                // Créer un nouveau BR brouillon
                $defaultWarehouse = WarehouseModel::default()->first();

                $deliveryNote = new DeliveryNoteModel();
                $deliveryNote->dln_operation = DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY;
                $deliveryNote->dln_status = DeliveryNoteModel::STATUS_DRAFT;
                $deliveryNote->fk_ptr_id = $order->fk_ptr_id;
                $deliveryNote->fk_ctc_id = $order->fk_ctc_id ?? null;
                $deliveryNote->fk_por_id = $order->por_id;
                $deliveryNote->fk_whs_id = $order->fk_whs_id ?? ($defaultWarehouse ? $defaultWarehouse->whs_id : null);
                $deliveryNote->dln_date = now()->format('Y-m-d');
                $deliveryNote->save();
            }

            // Créer les lignes du BR
            $lineOrder = 1;
            foreach ($orderLines as $line) {
                $dnlLine = new DeliveryNoteLineModel();
                $dnlLine->fk_dln_id = $deliveryNote->dln_id;
                $dnlLine->dnl_order = $lineOrder++;
                $dnlLine->dnl_type = 0;
                $dnlLine->fk_prt_id = $line->fk_prt_id;
                $dnlLine->dnl_prtlib = $line->pol_prtlib;
                $dnlLine->dnl_prtdesc = $line->pol_prtdesc;
                $dnlLine->dnl_prttype = $line->pol_prttype;
                $dnlLine->dnl_qty = $line->qty_remaining;
                $dnlLine->fk_pol_id = $line->pol_id;
                $dnlLine->save();
            }
        } catch (\Exception $e) {
            throw $e;
            //\Log::error('Auto-génération BR échouée pour commande ' . $order->por_id . ': ' . $e->getMessage());
        }
    }
}
