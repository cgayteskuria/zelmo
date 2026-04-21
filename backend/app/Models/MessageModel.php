<?php

namespace App\Models;

class MessageModel extends BaseModel
{
    protected $table = 'message_mes';
    protected $primaryKey = 'mes_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'mes_created';
    const UPDATED_AT = 'mes_updated';

    // Protection de la clé primaire
    protected $guarded = ['mes_id'];

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
     * Compte email utilisé pour l’envoi / la réception
     */
    public function emailAccount()
    {
        return $this->belongsTo(
            MessageEmailAccountModel::class,
            'fk_eml_id',
            'eml_id'
        );
    }
}
