<?php

namespace App\Models;

class TicketStatusModel extends BaseModel
{
    protected $table = 'ticket_status_tke';
    protected $primaryKey = 'tke_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tke_created';
    const UPDATED_AT = 'tke_updated';

    // Protection de la clé primaire
    protected $guarded = ['tke_id'];

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

    /**
     * Tickets associés à ce statut
     */
    public function tickets()
    {
        return $this->hasMany(TicketModel::class, 'fk_tke_id', 'tke_id');
    }
}
