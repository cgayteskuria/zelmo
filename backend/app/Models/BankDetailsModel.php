<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class BankDetailsModel extends BaseModel 
{
    protected $table = 'bank_details_bts';
    protected $primaryKey = 'bts_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'bts_created';
    const UPDATED_AT = 'bts_updated';

    // Protéger la clé primaire
    protected $guarded = ['bts_id'];

    
    /**
     * Relations
     */
    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id', 'acc_id');
    }

    public function company()
    {
        return $this->belongsTo(CompanyModel::class, 'fk_cop_id', 'cop_id');
    }

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
