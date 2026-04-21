<?php
namespace App\Models;

class ProspectSourceModel extends BaseModel
{
    protected $table = 'prospect_source_pso';
    protected $primaryKey = 'pso_id';
    public $incrementing = true;
    protected $keyType = 'int';
    const CREATED_AT = 'pso_created';
    const UPDATED_AT = 'pso_updated';
    protected $guarded = ['pso_id'];

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function opportunities()
    {
        return $this->hasMany(ProspectOpportunityModel::class, 'fk_pso_id', 'pso_id');
    }

    /**
     * Retire le flag default de toutes les sources sauf celle exclue.
     */
    public static function clearDefault(int $exceptId = null): void
    {
        static::when($exceptId, fn($q) => $q->where('pso_id', '!=', $exceptId))
              ->whereNotNull('pso_is_default')
              ->update(['pso_is_default' => null]);
    }
}