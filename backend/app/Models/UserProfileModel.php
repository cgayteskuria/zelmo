<?php

namespace App\Models;


class UserProfileModel extends BaseModel
{
    protected $table = 'user_profile_usp';
    protected $primaryKey = 'usp_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'usp_created';
    const UPDATED_AT = 'usp_updated';

    // Protéger la clé primaire
    protected $guarded = ['usp_id'];

    /**
     * Relations
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
