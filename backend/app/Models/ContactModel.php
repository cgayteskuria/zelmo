<?php

namespace App\Models;


class ContactModel extends BaseModel 
{
    protected $table = 'contact_ctc';
    protected $primaryKey = 'ctc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'ctc_created';
    const UPDATED_AT = 'ctc_updated';

    // On va autoriser l'assignation de masse pour toutes les colonnes sauf la clé primaire
    protected $guarded = ['ctc_id'];

   
    /**
     * Relations
     */

    // Partenaire principal (backward compat, FK directe)
    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    // Tous les partenaires liés (many-to-many via pivot contact_partner_ctp)
    public function partners()
    {
        return $this->belongsToMany(PartnerModel::class, 'contact_partner_ctp', 'fk_ctc_id', 'fk_ptr_id');
    }

    public function devices()
    {
        return $this->belongsToMany(DeviceModel::class, 'contact_device_ctd', 'fk_ctc_id', 'fk_dev_id');
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
