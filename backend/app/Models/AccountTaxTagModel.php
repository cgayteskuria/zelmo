<?php

namespace App\Models;

class AccountTaxTagModel extends BaseModel
{
    protected $table      = 'account_tax_tag_ttg';
    protected $primaryKey = 'ttg_id';
    public    $incrementing = true;
    protected $keyType    = 'int';

    const CREATED_AT = 'ttg_created';
    const UPDATED_AT = 'ttgb_updated';

    protected $guarded = ['ttg_id'];

    // ── Relations ─────────────────────────────────────────────────────────────

    /**
     * Lignes d'écritures comptables qui portent ce tag (pivot exécution).
     */
    public function moveLines()
    {
        return $this->belongsToMany(
            AccountMoveLineModel::class,
            'account_move_line_tag_rel_amr',
            'fk_ttg_id',
            'fk_aml_id'
        );
    }
}
