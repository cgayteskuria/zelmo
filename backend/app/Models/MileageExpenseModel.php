<?php

namespace App\Models;

use Carbon\Carbon;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class MileageExpenseModel extends BaseModel
{
    use HasFactory;

    protected $table = 'mileage_expense_mex';
    protected $primaryKey = 'mex_id';
    public $incrementing = true;
    protected $keyType = 'int';

    /**
     * Boot du modele - Recalculer les totaux de la note de frais parente
     */
    protected static function boot()
    {
        parent::boot();

        // Apres creation
        static::created(function ($mileage) {
            if ($mileage->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($mileage->fk_exr_id);
                $expenseReport = ExpenseReportModel::find($mileage->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
        });

        // Apres modification
        static::updated(function ($mileage) {
            if ($mileage->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($mileage->fk_exr_id);
                $expenseReport = ExpenseReportModel::find($mileage->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
        });

        // Apres suppression
        static::deleted(function ($mileage) {
            if ($mileage->fk_exr_id) {
                ExpenseReportModel::recalculateTotals($mileage->fk_exr_id);
                $expenseReport = ExpenseReportModel::find($mileage->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }
        });
    }

    const CREATED_AT = 'mex_created_at';
    const UPDATED_AT = 'mex_updated_at';

    protected $fillable = [
        'fk_exr_id',
        'fk_vhc_id',
        'mex_date',
        'mex_departure',
        'mex_destination',
        'mex_distance_km',
        'mex_is_round_trip',
        'mex_fiscal_power',
        'mex_vehicle_type',
        'mex_rate_coefficient',
        'mex_rate_constant',
        'mex_calculated_amount',
        'mex_notes',
    ];

    protected $casts = [
        'mex_date' => 'date',
        'mex_distance_km' => 'decimal:1',
        'mex_calculated_amount' => 'decimal:2',
        'mex_rate_coefficient' => 'decimal:4',
        'mex_rate_constant' => 'decimal:2',
        'mex_is_round_trip' => 'boolean',
        'mex_fiscal_power' => 'integer',
    ];

    // Relations
    public function expenseReport()
    {
        return $this->belongsTo(ExpenseReportModel::class, 'fk_exr_id', 'exr_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(VehicleModel::class, 'fk_vhc_id', 'vhc_id');
    }

    /**
     * Distance effective (prend en compte l'aller-retour)
     */
    public function getEffectiveDistanceAttribute(): float
    {
        $base = (float) $this->mex_distance_km;
        return $this->mex_is_round_trip ? $base * 2 : $base;
    }

    /**
     * Récupérer l'exercice comptable pour une date donnée
     * 
     * @param string $date
     * @return \App\Models\AccountExerciseModel
     * @throws \Exception Si aucun exercice comptable n'est trouvé
     */
    public static function getExerciseForDate(string $date): \App\Models\AccountExerciseModel
    {
        $dateCarbon = Carbon::parse($date);

        // Récupérer l'exercice comptable correspondant à la date
        $exercise = \App\Models\AccountExerciseModel::where(function ($query) use ($dateCarbon) {
            $query->where('aex_start_date', '<=', $dateCarbon)
                ->where('aex_end_date', '>=', $dateCarbon);
        })->first();

        if (!$exercise) {
            throw new \Exception(
                "Aucun exercice comptable trouvé pour la date " . $dateCarbon->format('d/m/Y') .
                    ". Veuillez vérifier que la date est bien dans un exercice comptable valide."
            );
        }

        return $exercise;
    }
    /**
     * Calculer le total des montants déjà payés pour un véhicule sur l'exercice
     * (utile pour la régularisation progressive)
     * 
     * @param int $vehicleId
     * @param string $date Date dans l'exercice
     * @param int|null $excludeExpenseId ID à exclure (pour modification)
     * @return float
     */
    public static function getYearlyPaidAmount(int $vehicleId, string $date, ?int $excludeExpenseId = null): float
    {
        $exercise = self::getExerciseForDate($date);

        $query = self::where('fk_vhc_id', $vehicleId)
            ->whereBetween('mex_date', [$exercise->aex_start_date, $exercise->aex_end_date]);

        if ($excludeExpenseId) {
            $query->where('mex_id', '!=', $excludeExpenseId);
        }

        return (float) $query->sum('mex_calculated_amount');
    }
    /**
     * Calculer le total des kilomètres effectués pour un véhicule sur l'exercice comptable
     * 
     * @param int $vehicleId ID du véhicule
     * @param string $date Date pour déterminer l'exercice (format Y-m-d)
     * @param int|null $excludeExpenseId ID de la dépense à exclure (en cas de modification)
     * @return float Total des kilomètres effectués
     * @throws \Exception Si aucun exercice comptable n'est trouvé
     */
    public static function getYearlyDistanceForVehicle(int $vehicleId, string $date, ?int $excludeExpenseId = null): float
    {
        $exercise = self::getExerciseForDate($date);

        $query = self::where('fk_vhc_id', $vehicleId)
            ->whereBetween('mex_date', [$exercise->aex_start_date, $exercise->aex_end_date]);

        if ($excludeExpenseId) {
            $query->where('mex_id', '!=', $excludeExpenseId);
        }

        return $query->get()->sum(function ($expense) {
            return $expense->effective_distance;
        });
    }
    /**
     * Trouver le taux applicable pour une puissance fiscale, distance et type de vehicule.
     *
     * @param int $fiscalPower CV fiscal (3, 4, 5, 6, 7+)
     * @param float $distance Distance pour determiner la tranche
     * @param string $vehicleType Type de vehicule (car, motorcycle, moped)
     * @param int|null $year Annee fiscale (defaut: annee courante)
     * @return array|null ['coefficient' => float, 'constant' => float]
     */
   /* public static function findRate(int $fiscalPower, float $distance, string $vehicleType = 'car', ?int $year = null): ?array
    {
        $year = $year ?? (int) date('Y');
        $cvLabel = $fiscalPower >= 7 ? '7+' : (string) $fiscalPower;

        $rate = self::active()
            ->where('msc_year', $year)
            ->where('msc_vehicle_type', $vehicleType)
            ->where('msc_fiscal_power', $cvLabel)
            ->where('msc_min_distance', '<=', $distance)
            ->where(function ($q) use ($distance) {
                $q->where('msc_max_distance', '>=', $distance)
                    ->orWhereNull('msc_max_distance');
            })
            ->first();

        if (!$rate) {
            return null;
        }

        return [
            'coefficient' => (float) $rate->msc_coefficient,
            'constant' => (float) $rate->msc_constant,
        ];
    }*/
}
