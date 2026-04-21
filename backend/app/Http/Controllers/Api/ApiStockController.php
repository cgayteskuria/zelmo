<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use App\Models\DeliveryNoteModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiStockController extends Controller
{
    /**
     * Liste des stocks avec calcul de stock virtuel
     * GET /api/stocks
     */
    public function index(Request $request)
    {
        $query = DB::table('product_prt as prt')
            ->leftJoin('product_stock_psk as psk', 'prt.prt_id', '=', 'psk.fk_prt_id')
            
            // Sous-requête pour les livraisons en attente (BL brouillons client)
            ->leftJoin(DB::raw('(
                SELECT
                    dnl.fk_prt_id,
                    SUM(dnl.dnl_qty) as qty_pending
                FROM delivery_note_line_dnl dnl
                INNER JOIN delivery_note_dln dln ON dnl.fk_dln_id = dln.dln_id
                WHERE dln.dln_operation = 1 AND dln.dln_status = ' . DeliveryNoteModel::STATUS_DRAFT . '
                AND dnl.fk_prt_id IS NOT NULL
                GROUP BY dnl.fk_prt_id
            ) as pending_sales'), 'prt.prt_id', '=', 'pending_sales.fk_prt_id')

            // Sous-requête pour les réceptions en attente (BR brouillons fournisseur)
            ->leftJoin(DB::raw('(
                SELECT
                    dnl.fk_prt_id,
                    SUM(dnl.dnl_qty) as qty_pending
                FROM delivery_note_line_dnl dnl
                INNER JOIN delivery_note_dln dln ON dnl.fk_dln_id = dln.dln_id
                WHERE dln.dln_operation = 2 AND dln.dln_status = ' . DeliveryNoteModel::STATUS_DRAFT . '
                AND dnl.fk_prt_id IS NOT NULL
                GROUP BY dnl.fk_prt_id
            ) as pending_purchases'), 'prt.prt_id', '=', 'pending_purchases.fk_prt_id')

            // Sous-requête pour la dernière entrée de stock
            ->leftJoin(DB::raw('(
                SELECT fk_prt_id, MAX(stm_date) as last_entry_date
                FROM stock_movement_stm
                WHERE stm_direction = 1
                GROUP BY fk_prt_id
            ) as last_entry'), 'prt.prt_id', '=', 'last_entry.fk_prt_id')

            // Sous-requête pour la dernière sortie de stock
            ->leftJoin(DB::raw('(
                SELECT fk_prt_id, MAX(stm_date) as last_exit_date
                FROM stock_movement_stm
                WHERE stm_direction = -1
                GROUP BY fk_prt_id
            ) as last_exit'), 'prt.prt_id', '=', 'last_exit.fk_prt_id')

            ->select([
                'prt.prt_id as id',
                'prt.prt_ref',
                'prt.prt_label',
                'prt.prt_stock_alert_threshold',
                DB::raw('COALESCE(SUM(psk.psk_qty_physical), 0) as stock_physical'),
                DB::raw('COALESCE(SUM(psk.psk_qty_physical), 0)
                    - COALESCE(SUM(pending_sales.qty_pending), 0)
                    + COALESCE(SUM(pending_purchases.qty_pending), 0) as stock_virtual'),
                'last_entry.last_entry_date',
                'last_exit.last_exit_date',
            ])
            ->where('prt.prt_is_active', 1)
            ->where('prt.prt_type', 'conso') // Produits consommables (non-services)
            ->groupBy('prt.prt_id', 'prt.prt_ref', 'prt.prt_label', 'prt.prt_stock_alert_threshold', 'last_entry.last_entry_date', 'last_exit.last_exit_date')
            ->havingRaw('stock_physical != 0 OR stock_virtual != 0');

        // Filtres
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('prt.prt_ref', 'like', "%{$search}%")
                    ->orWhere('prt.prt_label', 'like', "%{$search}%");
            });
        }

        $filters = $request->input('filters', []);
        if (!empty($filters['prt_ref'])) {
            $query->where('prt.prt_ref', 'like', '%' . $filters['prt_ref'] . '%');
        }
        if (!empty($filters['prt_label'])) {
            $query->where('prt.prt_label', 'like', '%' . $filters['prt_label'] . '%');
        }

        $total = $query->count();

        $sortBy    = $request->input('sort_by', 'prt_ref');
        $sortOrder = strtoupper($request->input('sort_order', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id'        => 'prt.prt_id',
            'prt_ref'   => 'prt.prt_ref',
            'prt_label' => 'prt.prt_label',
        ];
        $sortColumn = $sortColumnMap[$sortBy] ?? 'prt.prt_ref';
        $query->orderBy($sortColumn, $sortOrder);

        $offset = (int) $request->input('offset', 0);
        $limit  = (int) $request->input('limit', 50);

        $stocks = $query->skip($offset)->take($limit)->get();

        return response()->json([
            'data'  => $stocks,
            'total' => $total,
        ]);
    }

    /**
     * Récupérer les informations de stock d'un produit
     * GET /api/stocks/{id}
     */
    public function show($id)
    {
        $stock = DB::table('product_prt as prt')
            ->leftJoin('product_stock_psk as psk', 'prt.prt_id', '=', 'psk.fk_prt_id')
            ->leftJoin('warehouse_whs as whs', 'psk.fk_whs_id', '=', 'whs.whs_id')
            ->select([
                'prt.prt_id',
                'prt.prt_ref',
                'prt.prt_label',
                'prt.prt_stock_alert_threshold',
                'psk.psk_qty_physical',              
                'psk.psk_average_price',
                'psk.psk_total_value',
                'whs.whs_label as warehouse_name'
            ])
            ->where('prt.prt_id', $id)
            ->first();

        if (!$stock) {
            return response()->json(['message' => 'Produit non trouvé'], 404);
        }

        return response()->json($stock);
    }

    /**
     * Récupérer les mouvements de stock d'un produit
     * GET /api/stocks/{id}/movements
     * Supporte les paramètres ServerTable : sort_by, sort_order, offset, limit, filters[]
     */
    public function getMovements(Request $request, $id)
    {
        $query = DB::table('stock_movement_stm as stm')
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
                'whs.whs_label as warehouse'
            ])
            ->where('stm.fk_prt_id', $id);

        // Filtres dynamiques via paramètre filters[]
        $filters = $request->input('filters', []);

        if (!empty($filters['stm_direction'])) {
            $direction = $filters['stm_direction'];
            if (is_array($direction)) {
                $query->whereIn('stm.stm_direction', $direction);
            } else {
                $query->where('stm.stm_direction', $direction);
            }
        }

        if (!empty($filters['stm_date_gte'])) {
            $query->where('stm.stm_date', '>=', $filters['stm_date_gte']);
        }
        if (!empty($filters['stm_date_lte'])) {
            $query->where('stm.stm_date', '<=', $filters['stm_date_lte'] . ' 23:59:59');
        }

        foreach (['stm_ref', 'stm_label', 'stm_origin_doc_ref', 'stm_lot_number'] as $col) {
            if (!empty($filters[$col])) {
                $query->where('stm.' . $col, 'LIKE', '%' . $filters[$col] . '%');
            }
        }
        if (!empty($filters['warehouse'])) {
            $query->where('whs.whs_label', 'LIKE', '%' . $filters['warehouse'] . '%');
        }

        $total = $query->count();

        // Tri
        $sortBy    = $request->input('sort_by', 'stm_date');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id'                 => 'stm.stm_id',
            'stm_date'           => 'stm.stm_date',
            'stm_ref'            => 'stm.stm_ref',
            'stm_direction'      => 'stm.stm_direction',
            'stm_label'          => 'stm.stm_label',
            'stm_qty'            => 'stm.stm_qty',
            'stm_unit_price'     => 'stm.stm_unit_price',
            'stm_total_value'    => 'stm.stm_total_value',
            'stm_origin_doc_ref' => 'stm.stm_origin_doc_ref',
            'stm_lot_number'     => 'stm.stm_lot_number',
            'warehouse'          => 'whs.whs_label',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'stm.stm_date';
        $query->orderBy($sortColumn, $sortOrder)->orderBy('stm.stm_id', 'desc');

        // Pagination
        $offset = (int) $request->input('offset', 0);
        $limit  = min((int) $request->input('limit', 50), 500);

        $movements = $query->skip($offset)->take($limit)->get();

        return response()->json([
            'data'  => $movements,
            'total' => $total,
        ]);
    }
}