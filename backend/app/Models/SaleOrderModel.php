<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\DeletesRelatedDocuments;
use App\Http\Controllers\Api\ApiDeliveryNoteController;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleOrderModel extends BizDocumentModel
{
    use HasFactory, DeletesRelatedDocuments;

    protected $table = 'sale_order_ord';
    protected $primaryKey = 'ord_id';

    const CREATED_AT = 'ord_created';
    const UPDATED_AT = 'ord_updated';

    protected $guarded = [];

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de commande avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->ord_number)) {
                $model->ord_number = static::generateSequenceNumber('saleorder');
            }

            // Valider la période comptable si ord_date est défini ou modifié
            if ($model->isDirty('ord_date') && $model->ord_date) {
                AccountModel::validateWritingPeriod($model->ord_date);
            }

            // Valider qu'il y a au moins une ligne produit (orl_type=0) pour passer hors brouillon
            if ($model->isDirty('ord_status') && $model->ord_status > self::STATUS_DRAFT) {
                $model->validateHasProductLine();
            }

            // Bloquer la modification si un BL livré existe (sauf champs autorisés)
            if ($model->exists) {
                $allowedFields = ['ord_invoicing_state', 'ord_delivery_state', 'ord_updated', 'ord_status'];
                $dirtyFields = array_keys($model->getDirty());
                $hasRestrictedChanges = count(array_diff($dirtyFields, $allowedFields)) > 0;

                if ($hasRestrictedChanges) {
                    $hasDeliveredNote = DB::table('delivery_note_dln')
                        ->where('fk_ord_id', $model->ord_id)
                        ->where('dln_status',  DeliveryNoteModel::STATUS_VALIDATED)
                        ->where('dln_operation',  DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)
                        ->exists();

                    if ($hasDeliveredNote) {
                        throw new \InvalidArgumentException('Cette commande ne peut plus être modifiée car un bon de livraison a été livré.');
                    }
                }
            }
        });


        static::updating(function ($model) {
            // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors edition
            if ($model->isDirty('ord_being_edited')) {
                $model->validateHasProductLine();
            }
        });
        // Auto-générer un BL brouillon quand la commande passe en "En cours"
        static::saved(function ($model) {
            if ($model->wasChanged('ord_status') && (int) $model->ord_status === self::STATUS_IN_PROGRESS) {
                ApiDeliveryNoteController::autoGenerateFromSaleOrder($model);
            }
        });
    }

    protected $casts = [
        'ord_date' => 'date',
        'ord_valid' => 'date',
        'ord_being_edited' => 'boolean',
        'ord_totalht' => 'decimal:2',
        'ord_totalhtsub' => 'decimal:2',
        'ord_totalhtcomm' => 'decimal:2',
        'ord_totaltax' => 'decimal:2',
        'ord_totalttc' => 'decimal:2',
    ];

    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_WAITING_VALIDATION = 1;
    const STATUS_REFUSED = 2;
    const STATUS_IN_PROGRESS = 3;
    const STATUS_CANCELLED = 4;
    const STATUS_COMPLETED = 5;

    // Constantes d'état de facturation
    const INVOICING_NOT_INVOICED = 0;
    const INVOICING_PARTIALLY = 1;
    const INVOICING_FULLY = 2;
    const INVOICING_IN_CONTRACT = 3;

    // Constantes d'état de livraison
    const DELIVERY_NOT_DELIVERED = 0;
    const DELIVERY_PARTIALLY = 1;
    const DELIVERY_FULLY = 2;

    /**
     * Relations communes héritées de BaseDocumentModel :
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     * - partner() : Partenaire (client)
     * - paymentMode() : Mode de paiement
     * - paymentCondition() : Condition de paiement
     * - taxPosition() : Position fiscale
     */

    /**
     * Relations spécifiques à SaleOrder
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function taxPosition(): BelongsTo
    {
        return $this->belongsTo(AccountTaxPositionModel::class, 'fk_tap_id', 'tap_id');
    }

    public function paymentCondition(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_payment_condition', 'dur_id');
    }

    public function paymentMode(): BelongsTo
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id', 'pam_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_id', 'whs_id');
    }

    public function commitmentDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id', 'dur_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SaleOrderLineModel::class, 'fk_ord_id', 'ord_id')->orderBy('orl_order');
    }
    /* public function contracts(): HasMany
    {
        return $this->hasMany(ContractModel::class, 'sale_order_id', 'ord_id');
    }*/
    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_ord_id', 'ord_id');
    }

    /**
     * Scopes
     */
    public function scopeQuotations($query)
    {
        return $query->where(function ($q) {
            $q->where('ord_status', '<', self::STATUS_IN_PROGRESS)
                ->orWhereNull('ord_status');
        });
    }

    public function scopeOrders($query)
    {
        return $query->where('ord_status', '>=', self::STATUS_IN_PROGRESS);
    }

    public function scopeActive($query)
    {
        return $query->whereNotIn('ord_status', [self::STATUS_CANCELLED, self::STATUS_COMPLETED]);
    }

    /**
     * Implémentation des méthodes abstraites de BaseDocumentModel
     */

    /**
     * Retourne le mapping des champs du document
     */
    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'ord_id',
            'number' => 'ord_number',
            'date' => 'ord_date',
            'status' => 'ord_status',
            'being_edited' => 'ord_being_edited',
            'total_ht' => 'ord_totalht',
            'total_ht_sub' => 'ord_totalhtsub',
            'total_ht_comm' => 'ord_totalhtcomm',
            'total_tax' => 'ord_totaltax',
            'total_ttc' => 'ord_totalttc',
            'invoicing_state' => 'ord_invoicing_state',
            'delivery_state' => 'ord_delivery_state',
            'partner_id' => 'fk_ptr_id',
            'contact_id' => 'fk_ctt_id',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
            'payment_mode_id' => 'fk_pmc_id',
            'payment_condition_id' => 'fk_dur_id_payment_condition',
            'tax_position_id' => 'fk_tap_id',
            'note' => 'ord_note',

            // Line fields (utilisés par recalculateTotals)
            'line_type' => 'orl_type',
            'line_total_ht' => 'orl_mtht',
            'line_tax_id' => 'fk_tax_id',
            'line_is_subscription' => 'orl_is_subscription',
        ];
    }

    protected function getTrlDocumentType(): string
    {
        return 'out_invoice';
    }

    /**
     * Retourne le nom de la relation pour accéder aux lignes
     */
    protected function getLinesRelationship(): string
    {
        return 'lines';
    }

    /**
     * Retourne le module pour le séquençage des numéros
     */
    protected function getSequenceModule(): string
    {
        return 'saleorder';
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        $lastOrder = static::orderBy('ord_id', 'DESC')->first();
        return $lastOrder && $lastOrder->ord_number ? $lastOrder->ord_number : '';
    }

    /**
     * Valide qu'il y a au moins une ligne produit (orl_type=0) dans la commande.
     *
     * @throws ValidationException
     */
    protected function validateHasProductLine(): void
    {
        $hasProductLine = $this->lines()->where('orl_type', 0)->exists();

        if (!$hasProductLine) {
            throw ValidationException::withMessages([
                'lines' => ['Le devis doit contenir au moins une ligne produit pour être validée.'],
            ]);
        }
    }

    /**
     * Méthodes métier spécifiques à SaleOrder
     * (La méthode recalculateTotals() est maintenant héritée de BaseDocumentModel)
     */

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_ord_id';
    }
}
