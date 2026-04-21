<?php

namespace App\Models;



class PaymentModeModel extends BaseModel
{
    protected $table = 'payment_mode_pam';
    protected $primaryKey = 'pam_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'pam_created';
    const UPDATED_AT = 'pam_updated';

    
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
