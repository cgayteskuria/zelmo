<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class DurationsModel extends BaseModel
{
    protected $table = 'duration_dur';
    protected $primaryKey = 'dur_id';
    public $incrementing = true;
    protected $keyType = 'int';

    // Utiliser les timestamps Laravel standard
    const CREATED_AT = 'dur_created';
    const UPDATED_AT = 'dur_updated';

    protected $fillable = [
        'dur_label',
        'dur_reference',
        'dur_order',
        'dur_value',
        'dur_time_unit',
        'dur_mode',
        'fk_usr_id_author',
        'fk_usr_id_updater'
    ];

    // Constantes pour les types de durées
    const TYPE_COMMITMENT = 1;      // Durée abonnement
    const TYPE_NOTICE = 2;          // Durée de préavis contrat
    const TYPE_RENEW = 3;           // Durée de renouvellement contrat
    const TYPE_INVOICING = 4;       // Fréquence de facturation contrat
    const TYPE_PAYMENT_CONDITION = 5; // Condition de Règlement


    /**
     * Scopes pour filtrer par type de durée
     */
    public function scopeCommitment($query)
    {
        return $query->where('dur_reference', self::TYPE_COMMITMENT);
    }

    public function scopeNotice($query)
    {
        return $query->where('dur_reference', self::TYPE_NOTICE);
    }

    public function scopeRenew($query)
    {
        return $query->where('dur_reference', self::TYPE_RENEW);
    }

    public function scopeInvoicing($query)
    {
        return $query->where('dur_reference', self::TYPE_INVOICING);
    }

    public function scopePaymentCondition($query)
    {
        return $query->where('dur_reference', self::TYPE_PAYMENT_CONDITION);
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('dur_reference', $type);
    }

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

    /**
     * Ajoute une durée à une date en fonction de l'unité de temps
     *
     * @param \DateTime $date La date à modifier
     * @param string $unit L'unité de temps ('day', 'monthly', 'annually')
     * @param int $value La valeur de la durée
     * @return void
     */
    private static function addDuration(\DateTime $date, string $unit, int $value): void
    {
        switch ($unit) {
            case 'day':
                $date->modify("+{$value} days");
                break;
            case 'monthly':
                $date->modify("+{$value} months");
                break;
            case 'annually':
                $date->modify("+{$value} years");
                break;
        }
    }

    /**
     * Calcule la prochaine date d'échéance à partir d'une base et d'une durée définie.
     *
     * - Le calcul dépend du mode de facturation ('advance' ou 'arrears') et de l'unité de durée ('day', 'monthly', 'annually').
     * - Retourne une date au format Y-m-d
     *
     * @param int|null $durId Identifiant de la durée
     * @param string|\DateTime|\Illuminate\Support\Carbon $baseDate Date de base (string Y-m-d, DateTime ou Carbon)
     * @param bool $firstDur Indique s'il s'agit de la première durée (pour éviter l'ajout en mode 'advance')
     * @return string|null Date calculée au format Y-m-d, ou null si la durée n'existe pas
     * @throws \Exception Si le format de date est invalide ou la date n'est pas valide
     */
    public static function calculateNextDate(?int $durId, string|\DateTime $baseDate, bool $firstDur = false): ?string
    {
        try {
            // Conversion de baseDate en objet DateTime
            if (is_string($baseDate)) {
                // Validation stricte du format de date YYYY-MM-DD
                if (!empty($baseDate)) {
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $baseDate)) {
                        throw new \Exception("Invalid date format. Expected format: YYYY-MM-DD, got: $baseDate");
                    }

                    // Vérification que la date est valide (ex: pas de 2024-02-30)
                    $dateParts = explode('-', $baseDate);
                    $year = (int)$dateParts[0];
                    $month = (int)$dateParts[1];
                    $day = (int)$dateParts[2];

                    // Validation de l'année (entre 1900 et 2100 par exemple)
                    if ($year < 1900 || $year > 2100) {
                        throw new \Exception("Invalid year: $year. Year must be between 1900 and 2100");
                    }

                    if (!checkdate($month, $day, $year)) {
                        throw new \Exception("Invalid date value: $baseDate");
                    }
                }

                try {
                    $date = new \DateTime($baseDate);
                } catch (\Exception $e) {
                    throw new \InvalidArgumentException("Failed to create date object: " . $e->getMessage());
                }
            } elseif ($baseDate instanceof \Illuminate\Support\Carbon) {
                // Conversion de Carbon en DateTime
                $date = $baseDate->toDateTime();
            } elseif ($baseDate instanceof \DateTime) {
                // Clone pour éviter de modifier l'objet original
                $date = clone $baseDate;
            } else {
                throw new \InvalidArgumentException("baseDate must be a string (Y-m-d format), DateTime or Carbon instance");
            }

            // Récupérer la durée
            $duration = self::find($durId);
            if (!$duration) {
                return null;
            }

            $durTimeUnit = $duration->dur_time_unit;
            $durValue = (int)$duration->dur_value;
            $mode = $duration->dur_mode ?? "";

            // Calcul de la prochaine date en fonction du mode et de l'unité
            if ($mode === 'advance') {
                if (!$firstDur) {
                    self::addDuration($date, $durTimeUnit, $durValue);
                    $date->modify('first day of this month');
                }
            } elseif ($mode === 'arrears') {
                self::addDuration($date, $durTimeUnit, $durValue);
                $date->modify('last day of this month');
            } elseif ($mode === '') {
                self::addDuration($date, $durTimeUnit, $durValue);
            }

            return $date->format('Y-m-d');
        } catch (\Exception $e) {
            throw new \Exception($e->getMessage());
        }
    }

    /**
     * Trouve l'ID d'une condition de règlement à partir d'un libellé OCR (ex: "15 Jours")
     *
     * @param string|null $ocrLabel Le texte extrait par l'OCR
     * @return int|null L'identifiant dur_id ou null si non trouvé
     */
    public static function findIdByOcrLabel(?string $ocrLabel): ?array
    {
        if (empty($ocrLabel)) {
            return null;
        }

        // 1. Tentative de correspondance exacte (insensible à la casse)
        $exactMatch = self::paymentCondition()
            ->where('dur_label', 'LIKE', trim($ocrLabel))
            ->first();

        if ($exactMatch) {
            return ["dur_id" => $exactMatch?->dur_id, "dur_label" => $exactMatch?->dur_label];
        }

        // 2. Extraction du nombre depuis le libellé (ex: "30 jours fin de mois" -> 30)
        // On cherche le premier bloc de chiffres dans la chaîne
        preg_match('/\d+/', $ocrLabel, $matches);

        if (!empty($matches[0])) {
            $extractedValue = (int)$matches[0];

            // On cherche une condition de règlement qui a cette valeur (dur_value)
            // On peut aussi affiner en vérifiant l'unité (souvent 'day')
            $valueMatch = self::paymentCondition()
                ->where('dur_value', $extractedValue)
                ->first();

            if ($valueMatch) {
                return $valueMatch->dur_id;
            }
        }

        // 3. Fallback : Si c'est "Comptant" ou contient "immédiat"
        if (stripos($ocrLabel, 'comptant') !== false || stripos($ocrLabel, 'immédiat') !== false) {
            $immediateMatch = self::paymentCondition()
                ->where('dur_value', 0)
                ->first();

            return ["dur_id" => $immediateMatch?->dur_id, "dur_label" => $immediateMatch?->dur_label];
        }

        return null;
    }
}
