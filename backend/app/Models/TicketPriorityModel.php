<?php

namespace App\Models;

class TicketPriorityModel extends BaseModel
{
    protected $table = 'ticket_priority_tkp';
    protected $primaryKey = 'tkp_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tkp_created';
    const UPDATED_AT = 'tkp_updated';

    // Protection de la clé primaire
    protected $guarded = ['tkp_id'];

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
     * Tickets associés à cette priorité
     */
    public function tickets()
    {
        return $this->hasMany(TicketModel::class, 'fk_tkp_id', 'tkp_id');
    }
}
