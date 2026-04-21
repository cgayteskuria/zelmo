<?php

namespace App\Models;


class DeviceModel extends BaseModel 
{
    protected $table = 'device_dev';
    protected $primaryKey = 'dev_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'dev_created';
    const UPDATED_AT = 'dev_updated';

    // On protège la clé primaire
    protected $guarded = ['dev_id'];

    /**
     * Relations
     */
    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
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
