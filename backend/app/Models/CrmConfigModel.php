<?php

namespace App\Models;

class CrmConfigModel extends BaseModel
{
    protected $table = 'crm_config_crc';
    protected $primaryKey = 'crc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'crc_created';
    const UPDATED_AT = 'crc_updated';

    protected $guarded = ['crc_id'];

    protected $hidden = ['crc_api_key', 'crc_webhook_secret'];

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
