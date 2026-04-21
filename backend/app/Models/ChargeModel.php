<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\HasSequenceNumber;
use App\Traits\DeletesRelatedDocuments;

class ChargeModel extends BaseModel
{
    use HasFactory, HasSequenceNumber, DeletesRelatedDocuments;

    protected $table = 'charge_che';
    protected $primaryKey = 'che_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'che_created';
    const UPDATED_AT = 'che_updated';

    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_FINALIZED = 1;
    const STATUS_ACCOUNTED = 2;

    // Protéger la clé primaire
    protected $guarded = ['che_id'];

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de charge avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->che_number)) {
                $model->che_number = static::generateSequenceNumber('charge');
            }

            // Valider la période comptable si che_date est défini ou modifié
            if ($model->isDirty('che_date') && $model->che_date) {
                AccountModel::validateWritingPeriod($model->che_date);
            }

            // Bloquer les modifications si la charge est comptabilisée
            if ($model->exists && $model->isDirty() && !$model->wasRecentlyCreated) {
                $original = $model->getOriginal();
                if (isset($original['che_status']) && $original['che_status'] == self::STATUS_ACCOUNTED) {
                    throw new \Exception("Impossible de modifier une charge comptabilisée");
                }
            }
        });

        // Bloquer la suppression si la charge est comptabilisée
        static::deleting(function ($model) {
            if ($model->che_status == self::STATUS_ACCOUNTED) {
                throw new \Exception("Impossible de supprimer une charge comptabilisée");
            }
        });
    }

    /**
     * Casts
     */
    protected $casts = [
        'che_date'               => 'date',
        'che_status'             => 'int',
        'che_totalttc'           => 'float',
        'che_amount_remaining'   => 'float',
        'che_balance'            => 'float',
        'che_payment_progress'   => 'int',
    ];

    /**
     * Relations utilisateurs
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
     * Relations métier
     */
    public function type()
    {
        return $this->belongsTo(ChargeTypeModel::class, 'fk_cht_id', 'cht_id');
    }

    public function paymentMode()
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id', 'pam_id');
    }

    /**
     * Scopes utiles
     */
    public function scopePaid($query)
    {
        return $query->where('che_amount_remaining', '<=', 0);
    }

    public function scopeUnpaid($query)
    {
        return $query->where('che_amount_remaining', '>', 0);
    }

    public function scopeDraft($query)
    {
        return $query->where('che_status', self::STATUS_DRAFT);
    }

    public function scopeFinalized($query)
    {
        return $query->where('che_status', self::STATUS_FINALIZED);
    }

    public function scopeAccounted($query)
    {
        return $query->where('che_status', self::STATUS_ACCOUNTED);
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_che_id', 'che_id');
    }


    /**
     * Helpers métier
     */
    public function isPaid(): bool
    {
        return ($this->che_amount_remaining ?? 0) <= 0;
    }

    /**
     * Met à jour le montant restant dû et le pourcentage de paiement d'une charge
     *
     * @param int|null $cheId ID de la charge (null = utilise l'instance actuelle)
     * @return void
     */
    public function updateAmountRemaining(?int $cheId = null): void
    {
        // Utiliser l'ID fourni ou celui de l'instance actuelle
        $chargeId = $cheId ?? $this->che_id;

        if (!$chargeId) {
            return;
        }

        try {
            // Récupérer les informations de la charge
            $charge = $cheId ? static::find($chargeId) : $this;

            if (!$charge) {
                return;
            }

            // Calculer le montant total payé
            $totalPaid = PaymentAllocationModel::where('fk_che_id', $chargeId)
                ->sum('pal_amount');

            // Calculer le montant restant et le pourcentage de progression
            $amountRemaining = round($charge->che_totalttc - ($totalPaid ?? 0), 2);
            $paymentProgress = $charge->che_totalttc != 0
                ? round((($totalPaid ?? 0) / $charge->che_totalttc) * 100, 2)
                : 0;

            // Mettre à jour sans déclencher les événements (évite les boucles infinies)
            $charge->updateQuietly([
                'che_amount_remaining' => $amountRemaining,
                'che_payment_progress' => $paymentProgress,
            ]);
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la mise à jour du montant restant : " . $e->getMessage());
        }
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        $lastCharge = static::orderBy('che_id', 'DESC')->first();
        return $lastCharge && $lastCharge->che_number ? $lastCharge->che_number : '';
    }

    /**
     * Retourne le statut formaté pour l'affichage
     */
    public function getStatusConfig(): array
    {
        $statuses = [
            null => ["statusClass" => "status-tag-gray", "statusText" => "Brouillon"],
            self::STATUS_DRAFT => ["statusClass" => "status-tag-gray", "statusText" => "Brouillon"],
            self::STATUS_FINALIZED => ["statusClass" => "status-tag-emerald", "statusText" => "Validée"],
            self::STATUS_ACCOUNTED => ["statusClass" => "status-tag-emerald", "statusText" => "Comptabilisée"],
        ];

        return $statuses[$this->che_status] ?? $statuses[null];
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_che_id';
    }
}
