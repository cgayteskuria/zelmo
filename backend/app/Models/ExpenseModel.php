<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpenseModel extends Model
{
    use HasFactory;

    protected $table = 'expenses_exp';
    protected $primaryKey = 'exp_id';

    /**
     * Boot du modèle - Recalculer les totaux de la note de frais parente
     */
    protected static function boot()
    {
        parent::boot();

        // Après création d'une dépense
        static::created(function ($expense) {
            if ($expense->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($expense->fk_exr_id);
                // Mettre à jour le montant restant (car le total TTC a changé)
                $expenseReport = ExpenseReportModel::find($expense->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
        });

        // Après modification d'une dépense
        static::updated(function ($expense) {
            if ($expense->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($expense->fk_exr_id);
                // Mettre à jour le montant restant (car le total TTC a changé)
                $expenseReport = ExpenseReportModel::find($expense->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
            // Si l'expense a changé de note de frais, recalculer aussi l'ancienne
            if ($expense->isDirty('fk_exr_id') && $expense->getOriginal('fk_exr_id')) {
                ExpenseReportModel::recalculateTotals($expense->getOriginal('fk_exr_id'));
                $oldExpenseReport = ExpenseReportModel::find($expense->getOriginal('fk_exr_id'));
                if ($oldExpenseReport) {
                    $oldExpenseReport->updateAmountRemaining();
                }
            }
        });

        // Après suppression d'une dépense
        static::deleted(function ($expense) {
            if ($expense->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($expense->fk_exr_id);
                // Mettre à jour le montant restant (car le total TTC a changé)
                $expenseReport = ExpenseReportModel::find($expense->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
        });
    }

    const CREATED_AT = 'exp_created_at';
    const UPDATED_AT = 'exp_updated_at';

    protected $fillable = [
        'fk_exr_id',
        'fk_exc_id',
        'fk_doc_id',
        'exp_date',
        'exp_description',
        'exp_merchant',
        'exp_payment_method',
        'exp_total_amount_ht',
        'exp_total_amount_ttc',
        'exp_total_tva',
        'exp_receipt_path',
        'exp_notes',
    ];

    protected $casts = [
        'exp_date' => 'date',
        'exp_total_amount_ht' => 'decimal:2',
        'exp_total_amount_ttc' => 'decimal:2',
        'exp_total_tva' => 'decimal:2',
    ];

    // Relations
    public function expenseReport()
    {
        return $this->belongsTo(ExpenseReportModel::class, 'fk_exr_id', 'exr_id');
    }

    public function category()
    {
        return $this->belongsTo(ExpenseCategoryModel::class, 'fk_exc_id', 'exc_id');
    }

    public function lines()
    {
        return $this->hasMany(ExpenseLineModel::class, 'fk_exp_id', 'exp_id');
    }

    public function document()
    {
        return $this->hasOne(DocumentModel::class, 'fk_exp_id', 'exp_id');
    }

    // Scopes
    public function scopeByPaymentMethod($query, $method)
    {
        return $query->where('exp_payment_method', $method);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('exp_date', [$startDate, $endDate]);
    }

    public function scopeWithReceipt($query)
    {
        return $query->whereNotNull('fk_doc_id');
    }

    public function scopeWithoutReceipt($query)
    {
        return $query->whereNull('fk_doc_id');
    }


    public function getHasReceiptAttribute(): bool
    {
        return DocumentModel::where('fk_exp_id', $this->exp_id)->exists();
    }


    // Helper Methods
    public function calculateTotals(): void
    {
        $this->exp_total_amount_ht = $this->lines()->sum('exl_amount_ht');
        $this->exp_total_tva = $this->lines()->sum('exl_amount_tva');
        $this->exp_total_amount_ttc = $this->lines()->sum('exl_amount_ttc');
    }
}
