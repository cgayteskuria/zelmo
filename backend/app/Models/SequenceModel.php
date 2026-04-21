<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SequenceModel extends BaseModel
{
    protected $table = 'sequence_seq';
    protected $primaryKey = 'seq_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'seq_created';
    const UPDATED_AT = 'seq_updated';

    // Protéger la clé primaire
    protected $guarded = ['seq_id'];

    /**
     * Casts
     */
    protected $casts = [
        'seq_yearly_reset' => 'bool',
    ];

    /**
     * Relations utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_seq_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_seq_id_updater', 'usr_id');
    }

    /**
     * Scopes utiles
     */
    public function scopeForModule($query, string $module, ?string $submodule = null)
    {
        return $query
            ->where('seq_module', $module)
            ->where('seq_submodule', $submodule);
    }
}
