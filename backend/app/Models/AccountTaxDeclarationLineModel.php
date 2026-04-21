<?php

namespace App\Models;

class AccountTaxDeclarationLineModel extends BaseModel
{
    protected $table = 'account_tax_declaration_line_vdl';
    protected $primaryKey = 'vdl_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'vdl_created';
    const UPDATED_AT = 'vdl_updated';

    protected $guarded = ['vdl_id'];

    protected $casts = [
        'vdl_base_ht'     => 'decimal:2',
        'vdl_amount_tva'  => 'decimal:2',       
        'vdl_is_editable' => 'boolean',
        'vdl_has_base_ht' => 'boolean',
        'vdl_has_tax_amt' => 'boolean',
        'vdl_order'       => 'integer',
    ];

    public function declaration()
    {
        return $this->belongsTo(AccountTaxDeclarationModel::class, 'fk_vdc_id', 'vdc_id');
    }
}
