<?php

namespace App\Models;

class PurchaseOrderConfigModel extends BaseModel
{
    protected $table = 'purchase_order_config_pco';
    protected $primaryKey = 'pco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'pco_created';
    const UPDATED_AT = 'pco_updated';

    // Protection de la clé primaire
    protected $guarded = ['pco_id'];

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

    public function messageTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id', 'emt_id');
    }

    public function defaultProduct()
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id_default', 'prt_id');
    }
}
