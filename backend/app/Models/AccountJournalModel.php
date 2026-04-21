<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountJournalModel extends BaseModel
{
    protected $table = 'account_journal_ajl';
    protected $primaryKey = 'ajl_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'ajl_created';
    const UPDATED_AT = 'ajl_updated';

    // Protéger la clé primaire
    protected $guarded = ['ajl_id'];

    const TYPE_SALE     = 'sale';
    const TYPE_PURCHASE = 'purchase';
    const TYPE_BANK     = 'bank';
    const TYPE_CASH     = 'cash';
    const TYPE_GENERAL  = 'general';

    /**
     * Casts
     */
    protected $casts = [
        'ajl_code'  => 'string',
        'ajl_label' => 'string',
        'ajl_type'  => 'string',
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
    public function scopeByCode($query, string $code)
    {
        return $query->where('ajl_code', $code);
    }
}
