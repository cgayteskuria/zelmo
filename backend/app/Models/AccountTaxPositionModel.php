<?php

namespace App\Models;



class AccountTaxPositionModel extends BaseModel
{
    protected $table = 'account_tax_position_tap';
    protected $primaryKey = 'tap_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tap_created';
    const UPDATED_AT = 'tap_updated';

    // Protéger la clé primaire
    protected $guarded = ['tap_id'];

    protected $casts = [
        
    ];


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

    
}
