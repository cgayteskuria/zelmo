<?php

namespace App\Models;

class MessageEmailAccountModel extends BaseModel
{
    protected $table = 'message_email_account_eml';
    protected $primaryKey = 'eml_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eml_created';
    const UPDATED_AT = 'eml_updated';

    // Protection de la clé primaire
    protected $guarded = ['eml_id'];


    protected $casts = [
        'eml_access_token_expire' => 'datetime',
    ];
    /**
     * Relations utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function saleConfig()
    {
        return $this->hasOne(SaleConfigModel::class, 'fk_eml_id', 'eml_id');
    }

    public function invoiceConfig()
    {
        return $this->hasOne(InvoiceConfigModel::class, 'fk_eml_id', 'eml_id');
    }
    
    public function companyConfig()
    {
        return $this->hasOne(CompanyModel::class, 'fk_eml_id_default', 'eml_id');
    }
}
