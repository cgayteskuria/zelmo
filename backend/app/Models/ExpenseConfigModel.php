<?php

namespace App\Models;

class ExpenseConfigModel extends BaseModel
{
    protected $table = 'expense_config_eco';
    protected $primaryKey = 'eco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eco_created';
    const UPDATED_AT = 'eco_updated';

    protected $guarded = ['eco_id'];

    /**
     * Casts
     */
    protected $casts = [
        'eco_ocr_enable' => 'boolean',
    ];

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
}
