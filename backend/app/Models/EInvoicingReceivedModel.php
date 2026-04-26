<?php

namespace App\Models;

class EInvoicingReceivedModel extends BaseModel
{
    protected $table = 'einvoicing_received_eir';
    protected $primaryKey = 'eir_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eir_created';
    const UPDATED_AT = 'eir_updated';

    protected $guarded = ['eir_id'];

    protected $casts = [
        'eir_invoice_date' => 'date',
        'eir_due_date'     => 'date',
        'eir_imported_at'  => 'datetime',
        'eir_amount_ht'    => 'decimal:3',
        'eir_amount_ttc'   => 'decimal:3',
    ];

    public const STATUS_PENDING     = 'PENDING';
    public const STATUS_ACCEPTEE    = 'ACCEPTEE';
    public const STATUS_REFUSEE     = 'REFUSEE';
    public const STATUS_EN_PAIEMENT = 'EN_PAIEMENT';
    public const STATUS_PAYEE       = 'PAYEE';

    public function importedInvoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    public function isImported(): bool
    {
        return !is_null($this->eir_imported_at) && !is_null($this->fk_inv_id);
    }

    public function isPending(): bool
    {
        return $this->eir_our_status === self::STATUS_PENDING;
    }
}
