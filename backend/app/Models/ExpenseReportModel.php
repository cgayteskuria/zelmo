<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasSequenceNumber;


class ExpenseReportModel extends Model
{
    use HasFactory,  HasSequenceNumber;

    /**
     * Boot du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de note de frais avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->exr_number)) {
                $lastReport = static::orderBy('exr_id', 'desc')->first();

                $lastNumber = $lastReport ? $lastReport->exr_number : null;

                $model->exr_number = static::generateSequenceNumber('expensereport', '', $lastNumber);
            }
        });

        // Bloquer la suppression des notes de frais approuvées ou comptabilisées
        static::deleting(function ($model) {
            if (in_array($model->exr_status, ['approved', 'accounted'])) {
                throw new \Exception('Impossible de supprimer une note de frais approuvée ou comptabilisée');
            }
        });
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     */
    protected static function getLastSequenceNumber(): string
    {
        $lastReport = static::orderBy('exr_id', 'desc')->first();
        return $lastReport && $lastReport->exr_number ? $lastReport->exr_number : '';
    }

    protected $table = 'expense_reports_exr';
    protected $primaryKey = 'exr_id';

    const CREATED_AT = 'exr_created_at';
    const UPDATED_AT = 'exr_updated_at';
    const DELETED_AT = 'exr_deleted_at';

    protected $fillable = [
        'fk_usr_id',
        'exr_reference',
        'exr_number',
        'exr_title',
        'exr_description',
        'exr_period_from',
        'exr_period_to',
        'exr_status',
        'exr_submission_date',
        'exr_approval_date',
        'exr_approved_by',
        'exr_rejection_reason',
        'exr_total_amount_ht',
        'exr_total_amount_ttc',
        'exr_total_tva',
        'exr_amount_remaining',
        'exr_payment_progress',
        'exr_payment_date',
    ];

    protected $casts = [
        'exr_period_from' => 'date',
        'exr_period_to' => 'date',
        'exr_submission_date' => 'datetime',
        'exr_approval_date' => 'datetime',
        'exr_payment_date' => 'datetime',
        'exr_total_amount_ht' => 'decimal:2',
        'exr_total_amount_ttc' => 'decimal:2',
        'exr_total_tva' => 'decimal:2',
        'exr_amount_remaining' => 'decimal:2',
        'exr_payment_progress' => 'integer',
    ];

