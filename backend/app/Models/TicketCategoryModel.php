<?php

namespace App\Models;

class TicketCategoryModel extends BaseModel
{
    protected $table = 'ticket_category_tkc';
    protected $primaryKey = 'tkc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tkc_created';
    const UPDATED_AT = 'tkc_updated';

    // Protection de la clé primaire
    protected $guarded = ['tkc_id'];

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
     * Tickets associés à cette catégorie
     */
    public function tickets()
    {
        return $this->hasMany(TicketModel::class, 'fk_tkc_id', 'tkc_id');
    }
}
