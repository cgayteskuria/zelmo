<?php

namespace App\Models;

class TimeEntryModel extends BaseModel
{
    protected $table = 'time_entry_ten';
    protected $primaryKey = 'ten_id';
    protected $guarded = [];

    const CREATED_AT = 'ten_created';
    const UPDATED_AT = 'ten_updated';

    const STATUS_DRAFT    = 0;
    const STATUS_SUBMITTED = 1;
    const STATUS_APPROVED  = 2;
    const STATUS_INVOICED  = 3;
    const STATUS_REJECTED  = 4;

    protected $casts = [
        'ten_tags'        => 'array',
        'ten_hourly_rate' => 'decimal:2',
        'ten_is_billable' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }

    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function project()
    {
        return $this->belongsTo(TimeProjectModel::class, 'fk_tpr_id', 'tpr_id');
    }

    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }
}
