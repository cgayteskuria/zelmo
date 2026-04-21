<?php

namespace App\Models;


class MileageScaleModel extends BaseModel
{
    protected $table = 'mileage_scale_msc';
    protected $primaryKey = 'msc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'msc_created_at';
    const UPDATED_AT = 'msc_updated_at';

    protected $fillable = [
        'msc_year',
        'msc_vehicle_type',
        'msc_fiscal_power',
        'msc_min_distance',
        'msc_max_distance',
        'msc_coefficient',
        'msc_constant',
        'msc_is_active',
        'fk_usr_id_author',
        'fk_usr_id_updater',
    ];

    protected $casts = [
        'msc_year' => 'integer',
        'msc_min_distance' => 'integer',
        'msc_max_distance' => 'integer',
        'msc_coefficient' => 'decimal:4',
        'msc_constant' => 'decimal:2',
        'msc_is_active' => 'boolean',
    ];

    // Relations
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('msc_is_active', 1);
    }

    public function scopeForYear($query, int $year)
    {
        return $query->where('msc_year', $year);
    }

    /**
     * Trouver le taux applicable pour un véhicule et une distance
     * 
     * @param int $fiscalPower Puissance fiscale (CV)
     * @param float $distance Distance totale annuelle en km
     * @param string $vehicleType Type de véhicule (car, motorcycle, etc.)
     * @param int $year Année du barème
     * @return array|null ['coefficient' => float, 'constant' => float]
     */
    public static function findRate(
        int $fiscalPower,
        float $annualDistance,
        string $vehicleType,
        int $year
    ): ?array {
        $rate = self::where('msc_year', $year)
            ->where('msc_vehicle_type', $vehicleType)
            ->where('msc_is_active', true)
            // Vérifier la plage de distance
            ->where(function ($query) use ($annualDistance) {
                $query->where(function ($q) use ($annualDistance) {
                    $q->where('msc_min_distance', '<=', $annualDistance)
                        ->where('msc_max_distance', '>=', $annualDistance);
                })
                    ->orWhere(function ($q) use ($annualDistance) {
                        $q->where('msc_min_distance', '<=', $annualDistance)
                            ->whereNull('msc_max_distance');
                    });
            })
            ->get()
            ->first(function ($rate) use ($fiscalPower) {
                return self::matchesFiscalPower($rate->msc_fiscal_power, $fiscalPower);
            });

        if (!$rate) {
            if ($year > 2020) {
                return self::findRate($fiscalPower, $annualDistance, $vehicleType, $year - 1);
            }
            return null;
        }

        return [
            'coefficient' => (float) $rate->msc_coefficient,
            'constant' => (float) $rate->msc_constant,
            'label' => $rate->msc_label ?? $rate->msc_fiscal_power,
        ];
    }

    /**
     * Vérifier si une puissance fiscale correspond à la plage
     */
    private static function matchesFiscalPower(string $powerRange, int $fiscalPower): bool
    {
        // Plage exacte (ex: "5")
        if (is_numeric($powerRange)) {
            return (int) $powerRange === $fiscalPower;
        }

        // >= (ex: ">=7")
        if (preg_match('/^>=(\d+)$/', $powerRange, $matches)) {
            return $fiscalPower >= (int) $matches[1];
        }

        // > (ex: ">5")
        if (preg_match('/^>(\d+)$/', $powerRange, $matches)) {
            return $fiscalPower > (int) $matches[1];
        }

        // <= (ex: "<=3")
        if (preg_match('/^<=(\d+)$/', $powerRange, $matches)) {
            return $fiscalPower <= (int) $matches[1];
        }

        // Plage (ex: "3-5")
        if (preg_match('/^(\d+)-(\d+)$/', $powerRange, $matches)) {
            return $fiscalPower >= (int) $matches[1] && $fiscalPower <= (int) $matches[2];
        }

        return false;
    }
    /**
     * Calculer le montant incrémental pour un nouveau trajet
     * selon la logique française de régularisation
     * 
     * Cette méthode calcule :
     * 1. Le total dû pour le cumul annuel (ancien + nouveau)
     * 2. Soustrait ce qui a déjà été payé
     * 3. Retourne le montant à rembourser pour CE trajet
     * 
     * @param float $previousAnnualDistance Distance annuelle avant ce trajet
     * @param float $newTripDistance Distance du nouveau trajet
     * @param float $alreadyPaid Montant déjà payé sur l'année
     * @param int $fiscalPower Puissance fiscale
     * @param string $vehicleType Type de véhicule
     * @param int $year Année
     * @return array ['amount' => float, 'coefficient' => float, 'constant' => float, 'total_due' => float]
     */
    public static function calculateIncrementalAmount(
        float $previousAnnualDistance,
        float $newTripDistance,
        float $alreadyPaid,
        int $fiscalPower,
        string $vehicleType,
        int $year
    ): array {
        $newAnnualTotal = $previousAnnualDistance + $newTripDistance;

        // Trouver la tranche applicable pour le nouveau total annuel
        $rate = self::findRate($fiscalPower, $newAnnualTotal, $vehicleType, $year);

        if (!$rate) {
            throw new \Exception("Aucun barème trouvé pour ces paramètres");
        }

        // Calculer le total dû pour le cumul annuel
        $totalDue = self::calculateAnnualAmount(
            $newAnnualTotal,
            $rate['coefficient'],
            $rate['constant']
        );

        // Le montant à rembourser = total dû - déjà payé
        $amountToReimburse = $totalDue - $alreadyPaid;

        // Sécurité : le montant ne peut pas être négatif
        $amountToReimburse = max(0, $amountToReimburse);

        return [
            'amount' => round($amountToReimburse, 2),
            'coefficient' => $rate['coefficient'],
            'constant' => $rate['constant'],
            'total_due' => round($totalDue, 2),
            'already_paid' => round($alreadyPaid, 2),
        ];
    }
    /**
     * Calculer le montant TOTAL des frais kilométriques pour une distance annuelle
     * Formule française : (distance annuelle × coefficient) + constant
     * 
     * @param float $annualDistance Distance annuelle totale
     * @param float $coefficient Coefficient du barème
     * @param float $constant Constante du barème
     * @return float Montant total calculé
     */
    public static function calculateAnnualAmount(
        float $annualDistance,
        float $coefficient,
        float $constant
    ): float {
        $amount = ($annualDistance * $coefficient) + $constant;
        return round($amount, 2);
    }
    /**
     * Calculer le montant de remboursement.
     * Formule : montant = (distance * coefficient) + constante
     */
    public static function calculateAmount(float $distance, float $coefficient, float $constant): float
    {
        return round(($distance * $coefficient) + $constant, 2);
    }
}
