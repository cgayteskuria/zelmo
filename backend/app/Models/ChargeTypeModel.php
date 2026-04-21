<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChargeTypeModel extends BaseModel
{
    use HasFactory;

    protected $table = 'charge_type_cht';
    protected $primaryKey = 'cht_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'cht_created';
    const UPDATED_AT = 'cht_updated';

    // Protéger la clé primaire
    protected $guarded = ['cht_id'];

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

    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id', 'acc_id');
    }

    public function paymentMode()
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id', 'pam_id');
    }

    public function charges()
    {
        return $this->hasMany(ChargeModel::class, 'fk_cht_id', 'cht_id');
    }
}
