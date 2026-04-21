<?php

namespace App\Models;

class TicketSourceModel extends BaseModel
{
    protected $table = 'ticket_source_tks';
    protected $primaryKey = 'tks_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tks_created';
    const UPDATED_AT = 'tks_updated';

    // Protection de la clé primaire
    protected $guarded = ['tks_id'];

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
     * Tickets associés à cette source
     */
    public function tickets()
    {
        return $this->hasMany(TicketModel::class, 'fk_tks_id', 'tks_id');
    }
}
