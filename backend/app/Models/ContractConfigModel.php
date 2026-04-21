<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractConfigModel extends BaseModel
{
    protected $table = 'contract_config_cco';
    protected $primaryKey = 'cco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'cco_created';
    const UPDATED_AT = 'cco_updated';

    // Protéger la clé primaire
    protected $guarded = ['cco_id'];

    /**
     * Relations utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Relation métier
     */
    public function contractTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id', 'emt_id');
    }
}
