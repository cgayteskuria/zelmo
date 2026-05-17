<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CrmRevealRequestModel extends Model
{
    protected $table = 'crm_reveal_request_crr';
    protected $primaryKey = 'crr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'crr_created';
    const UPDATED_AT = 'crr_updated';

    protected $guarded = ['crr_id'];

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }

    public function contact()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }
}
