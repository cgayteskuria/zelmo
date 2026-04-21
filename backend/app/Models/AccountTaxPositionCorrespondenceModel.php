<?php

namespace App\Models;

class AccountTaxPositionCorrespondenceModel extends BaseModel
{
    protected $table = 'account_tax_position_correspondence_tac';
    protected $primaryKey = 'tac_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tac_created';
    const UPDATED_AT = 'tac_updated';

    // Protection de la clé primaire
    protected $guarded = ['tac_id'];

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

    public function taxPosition()
    {
        return $this->belongsTo(AccountTaxPositionModel::class, 'fk_tap_id', 'tap_id');
    }

    public function sourceTax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id_source', 'tax_id');
    }

    public function targetTax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id_target', 'tax_id');
    }
}
