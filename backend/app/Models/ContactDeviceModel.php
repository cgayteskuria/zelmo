<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class ContactDeviceModel extends BaseModel 
{
    protected $table = 'contact_device_ctd';
    protected $primaryKey = 'ctd_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'ctd_created';
    const UPDATED_AT = 'ctd_updated';

    // Protéger la clé primaire
    protected $guarded = ['ctd_id'];

    /**
     * Relations
     */
    public function contact()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function device()
    {
        return $this->belongsTo(DeviceModel::class, 'fk_dev_id', 'dev_id');
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
