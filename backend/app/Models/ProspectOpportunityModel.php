<?php

namespace App\Models;

use App\Traits\DeletesRelatedDocuments;

class ProspectOpportunityModel extends BaseModel
{
    use DeletesRelatedDocuments;

    protected $table = 'prospect_opportunity_opp';
    protected $primaryKey = 'opp_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'opp_created';
    const UPDATED_AT = 'opp_updated';

    protected $guarded = ['opp_id'];

    protected static function getDocumentForeignKey(): string
    {
        return 'fk_opp_id';
    }

    // Relations
    public function stage()
    {
        return $this->belongsTo(ProspectPipelineStageModel::class, 'fk_pps_id', 'pps_id');
    }

    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function contact()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function seller()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function source()
    {
        return $this->belongsTo(ProspectSourceModel::class, 'fk_pso_id', 'pso_id');
    }

    public function lostReason()
    {
        return $this->belongsTo(ProspectLostReasonModel::class, 'fk_plr_id', 'plr_id');
    }

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function activities()
    {
        return $this->hasMany(ProspectActivityModel::class, 'fk_opp_id', 'opp_id');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_opp_id', 'opp_id');
    }
}
