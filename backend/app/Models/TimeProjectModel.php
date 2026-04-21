<?php

namespace App\Models;

class TimeProjectModel extends BaseModel
{
    protected $table = 'time_project_tpr';
    protected $primaryKey = 'tpr_id';
    protected $guarded = [];

    const CREATED_AT = 'tpr_created';
    const UPDATED_AT = 'tpr_updated';

    const STATUS_ACTIVE   = 0;
    const STATUS_ARCHIVED = 1;

    protected $casts = [
        'tpr_budget_hours' => 'decimal:2',
        'tpr_hourly_rate'  => 'decimal:2',
        'tpr_deadline'     => 'date:Y-m-d',
    ];

    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function entries()
    {
        return $this->hasMany(TimeEntryModel::class, 'fk_tpr_id', 'tpr_id');
    }
}
