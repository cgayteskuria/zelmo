<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\StockMovementModel;

class ApiStockMovementController extends Controller
{
    /**
     * Liste de tous les mouvements de stock
     * GET /api/stock-movements
     */
    public function index(Request $request)
    {
        $query = DB::table('stock_movement_stm as stm')
            ->join('product_prt as prt', 'stm.fk_prt_id', '=', 'prt.prt_id')
            ->leftJoin('warehouse_whs as whs', 'stm.fk_whs_id', '=', 'whs.whs_id')
            ->select([
                'stm.stm_id as id',
                'stm.stm_date',
                'stm.stm_ref',
                'stm.stm_direction',
                'stm.stm_label',
                'stm.stm_qty',
                'stm.stm_unit_price',
                'stm.stm_total_value',
                'stm.stm_origin_doc_type',
                'stm.stm_origin_doc_ref',
                'stm.stm_lot_number',
                'stm.stm_notes',
                'stm.fk_prt_id',
                'stm.fk_whs_id',
                'prt.prt_ref',
                'prt.prt_label',
                'whs.whs_label as warehouse_name'
            ]);

        // Filtre par recherche globale
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('prt.prt_ref', 'like', "%{$search}%")
                    ->orWhere('prt.prt_label', 'like', "%{$search}%")
                    ->orWhere('stm.stm_ref', 'like', "%{$search}%")
                    ->orWhere('stm.stm_label', 'like', "%{$search}%")
                    ->orWhere('stm.stm_origin_doc_ref', 'like', "%{$search}%");
            });
        }

        // Filtre par direction
        if ($request->has('direction') && $request->direction !== null) {
            $query->where('stm.stm_direction', $request->direction);
        }

        // Filtre par produit
        if ($request->has('product_id') && $request->product_id) {
            $query->where('stm.fk_prt_id', $request->product_id);
        }

        // Filtre par entrepôt
        if ($request->has('warehouse_id') && $request->warehouse_id) {
            $query->where('stm.fk_whs_id', $request->warehouse_id);
        }

        // Filtre par plage de dates
        if ($request->has('date_from') && $request->date_from) {
            $query->where('stm.stm_date', '>=', $request->date_from);
        }
        if ($request->has('date_to') && $request->date_to) {
            $query->where('stm.stm_date', '<=', $request->date_to . ' 23:59:59');
        }

        $total = $query->count();

        $sortBy    = $request->input('sort_by', 'stm_date');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id'       => 'stm.stm_id',
            'stm_date' => 'stm.stm_date',
            'stm_ref'  => 'stm.stm_ref',
            'prt_ref'  => 'prt.prt_ref',
        ];
        $sortColumn = $sortColumnMap[$sortBy] ?? 'stm.stm_date';
        $query->orderBy($sortColumn, $sortOrder)->orderBy('stm.stm_id', 'desc');

        $offset = (int) $request->input('offset', 0);
        $limit  = (int) $request->input('limit', 50);

        $movements = $query->skip($offset)->take($limit)->get();

        return response()->json([
            'data'  => $movements,
            'total' => $total,
        ]);
    }

    /**
     * Récupérer un mouvement de stock
     * GET /api/stock-movements/{id}
     */
    public function show($id)
    {
        $movement = DB::table('stock_movement_stm as stm')
            ->join('product_prt as prt', 'stm.fk_prt_id', '=', 'prt.prt_id')
            ->leftJoin('warehouse_whs as whs', 'stm.fk_whs_id', '=', 'whs.whs_id')
            ->select([
                'stm.*',
                'prt.prt_ref',
                'prt.prt_label',
                'whs.whs_label as warehouse_name'
            ])
            ->where('stm.stm_id', $id)
            ->first();

        if (!$movement) {
            return response()->json(['message' => 'Mouvement non trouvé'], 404);
        }

        return response()->json($movement);
    }

    /**
     * Créer un nouveau mouvement de stock
     * POST /api/stock-movements
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fk_prt_id' => 'required|integer|exists:product_prt,prt_id',
            'fk_whs_id' => 'required|integer|exists:warehouse_whs,whs_id',
            'stm_direction' => 'required|integer|in:1,-1',
            'stm_qty' => 'required|numeric|min:0.01',
            'stm_label' => 'required|string|max:255',
            'stm_date' => 'nullable|date',
            'stm_ref' => 'nullable|string|max:50',
            'stm_unit_price' => 'nullable|numeric|min:0',
            'stm_lot_number' => 'nullable|string|max:100',
            'stm_notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $movement = new StockMovementModel();        
            $movement->fk_prt_id = $validated['fk_prt_id'];
            $movement->fk_whs_id = $validated['fk_whs_id'];
            $movement->stm_direction = $validated['stm_direction'];
            $movement->stm_qty = $validated['stm_qty'];
            $movement->stm_label = $validated['stm_label'];
            $movement->stm_date = $validated['stm_date'] ?? now();
            $movement->stm_ref = $validated['stm_ref'] ?? null;
            $movement->stm_unit_price = $validated['stm_unit_price'] ?? null;
            $movement->stm_lot_number = $validated['stm_lot_number'] ?? null;
            $movement->stm_notes = $validated['stm_notes'] ?? null;
            $movement->stm_origin_doc_type = 'manual';

            // Calcul de la valeur totale
            if ($movement->stm_unit_price) {
                $movement->stm_total_value = $movement->stm_qty * $movement->stm_unit_price;
            }

            $movement->save();

            DB::commit();

            return response()->json([
                'message' => 'Mouvement de stock créé avec succès',
                'data' => $movement
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la création du mouvement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour un mouvement de stock
     * PUT /api/stock-movements/{id}
     */
    public function update(Request $request, $id)
    {
        $movement = StockMovementModel::find($id);

        if (!$movement) {
            return response()->json(['message' => 'Mouvement non trouvé'], 404);
        }

        // Vérifier que le mouvement est manuel (on ne peut pas modifier les mouvements automatiques)
        if ($movement->stm_origin_doc_type !== 'manual') {
            return response()->json([
                'message' => 'Seuls les mouvements manuels peuvent être modifiés'
            ], 403);
        }

        $validated = $request->validate([
            'fk_prt_id' => 'required|integer|exists:product_prt,prt_id',
            'fk_whs_id' => 'required|integer|exists:warehouse_whs,whs_id',
            'stm_direction' => 'required|integer|in:1,-1',
            'stm_qty' => 'required|numeric|min:0.01',
            'stm_label' => 'required|string|max:255',
            'stm_date' => 'nullable|date',
            'stm_ref' => 'nullable|string|max:50',
            'stm_unit_price' => 'nullable|numeric|min:0',
            'stm_lot_number' => 'nullable|string|max:100',
            'stm_notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $movement->fk_prt_id = $validated['fk_prt_id'];
            $movement->fk_whs_id = $validated['fk_whs_id'];
            $movement->stm_direction = $validated['stm_direction'];
            $movement->stm_qty = $validated['stm_qty'];
            $movement->stm_label = $validated['stm_label'];
            $movement->stm_date = $validated['stm_date'] ?? $movement->stm_date;
            $movement->stm_ref = $validated['stm_ref'] ?? null;
            $movement->stm_unit_price = $validated['stm_unit_price'] ?? null;
            $movement->stm_lot_number = $validated['stm_lot_number'] ?? null;
            $movement->stm_notes = $validated['stm_notes'] ?? null;

            // Recalcul de la valeur totale
            if ($movement->stm_unit_price) {
                $movement->stm_total_value = $movement->stm_qty * $movement->stm_unit_price;
            } else {
                $movement->stm_total_value = null;
            }

            $movement->save();

            DB::commit();

            return response()->json([
                'message' => 'Mouvement de stock mis à jour avec succès',
                'data' => $movement
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la mise à jour du mouvement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Créer un transfert inter-entrepôts
     * POST /api/stock-movements/transfer
     */
    public function transfer(Request $request)
    {
        $validated = $request->validate([
            'fk_prt_id' => 'required|integer|exists:product_prt,prt_id',
            'fk_whs_id' => 'required|integer|exists:warehouse_whs,whs_id',
            'fk_whs_dest_id' => 'required|integer|exists:warehouse_whs,whs_id|different:fk_whs_id',
            'stm_qty' => 'required|numeric|min:0.01',
            'stm_label' => 'required|string|max:255',
            'stm_date' => 'nullable|date',
            'stm_lot_number' => 'nullable|string|max:100',
        ]);

        try {
            DB::beginTransaction();

            // Mouvement de sortie (entrepôt source)
            $outMovement = new StockMovementModel();
            $outMovement->fk_prt_id = $validated['fk_prt_id'];
            $outMovement->fk_whs_id = $validated['fk_whs_id'];
            $outMovement->fk_whs_dest_id = $validated['fk_whs_dest_id'];
            $outMovement->stm_direction = -1;
            $outMovement->stm_qty = $validated['stm_qty'];
            $outMovement->stm_label = $validated['stm_label'];
            $outMovement->stm_date = $validated['stm_date'] ?? now();
            $outMovement->stm_lot_number = $validated['stm_lot_number'] ?? null;
            $outMovement->stm_origin_doc_type = 'transfer';
            $outMovement->save();

            // Mouvement d'entrée (entrepôt destination)
            $inMovement = new StockMovementModel();
            $inMovement->fk_prt_id = $validated['fk_prt_id'];
            $inMovement->fk_whs_id = $validated['fk_whs_dest_id'];
            $inMovement->fk_whs_dest_id = $validated['fk_whs_id'];
            $inMovement->stm_direction = 1;
            $inMovement->stm_qty = $validated['stm_qty'];
            $inMovement->stm_label = $validated['stm_label'];
            $inMovement->stm_date = $validated['stm_date'] ?? now();
            $inMovement->stm_lot_number = $validated['stm_lot_number'] ?? null;
            $inMovement->stm_origin_doc_type = 'transfer';
            $inMovement->save();

            // Lier les deux mouvements
            $outMovement->fk_stm_paired_id = $inMovement->stm_id;
            $outMovement->save();
            $inMovement->fk_stm_paired_id = $outMovement->stm_id;
            $inMovement->save();

            DB::commit();

            return response()->json([
                'message' => 'Transfert inter-entrepôts créé avec succès',
                'data' => [
                    'out_movement' => $outMovement,
                    'in_movement' => $inMovement,
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors du transfert',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un mouvement de stock
     * DELETE /api/stock-movements/{id}
     */
    public function destroy($id)
    {
        $movement = StockMovementModel::find($id);

        if (!$movement) {
            return response()->json(['message' => 'Mouvement non trouvé'], 404);
        }

        // Vérifier que le mouvement est manuel
        if ($movement->stm_origin_doc_type !== 'manual') {
            return response()->json([
                'message' => 'Seuls les mouvements manuels peuvent être supprimés'
            ], 403);
        }

        try {
            DB::beginTransaction();
            $movement->delete();
            DB::commit();

            return response()->json([
                'message' => 'Mouvement de stock supprimé avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Erreur lors de la suppression du mouvement',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
