<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleConfigModel extends BaseModel
{
    protected $table = 'sale_config_sco';
    protected $primaryKey = 'sco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'sco_created';
    const UPDATED_AT = 'sco_updated';

    protected $guarded = ['sco_id'];

    /**
     * Relations utilisateurs
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Relations métier
     */


    public function saleValidationTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_sale_validation', 'emt_id');
    }

    public function saleTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_sale', 'emt_id');
    }

    public function tokenRenewTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_token_renew', 'emt_id');
    }

    public function saleConfirmationTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_sale_confirmation', 'emt_id');
    }

    public function sellerAlertTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_seller_alert', 'emt_id');
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id', 'eml_id');
    }
}
