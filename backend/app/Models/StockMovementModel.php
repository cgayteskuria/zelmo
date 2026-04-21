<?php

namespace App\Models;

class StockMovementModel extends BaseModel
{
    protected $table = 'stock_movement_stm';
    protected $primaryKey = 'stm_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'stm_created';
    const UPDATED_AT = 'stm_updated';

    // Protection de la clé primaire
    protected $guarded = ['stm_id'];

    /**
     * Relations
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function product()
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id', 'prt_id');
    }

    public function warehouse()
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_id', 'whs_id');
    }

    public function destinationWarehouse()
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_dest_id', 'whs_id');
    }

    public function deliveryNote()
    {
        return $this->belongsTo(DeliveryNoteModel::class, 'fk_dln_id', 'dln_id');
    }

    public function order()
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrderModel::class, 'fk_por_id', 'por_id');
    }

    public function pairedMovement()
    {
        return $this->belongsTo(self::class, 'fk_stm_paired_id', 'stm_id');
    }
}
