<?php
namespace App\Models;

class ProspectPipelineStageModel extends BaseModel
{
    protected $table = 'prospect_pipeline_stage_pps';
    protected $primaryKey = 'pps_id';
    public $incrementing = true;
    protected $keyType = 'int';
    const CREATED_AT = 'pps_created';
    const UPDATED_AT = 'pps_updated';
    protected $guarded = ['pps_id'];

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
        return $this->hasMany(ProspectOpportunityModel::class, 'fk_pps_id', 'pps_id');
    }

    /**
     * Retire le flag default de toutes les étapes sauf celle exclue.
     */
    public static function clearDefault(int $exceptId = null): void
    {
        static::when($exceptId, fn($q) => $q->where('pps_id', '!=', $exceptId))
              ->whereNotNull('pps_is_default')
              ->update(['pps_is_default' => null]);
    }
}