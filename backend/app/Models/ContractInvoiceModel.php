<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractInvoiceModel extends BaseModel
{
    protected $table = 'contract_invoice_coi';
    protected $primaryKey = 'coi_id';
    public $incrementing = true;

    protected $keyType = 'int';

    const CREATED_AT = 'coi_created';
    const UPDATED_AT = 'coi_updated';


    protected $fillable = [
        'fk_usr_id_author',
        'fk_usr_id_updater',
        'fk_con_id',
        'fk_inv_id',
        'coi_created',
        'coi_updated'
    ];

    // Relation vers le contrat
    public function contract()
    {
        return $this->belongsTo(ContractModel::class, 'fk_con_id', 'con_id');
    }

    // Relation vers la facture
    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }
}
