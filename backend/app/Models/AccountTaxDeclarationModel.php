<?php

namespace App\Models;

class AccountTaxDeclarationModel extends BaseModel
{
    protected $table = 'account_tax_declaration_vdc';
    protected $primaryKey = 'vdc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'vdc_created';
    const UPDATED_AT = 'vdc_updated';

    protected $guarded = ['vdc_id'];

    protected $casts = [
        'vdc_period_start'    => 'date',
        'vdc_period_end'      => 'date',
        'vdc_validated_at'    => 'datetime',
        'vdc_closed_at'       => 'datetime',
        'vdc_credit_previous' => 'decimal:2',
        'vdc_prorata'         => 'decimal:2',
    ];

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function lines()
    {
        return $this->hasMany(AccountTaxDeclarationLineModel::class, 'fk_vdc_id', 'vdc_id')
            ->orderBy('vdl_order');
    }

    public function move()
    {
        return $this->belongsTo(AccountMoveModel::class, 'fk_amo_id', 'amo_id');
    }

    public function exercise()
    {
        return $this->belongsTo(AccountExerciseModel::class, 'fk_aex_id', 'aex_id');
    }

    public function isDraft(): bool     { return $this->vdc_status === 'draft'; }
    public function isValidated(): bool { return $this->vdc_status === 'validated'; }
    public function isClosed(): bool    { return $this->vdc_status === 'closed'; }
}
