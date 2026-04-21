<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountTransferModel extends BaseModel
{
    protected $table = 'account_transfer_atr';
    protected $primaryKey = 'atr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'atr_created';
    const UPDATED_AT = 'atr_updated';

    // Protéger la clé primaire
    protected $guarded = ['atr_id'];

    /**
     * Casts
     */
    protected $casts = [
        'atr_created'        => 'datetime',
        'atr_transfer_start' => 'date',
        'atr_transfer_end'   => 'date',
        'atr_moves_number'   => 'int',
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

    /**
     * Scopes utiles
     */
    public function scopeBetween($query, $start, $end)
    {
        return $query->whereBetween('atr_transfer_start', [$start, $end]);
    }
}
