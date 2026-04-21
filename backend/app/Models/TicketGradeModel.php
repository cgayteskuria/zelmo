<?php

namespace App\Models;

class TicketGradeModel extends BaseModel
{
    protected $table = 'ticket_grade_tkg';
    protected $primaryKey = 'tkg_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tkg_created';
    const UPDATED_AT = 'tkg_updated';

    // Protection de la clé primaire
    protected $guarded = ['tkg_id'];

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
     * Tickets associés à ce type
     */
    public function tickets()
    {
        return $this->hasMany(TicketModel::class, 'fk_tkg_id', 'tkg_id');
    }
}
