<?php

namespace App\Models;

use App\Services\StockService;

class DeliveryNoteLineModel extends BaseModel
{
    protected $table = 'delivery_note_line_dnl';
    protected $primaryKey = 'dnl_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'dnl_created';
    const UPDATED_AT = 'dnl_updated';

    // Protection de la clé primaire
    protected $guarded = ['dnl_id'];



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

    public function deliveryNote()
    {
        return $this->belongsTo(DeliveryNoteModel::class, 'fk_dln_id', 'dln_id');
    }

    public function product()
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id', 'prt_id');
    }

    public function saleOrderLine()
    {
        return $this->belongsTo(SaleOrderLineModel::class, 'fk_orl_id', 'orl_id');
    }

    public function purchaseOrderLine()
    {
        return $this->belongsTo(PurchaseOrderLineModel::class, 'fk_pol_id', 'pol_id');
    }
    /**
     * Récupère toutes les lignes de livraison liées à la même ligne de commande client
     */
    public function allDeliveriesBySaleOrder()
    {
        return $this->hasMany(DeliveryNoteLineModel::class, 'fk_orl_id', 'fk_orl_id');
    }

    /**
     * Récupère toutes les lignes de réception liées à la même ligne de commande fournisseur
     */
    public function allDeliveriesByPurchaseOrder()
    {
        return $this->hasMany(DeliveryNoteLineModel::class, 'fk_pol_id', 'fk_pol_id');
    }

    protected static function boot()
    {
        parent::boot();

        // Mise à jour du stock virtuel après modification d'une ligne
        static::saved(function ($model) {          
            $deliveryNote = $model->deliveryNote;
            if ($deliveryNote && $deliveryNote->dln_status == DeliveryNoteModel::STATUS_DRAFT) {
                $stockService = app(StockService::class);
                $stockService->updateVirtualStock($model->fk_prt_id, $deliveryNote->fk_whs_id);
            }
        });

        // Mise à jour du stock virtuel après suppression d'une ligne
        static::deleted(function ($model) {
            $deliveryNote = $model->deliveryNote;
            if ($deliveryNote && $deliveryNote->dln_status == DeliveryNoteModel::STATUS_DRAFT) {
                $stockService = app(StockService::class);
                $stockService->updateVirtualStock($model->fk_prt_id, $deliveryNote->fk_whs_id);
            }
        });
    }
}
