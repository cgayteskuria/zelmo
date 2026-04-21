<?php

namespace App\Services;

use App\Models\StockMovementModel;
use App\Models\ProductStockModel;
use App\Models\ProductModel;
use App\Models\DeliveryNoteModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class StockService
{
    /**
     * @param array $data
     * @param ProductModel|null $product
     * @return StockMovementModel|null
     */
    public function createMovement(array $data, ?ProductModel $product = null): ?StockMovementModel
    {
        // Si le produit n'est pas passé, on va le chercher
        if (!$product) {
            $product = ProductModel::find($data['fk_prt_id']);
        }

        // Sécurité : si pas de produit ou pas stockable, on sort proprement
        if (!$product || !$product->prt_stockable) {
            return null;
        }

        return DB::transaction(function () use ($data) {
            $movement = new StockMovementModel();
            $movement->fill($data);
            $movement->fk_usr_id_author = Auth::id();
            $movement->save();

            $realQty = $movement->stm_qty * $movement->stm_direction;

            $stock = ProductStockModel::firstOrNew([
                'fk_prt_id' => $movement->fk_prt_id,
                'fk_whs_id' => $movement->fk_whs_id,
            ]);

            $stock->psk_qty_physical += $realQty;
            $stock->psk_last_movement_date = now();
            $stock->fk_usr_id_updater = Auth::id();
            $stock->save();

            // Mise à jour du stock virtuel après modification du stock physique
            $this->updateVirtualStock($movement->fk_prt_id, $movement->fk_whs_id);


            return $movement;
        });
    }

    /**
     * Calcule et met à jour le stock virtuel pour un produit dans un entrepôt
     * Stock virtuel = Stock physique + BL fournisseurs non validés - BL clients non validés
     * 
     * @param int $productId
     * @param int $warehouseId
     * @return void
     */
    public function updateVirtualStock(int $productId, int $warehouseId): void
    {
        DB::transaction(function () use ($productId, $warehouseId) {
            $stock = ProductStockModel::firstOrNew([
                'fk_prt_id' => $productId,
                'fk_whs_id' => $warehouseId,
            ]);

            // Stock physique actuel
            $physicalStock = $stock->psk_qty_physical ?? 0;

            // BL fournisseurs non validés (augmente le stock virtuel)
            $pendingSupplierDeliveries = DB::table('delivery_note_dln')
                ->join('delivery_note_line_dnl', 'delivery_note_dln.dln_id', '=', 'delivery_note_line_dnl.fk_dln_id')
                ->where('delivery_note_dln.fk_whs_id', $warehouseId)
                ->where('delivery_note_dln.dln_operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
                ->where('delivery_note_dln.dln_status', DeliveryNoteModel::STATUS_DRAFT)
                ->where('delivery_note_line_dnl.fk_prt_id', $productId)
                ->sum('delivery_note_line_dnl.dnl_qty');

            // BL clients non validés (diminue le stock virtuel)
            $pendingCustomerDeliveries = DB::table('delivery_note_dln')
                ->join('delivery_note_line_dnl', 'delivery_note_dln.dln_id', '=', 'delivery_note_line_dnl.fk_dln_id')
                ->where('delivery_note_dln.fk_whs_id', $warehouseId)
                ->where('delivery_note_dln.dln_operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
                ->where('delivery_note_dln.dln_status', DeliveryNoteModel::STATUS_DRAFT)
                ->where('delivery_note_line_dnl.fk_prt_id', $productId)
                ->sum('delivery_note_line_dnl.dnl_qty');

            // Calcul du stock virtuel
            $stock->psk_qty_virtual = $physicalStock + $pendingSupplierDeliveries - $pendingCustomerDeliveries;
            $stock->fk_usr_id_updater = Auth::id();
            $stock->save();
        });
    }
}
