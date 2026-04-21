<?php

namespace App\Models;

class ProspectActivityModel extends BaseModel
{
    protected $table = 'prospect_activity_pac';
    protected $primaryKey = 'pac_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'pac_created';
    const UPDATED_AT = 'pac_updated';

    protected $guarded = ['pac_id'];

    public function opportunity()
    {
        return $this->belongsTo(ProspectOpportunityModel::class, 'fk_opp_id', 'opp_id');
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

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
