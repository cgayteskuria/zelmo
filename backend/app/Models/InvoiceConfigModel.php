<?php

namespace App\Models;

class InvoiceConfigModel extends BaseModel
{
    protected $table = 'invoice_config_ico';
    protected $primaryKey = 'ico_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'ico_created';
    const UPDATED_AT = 'ico_updated';

    // Protection de la clé primaire
    protected $guarded = ['ico_id'];

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

    public function invoiceTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_invoice', 'emt_id');
    }

    public function emailAccount()
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id', 'eml_id');
    }
}
