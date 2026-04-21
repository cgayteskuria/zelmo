<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\DeletesRelatedDocuments;
use App\Http\Controllers\Api\ApiDeliveryNoteController;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderModel extends BizDocumentModel
{
    use HasFactory, DeletesRelatedDocuments;

    protected $table = 'purchase_order_por';
    protected $primaryKey = 'por_id';

    const CREATED_AT = 'por_created';
    const UPDATED_AT = 'por_updated';

    protected $guarded = [];

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de commande avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->por_number)) {
                $model->por_number = static::generateSequenceNumber('purchaseorder');
            }

            // Valider la période comptable si por_date est défini ou modifié
            if ($model->isDirty('por_date') && $model->por_date) {
                AccountModel::validateWritingPeriod($model->por_date);
            }

            // Valider qu'il y a au moins une ligne produit (pol_prttype=0) pour passer hors brouillon
            if ($model->isDirty('por_status') && $model->por_status > self::STATUS_DRAFT) {
                $model->validateHasProductLine();
            }

            // Bloquer la modification si un BL livré existe (sauf champs autorisés)
            if ($model->exists) {
                $allowedFields = ['por_invoicing_state', 'por_delivery_state', 'por_updated', 'por_status'];
                $dirtyFields = array_keys($model->getDirty());
                $hasRestrictedChanges = count(array_diff($dirtyFields, $allowedFields)) > 0;

                if ($hasRestrictedChanges) {
                    $hasDeliveredNote = DB::table('delivery_note_dln')
                        ->where('fk_ord_id', $model->ord_id)
                        ->where('dln_status',  DeliveryNoteModel::STATUS_VALIDATED)
                        ->where('dln_operation',  DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)
                        ->exists();

                    if ($hasDeliveredNote) {
                        throw new \InvalidArgumentException('Cette commande ne peut plus être modifiée car un bon de d\'expédition a été expédié.');
                    }
                }
            }
        });


        static::updating(function ($model) {
            // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors edition
            if ($model->isDirty('por_being_edited')) {
                $model->validateHasProductLine();
            }
        });

        // Auto-générer un BR brouillon quand la commande passe en "En cours"
        static::saved(function ($model) {
            if ($model->wasChanged('por_status') && (int) $model->por_status === self::STATUS_IN_PROGRESS) {
                ApiDeliveryNoteController::autoGenerateFromPurchaseOrder($model);
            }
        });
    }

    /* =========================
       Casts
       ========================= */
    protected $casts = [
        'por_date' => 'date',
        'por_valid' => 'date',
        'por_being_edited' => 'boolean',
        'por_totalht' => 'decimal:2',
        'por_totaltax' => 'decimal:2',
        'por_totalttc' => 'decimal:2',
    ];

    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_WAITING_VALIDATION = 1;
    const STATUS_CANCELLED = 2;
    const STATUS_IN_PROGRESS = 3;

    // Constantes d'état de réception
    const RECEPTION_NOT_RECEIVED = 0;
    const RECEPTION_PARTIALLY = 1;
    const RECEPTION_FULLY = 2;

    // Constantes d'état de facturation fournisseur
    const INVOICING_NOT_INVOICED = 0;
    const INVOICING_PARTIALLY = 1;
    const INVOICING_FULLY = 2;

    /**
     * Relations communes héritées de BizDocumentModel :
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     * - partner() : Partenaire (fournisseur)
     * - paymentMode() : Mode de paiement
     * - paymentCondition() : Condition de paiement
     * - taxPosition() : Position fiscale
     */

    /**
     * Relations spécifiques à PurchaseOrder
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

    public function seller(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_id', 'whs_id');
    }

    public function saleOrder(): BelongsTo
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_requester', 'usr_id');
    }


    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLineModel::class, 'fk_por_id', 'por_id')->orderBy('pol_order');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_por_id', 'por_id');
    }

    /**
     * Implémentation des méthodes abstraites de BizDocumentModel
     */
    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'por_id',
            'number' => 'por_number',
            'date' => 'por_date',
            'status' => 'por_status',
            'being_edited' => 'por_being_edited',
            'total_ht' => 'por_totalht',
            'total_tax' => 'por_totaltax',
            'total_ttc' => 'por_totalttc',
            'invoicing_state' => 'por_invoicing_state',
            'delivery_state' => 'por_delivery_state',
            'partner_id' => 'fk_ptr_id',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
            'payment_mode_id' => 'fk_pmc_id',
            'payment_condition_id' => 'fk_dur_id_payment_condition',
            'tax_position_id' => 'fk_tap_id',
            'note' => 'por_note',

            // Line fields
            'line_type' => 'pol_type',
            'line_total_ht' => 'pol_mtht',
            'line_tax_id' => 'fk_tax_id',
        ];
    }

    protected function getTrlDocumentType(): string
    {
        return 'in_invoice';
    }

    protected function getLinesRelationship(): string
    {
        return 'lines';
    }

    protected function getSequenceModule(): string
    {
        return 'purchaseorder';
    }

    protected static function getLastSequenceNumber(): string
    {
        return static::max('por_number') ?? '0';
    }

    /**
     * Valide qu'il y a au moins une ligne produit (pol_prttype=0) dans la commande.
     *
     * @throws ValidationException
     */
    protected function validateHasProductLine(): void
    {
        $hasProductLine = $this->lines()->where('pol_type', 0)->exists();

        if (!$hasProductLine) {
            throw ValidationException::withMessages([
                'lines' => ['La commande doit contenir au moins une ligne produit pour être validée.'],
            ]);
        }
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('por_status', [self::STATUS_CANCELLED]);
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_por_id';
    }
}
