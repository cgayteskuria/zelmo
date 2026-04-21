<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AccountTaxModel extends BaseModel
{
    protected $table = 'account_tax_tax';
    protected $primaryKey = 'tax_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tax_created';
    const UPDATED_AT = 'tax_updated';

    // Protéger la clé primaire
    protected $guarded = ['tax_id'];


    protected $casts = [
        'tax_rate' => 'decimal:2',     
    ];


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

    // ── Repartition Lines (architecture tags TVA) ─────────────────────────────

    /**
     * Toutes les lignes de ventilation, triées : invoice avant refund, base avant tax.
     */
    public function repartitionLines()
    {
        return $this->hasMany(AccountTaxRepartitionLineModel::class, 'fk_tax_id', 'tax_id')
                    ->orderByRaw("FIELD(trl_document_type,'invoice','refund')")
                    ->orderByRaw("FIELD(trl_repartition_type,'base','tax')");
    }

    public function invoiceRepartitionLines()
    {
        return $this->hasMany(AccountTaxRepartitionLineModel::class, 'fk_tax_id', 'tax_id')
                    ->where('trl_document_type', 'invoice')
                    ->orderByRaw("FIELD(trl_repartition_type,'base','tax')");
    }

    public function refundRepartitionLines()
    {
        return $this->hasMany(AccountTaxRepartitionLineModel::class, 'fk_tax_id', 'tax_id')
                    ->where('trl_document_type', 'refund')
                    ->orderByRaw("FIELD(trl_repartition_type,'base','tax')");
    }
}
