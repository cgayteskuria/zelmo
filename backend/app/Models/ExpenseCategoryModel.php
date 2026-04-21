<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpenseCategoryModel extends Model
{
    use HasFactory;

    protected $table = 'expense_categories_exc';
    protected $primaryKey = 'exc_id';

    const CREATED_AT = 'exc_created_at';
    const UPDATED_AT = 'exc_updated_at';

    protected $fillable = [
        'exc_name',
        'exc_code',
        'exc_description',
        'exc_icon',
        'exc_color',
        'exc_is_active',
        'exc_requires_receipt',
        'exc_max_amount',
        'fk_acc_id',
    ];

    protected $casts = [
        'exc_is_active' => 'boolean',
        'exc_requires_receipt' => 'boolean',
        'exc_max_amount' => 'decimal:2',
    ];

    // Relations
    public function expenses()
    {
        return $this->hasMany(ExpenseModel::class, 'fk_exc_id', 'exc_id');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('exc_is_active', true);
    }

    public function scopeInactive($query)
    {
        return $query->where('exc_is_active', false);
    }

    public function scopeRequiringReceipt($query)
    {
        return $query->where('exc_requires_receipt', true);
    }


    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id', 'acc_id');
    }

    // Accessors
    public function getFormattedMaxAmountAttribute()
    {
        return $this->exc_max_amount ? number_format($this->exc_max_amount, 2, ',', ' ') . ' €' : 'Illimité';
    }

    // Helper Methods
    public function isAmountAllowed(float $amount): bool
    {
        if (!$this->exc_max_amount) {
            return true;
        }

        return $amount <= $this->exc_max_amount;
    }

    public function validateExpense(ExpenseModel $expense): array
    {
        $errors = [];

        if ($this->exc_requires_receipt && !$expense->has_receipt) {
            $errors[] = 'Un reçu est requis pour cette catégorie.';
        }

        if (!$this->isAmountAllowed($expense->exp_total_amount_ttc)) {
            $errors[] = "Le montant dépasse le maximum autorisé de {$this->formatted_max_amount}.";
        }

        return $errors;
    }
}
