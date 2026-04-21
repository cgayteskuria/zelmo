<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VatBoxModel extends Model
{
    protected $table      = 'vat_box_vbx';
    protected $primaryKey = 'vbx_id';
    public    $timestamps = false;

    protected $fillable = [
        'vbx_code',
        'vbx_label',
        'vbx_edi_code',
        'fk_vbx_id_parent',
        'vbx_regime',
        'vbx_is_title',
        'vbx_default_accounts',
        'vbx_accounts',
        'vbx_order',
    ];

    protected $casts = [
        'vbx_default_accounts' => 'array',
        'vbx_accounts'         => 'array',
        'vbx_is_title'         => 'boolean',
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function parent()
    {
        return $this->belongsTo(self::class, 'fk_vbx_id_parent', 'vbx_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'fk_vbx_id_parent', 'vbx_id')
                    ->orderBy('vbx_order');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /**
     * Filtre par régime et trie par vbx_order.
     */
    public function scopeForRegime($query, string $regime)
    {
        return $query->where('vbx_regime', $regime)->orderBy('vbx_order');
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    /**
     * Une ligne est mappable si vbx_default_accounts n'est pas null.
     */
    public function isMappable(): bool
    {
        return !is_null($this->vbx_default_accounts);
    }

    /**
     * Mapping effectif : vbx_accounts ?? vbx_default_accounts ?? [].
     */
    public function effectiveAccounts(): array
    {
        return $this->vbx_accounts ?? $this->vbx_default_accounts ?? [];
    }
}