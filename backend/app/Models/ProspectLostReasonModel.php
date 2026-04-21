<?php

namespace App\Models;

class ProspectLostReasonModel extends BaseModel
{
    protected $table = 'prospect_lost_reason_plr';
    protected $primaryKey = 'plr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'plr_created';
    const UPDATED_AT = 'plr_updated';

    protected $guarded = ['plr_id'];

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
        return $this->hasMany(ProspectOpportunityModel::class, 'fk_plr_id', 'plr_id');
    }
}
