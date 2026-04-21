<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\DeletesRelatedDocuments;
use Illuminate\Validation\ValidationException;

class ContractModel extends BizDocumentModel
{
    use DeletesRelatedDocuments;
    protected $table = 'contract_con';
    protected $primaryKey = 'con_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'con_created';
    const UPDATED_AT = 'con_updated';

    // Protection de la clé primaire
    protected $guarded = ['con_id'];

    /**
     * Statuts du contrat
     */
    public const STATUS_DRAFT      = 0;
    public const STATUS_ACTIVE     = 1;
    public const STATUS_TERMINATING  = 2;
    public const STATUS_TERMINATED  = 3;
    public const STATUS_FINISHED = 4;

    /**
     * Constantes métier – type d'opération
     */
    public const OPERATION_CUSTOMER_CONTRACT = 1;
    public const OPERATION_SUPPLIER_CONTRACT = 2;

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de contrat avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->con_number)) {
                // Mapping des types d'opération vers les modules
                $moduleMapping = [
                    self::OPERATION_CUSTOMER_CONTRACT => 'custcontract',
                    self::OPERATION_SUPPLIER_CONTRACT => 'suppliercontract',
                ];

                // Récupère le dernier numéro généré pour le même type d'opération
                $lastContract = static::where('con_operation', $model->con_operation)
                    ->orderBy('con_id', 'desc')
                    ->first();
                $lastNumber = $lastContract ? $lastContract->con_number : null;

                $model->con_number = static::generateSequenceNumber($moduleMapping[$model->con_operation], '', $lastNumber);
            }

            // Valider qu'il y a au moins une ligne produit (col_prttype=0) pour passer hors brouillon
            if ($model->isDirty('con_status') && $model->con_status > self::STATUS_DRAFT) {
                $model->validateHasProductLine();
            }
        });

        // Empêcher la modification si le contrat est TERMINATED ou SUSPENDED
        static::updating(function ($model) {
            $originalStatus = $model->getOriginal('con_status');

            if (in_array($originalStatus, [self::STATUS_FINISHED, self::STATUS_TERMINATING])) {
                throw new \Exception('Impossible de modifier un contrat terminé ou suspendu');
            }

            // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors edition
            if ($model->isDirty('con_being_edited')) {
                $model->validateHasProductLine();
            }
        });

        // Empêcher la suppression si le contrat n'est pas en DRAFT
        static::deleting(function ($model) {
            if ($model->con_status != self::STATUS_DRAFT) {
                throw new \Exception('Impossible de supprimer un contrat qui n\'est pas en brouillon');
            }
        });
    }

    /**
     * Implémentation des méthodes abstraites de BizDocumentModel
     */

    /**
     * Retourne le mapping des champs du document
     */
    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'con_id',
            'number' => 'con_number',
            'date' => 'con_date',
            'status' => 'con_status',
            'being_edited' => 'con_being_edited',
            'total_ht' => 'con_totalht',
            'total_ht_sub' => 'con_totalhtsub',
            'total_ht_comm' => 'con_totalhtcomm',
            'total_tax' => 'con_totaltax',
            'total_ttc' => 'con_totalttc',
            'partner_id' => 'fk_ptr_id',
            'contact_id' => 'fk_ctc_id',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
            'payment_mode_id' => 'fk_pam_id',
            'payment_condition_id' => 'fk_dur_id_payment_condition',
            'tax_position_id' => 'fk_tap_id',
            'note' => 'con_note',

            // Line fields (utilisés par recalculateTotals)
            'line_type' => 'col_type',
            'line_total_ht' => 'col_mtht',
            'line_tax_id' => 'fk_tax_id',
            'line_is_subscription' => 'col_is_subscription',
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
        // Doit dépendre du con_operation
        return '';
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        // NE PAS UTILISER CAR le numéro doit dépendre du con_operation
        // La logique est gérée dans le hook boot() -> saving()
        return '';
    }

    /**
     * Valide qu'il y a au moins une ligne produit (col_prttype=0) dans le contrat.
     *
     * @throws ValidationException
     */
    protected function validateHasProductLine(): void
    {
        $hasProductLine = $this->lines()->where('col_type', 0)->exists();

        if (!$hasProductLine) {
            throw ValidationException::withMessages([
                'lines' => ['Le contrat doit contenir au moins une ligne produit pour être validé.'],
            ]);
        }
    }

    /**
     * Relations héritées de BizDocumentModel :
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     * - partner() : Partenaire (client)
     * - paymentMode() : Mode de paiement
     * - paymentCondition() : Condition de paiement (via paymentConditionDuration)
     * - taxPosition() : Position fiscale
     */

    /**
     * Relations spécifiques au contrat
     */

    public function seller(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function saleOrder(): BelongsTo
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id', 'doc_id');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_con_id', 'con_id');
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    /**
     * Durées spécifiques au contrat
     */
    public function commitmentDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_commitment', 'dur_id');
    }

    public function renewDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_renew', 'dur_id');
    }

    public function noticeDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_notice', 'dur_id');
    }

    public function invoicingDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_invoicing', 'dur_id');
    }

    public function paymentConditionDuration(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_payment_condition', 'dur_id');
    }

    /**
     * Lignes du contrat
     */
    public function lines(): HasMany
    {
        return $this->hasMany(ContractLineModel::class, 'fk_con_id', 'con_id')
            ->orderBy('col_order');
    }

    /**
     * Scopes
     */
    public function scopeCustomerContracts($query)
    {
        return $query->where('con_operation', self::OPERATION_CUSTOMER_CONTRACT);
    }

    public function scopeSupplierContracts($query)
    {
        return $query->where('con_operation', self::OPERATION_SUPPLIER_CONTRACT);
    }

    /**
     * Méthodes métier
     */
    public function isCustomerContract(): bool
    {
        return $this->con_operation === self::OPERATION_CUSTOMER_CONTRACT;
    }

    public function isSupplierContract(): bool
    {
        return $this->con_operation === self::OPERATION_SUPPLIER_CONTRACT;
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_con_id';
    }
}