    // Relations
    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }

    public function approver()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_approved_by', 'usr_id');
    }

    public function expenses()
    {
        return $this->hasMany(ExpenseModel::class, 'fk_exr_id', 'exr_id');
    }

    public function mileageExpenses()
    {
        return $this->hasMany(MileageExpenseModel::class, 'fk_exr_id', 'exr_id');
    }

    public function paymentAllocations()
    {
        return $this->hasMany(PaymentAllocationModel::class, 'fk_exr_id', 'exr_id');
    }

    // Scopes
    public function scopeDraft($query)
    {
        return $query->where('exr_status', 'draft');
    }

    public function scopeSubmitted($query)
    {
        return $query->where('exr_status', 'submitted');
    }

    public function scopeApproved($query)
    {
        return $query->where('exr_status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('exr_status', 'rejected');
    }

    public function scopeAccounted($query)
    {
        return $query->where('exr_status', 'accounted');
    }

    /**
     * Scope pour filtrer les notes de frais d'un utilisateur spécifique
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('fk_usr_id', $userId);
    }

    /**
     * Scope pour filtrer les notes de frais des membres de l'équipe d'un manager
     */
    public function scopeForTeam($query, int $managerId)
    {
        $manager = UserModel::find($managerId);
        if (!$manager) {
            return $query->whereRaw('1 = 0'); // Aucun résultat
        }

        $teamMemberIds = $manager->getTeamMemberIds();
        return $query->whereIn('fk_usr_id', $teamMemberIds);
    }

    /**
     * Scope pour filtrer les notes de frais accessibles par un utilisateur
     * (ses propres notes + celles de son équipe si manager)
     */
    public function scopeAccessibleBy($query, $user)
    {
        // Si l'utilisateur a la permission expenses.approve, il voit tout
        if ($user->can('expenses.approve')) {
            return $query;
        }

        // Sinon, on récupère ses propres notes + celles de son équipe
        $accessibleUserIds = [$user->usr_id];
        $teamMemberIds = $user->getTeamMemberIds();
        $accessibleUserIds = array_merge($accessibleUserIds, $teamMemberIds);

        return $query->whereIn('fk_usr_id', $accessibleUserIds);
    }

    // Accessors & Mutators
    public function getStatusLabelAttribute()
    {
        return match ($this->exr_status) {
            'draft' => 'Brouillon',
            'submitted' => 'Soumis',
            'approved' => 'Approuvé',
            'rejected' => 'Rejeté',
            'paid' => 'Payé',
            default => $this->exr_status,
        };
    }

    // Helper Methods
    public function canBeEdited(): bool
    {
        return in_array($this->exr_status, ['draft', 'rejected']);
    }

    public function canBeSubmitted(): bool
    {
        return $this->exr_status === 'draft'
            && ($this->expenses()->count() > 0 || $this->mileageExpenses()->count() > 0);
    }

    public function canBeApproved(): bool
    {
        return $this->exr_status === 'submitted';
    }

    /**
     * Vérifie si la note de frais peut être désapprouvée
     * Possible uniquement si approuvée ET aucun paiement n'a été effectué
     */
    public function canBeUnapproved(): bool
    {
        return $this->exr_status === 'approved' && ($this->exr_payment_progress ?? 0) == 0;
    }

    /**
     * Vérifie si la note de frais peut être supprimée
     * Impossible si approuvée ou comptabilisée
     */
    public function canBeDeleted(): bool
    {
        return !in_array($this->exr_status, ['approved', 'accounted']);
    }


    /**
     * Recalculer les totaux d'une note de frais
     */
    public static function recalculateTotals($expenseReportId)
    {
        $expenseReport = self::find($expenseReportId);

        if (!$expenseReport) {
            return;
        }

        // Totaux des depenses classiques
        $totals = ExpenseModel::where('fk_exr_id', $expenseReportId)
            ->selectRaw('
                COALESCE(SUM(exp_total_amount_ht), 0) as total_ht,
                COALESCE(SUM(exp_total_tva), 0) as total_tva,
                COALESCE(SUM(exp_total_amount_ttc), 0) as total_ttc
            ')
            ->first();

        // Totaux des frais kilometriques (pas de TVA)
        $mileageTotal = MileageExpenseModel::where('fk_exr_id', $expenseReportId)
            ->selectRaw('COALESCE(SUM(mex_calculated_amount), 0) as total_mileage')
            ->value('total_mileage') ?? 0;

        $expenseReport->update([
            'exr_total_amount_ht' => ($totals->total_ht ?? 0) + $mileageTotal,
            'exr_total_tva' => $totals->total_tva ?? 0,
            'exr_total_amount_ttc' => ($totals->total_ttc ?? 0) + $mileageTotal,
        ]);
    }

    /**
     * Met à jour le montant restant à payer pour une note de frais
     *
     * @param int|null $exrId ID de la note de frais (optionnel, utilise l'instance courante si non fourni)
     * @return void
     */
    public function updateAmountRemaining(?int $exrId = null): void
    {
        // Utiliser l'ID fourni ou celui de l'instance actuelle
        $expenseReportId = $exrId ?? $this->exr_id;

        if (!$expenseReportId) {
            return;
        }

        try {
            // Récupérer les informations de la note de frais
            $expenseReport = $exrId ? static::find($expenseReportId) : $this;

            if (!$expenseReport) {
                return;
            }

            // Calculer le montant total payé via les allocations
            $totalPaid = PaymentAllocationModel::where('fk_exr_id', $expenseReportId)
                ->sum('pal_amount');

            // Calculer le montant restant et le pourcentage de progression
            $totalTTC = $expenseReport->exr_total_amount_ttc ?? 0;
            $amountRemaining = round($totalTTC - ($totalPaid ?? 0), 2);
            $paymentProgress = $totalTTC != 0
                ? round((($totalPaid ?? 0) / $totalTTC) * 100, 2)
                : 0;

            // Mettre à jour sans déclencher les événements (évite les boucles infinies)
            $expenseReport->updateQuietly([
                'exr_amount_remaining' => $amountRemaining,
                'exr_payment_progress' => $paymentProgress,
            ]);
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la mise à jour du montant restant : " . $e->getMessage());
        }
    }
}
