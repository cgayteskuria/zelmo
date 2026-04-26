<?php

namespace App\Models;

class EInvoicingEReportingModel extends BaseModel
{
    protected $table = 'einvoicing_ereporting_eer';
    protected $primaryKey = 'eer_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eer_created';
    const UPDATED_AT = 'eer_updated';

    protected $guarded = ['eer_id'];

    protected $casts = [
        'eer_transmitted_at' => 'datetime',
        'eer_amount_ht'      => 'decimal:3',
        'eer_amount_ttc'     => 'decimal:3',
        'eer_invoice_ids'    => 'array',
    ];

    public const TYPE_B2C      = 'B2C';
    public const TYPE_B2B_INTL = 'B2B_INTL';

    public const STATUS_PENDING     = 'PENDING';
    public const STATUS_TRANSMITTED = 'TRANSMITTED';
    public const STATUS_ERROR       = 'ERROR';

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }
}
