<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpenseLineModel extends Model
{
    use HasFactory;

    protected $table = 'expense_lines_exl';
    protected $primaryKey = 'exl_id';

    const CREATED_AT = 'exl_created_at';
    const UPDATED_AT = 'exl_updated_at';

    protected $fillable = [
        'fk_exp_id',
        'fk_tax_id',
        'exl_amount_ht',
        'exl_amount_tva',
        'exl_amount_ttc',
        'exl_description',
        'exl_tax_rate',
    ];

    protected $casts = [
        'exl_amount_ht' => 'decimal:2',
        'exl_amount_tva' => 'decimal:2',
        'exl_amount_ttc' => 'decimal:2',
    ];

    // Relations
    public function expense()
    {
        return $this->belongsTo(ExpenseModel::class, 'fk_exp_id', 'exp_id');
    }

    public function tax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id', 'tax_id');
    }

    /**
     * Valider la cohérence des montants HT/TVA/TTC avec une tolérance de 1 centime.
     * Retourne un message d'erreur ou null si OK.
     */
    public function validateAmounts(): ?string
    {
        $ht = (float) $this->exl_amount_ht;
        $tva = (float) $this->exl_amount_tva;
        $ttc = (float) $this->exl_amount_ttc;

        if ($this->tax) {
            $taxRate = (float) $this->tax->tax_rate / 100;
            $expectedTtc = round($ht * (1 + $taxRate), 2);

            if (abs($expectedTtc - $ttc) > 0.015) {
                return "Incohérence montants : HT {$ht} × (1 + {$this->tax->tax_rate}%) = {$expectedTtc}, mais TTC reçu = {$ttc}";
            }
        } else {
            // Sans taxe, TTC doit être égal à HT
            if (abs($ht - $ttc) > 0) {
                return "Sans taxe, le TTC ({$ttc}) doit être égal au HT ({$ht})";
            }
        }

        // Vérifier que TVA = TTC - HT
        $expectedTva = round($ttc - $ht, 2);
        if (abs($expectedTva - $tva) > 0.015) {
            return "Incohérence TVA : TTC ({$ttc}) - HT ({$ht}) = {$expectedTva}, mais TVA reçue = {$tva}";
        }

        return null;
    }

    // Events
    protected static function booted()
    {
        static::saved(function ($line) {
            // Recalculer les totaux de la dépense parente
            if ($line->expense) {
                $line->expense->calculateTotals();
                $line->expense->save();
            }
        });

        static::deleted(function ($line) {
            // Recalculer les totaux de la dépense parente
            if ($line->expense) {
                $line->expense->calculateTotals();
                $line->expense->save();
            }
        });
    }
}