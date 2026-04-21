<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Ligne du formulaire de déclaration TVA (CA3 ou CA12).
 *
 * Une seule table, hiérarchie via trm_row_type (TITLE/SUBTITLE/SUBTITLE2/DATA/TOTAL)
 * et fk_trm_id_parent.
 *
 * Pour les lignes DATA, fk_ttg_id_base pointe vers le tag de la colonne base HT
 * et fk_ttg_id_tax vers le tag de la colonne montant TVA.
 */
class AccountTaxReportMappingModel extends Model
{
    protected $table      = 'account_tax_report_mapping_trm';
    protected $primaryKey = 'trm_id';

    public $timestamps = false;

    protected $fillable = [
        'trm_regime',
        'trm_box',
        'trm_label',
        'trm_row_type',
        'fk_ttg_id_base',
        'fk_ttg_id_tax',
        'fk_trm_id_parent',
        //'trm_sign',
        'trm_tax_rate',
        'trm_formula',     
        'trm_has_base_ht',
        'trm_has_tax_amt',
        'trm_dgfip_code',
        'trm_special_type',
        'trm_order',
    ];

    protected $casts = [
        'trm_formula'     => 'array',
        //'trm_sign'        => 'integer',
        'trm_order'       => 'integer',      
        'trm_has_base_ht' => 'boolean',
        'trm_has_tax_amt' => 'boolean',
        'trm_tax_rate'    => 'float',
    ];

    // ── Scopes ────────────────────────────────────────────────────────────────

    /** Toutes les lignes pour le régime donné ('CA3' ou 'CA12'). Inclut BOTH. */
    public function scopeForRegime($query, string $regime)
    {
        return $query->whereIn('trm_regime', [$regime])
                     ->orderBy('trm_order');
    }

    /** Lignes DATA uniquement. */
    public function scopeDataRows($query)
    {
        return $query->where('trm_row_type', 'DATA');
    }

}
