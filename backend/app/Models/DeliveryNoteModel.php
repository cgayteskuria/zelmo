<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Services\StockService;
use App\Traits\DeletesRelatedDocuments;
use App\Traits\HasSequenceNumber;

class DeliveryNoteModel extends BaseModel
{
    use DeletesRelatedDocuments, HasSequenceNumber;

    protected $table = 'delivery_note_dln';
    protected $primaryKey = 'dln_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'dln_created';
    const UPDATED_AT = 'dln_updated';

    // Protection des champs
    protected $guarded = ['dln_id'];

    const STATUS_DRAFT = 0;
    const STATUS_VALIDATED = 1;

    /**
     * Constantes métier – type d'opération
     */
    const OPERATION_CUSTOMER_DELIVERY   = 1; // Livraison client (stock / physique)
    const OPERATION_SUPPLIER_DELIVERY   = 2; // Livraison fournisseur

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de bon de livraison avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->dln_number)) {
                // Mapping des types d'opération vers les modules
                $moduleMapping = [
                    self::OPERATION_CUSTOMER_DELIVERY => 'custdeliverynote',
                    self::OPERATION_SUPPLIER_DELIVERY => 'supplierdeliverynote',
                ];

                // Récupère le dernier numéro généré pour le même type d'opération
                $lastDeliveryNote = static::where('dln_operation', $model->dln_operation)
                    ->orderBy('dln_id', 'desc')
                    ->first();
                $lastNumber = $lastDeliveryNote ? $lastDeliveryNote->dln_number : null;
                $model->dln_number = static::generateSequenceNumber($moduleMapping[$model->dln_operation], '', $lastNumber);
            }
        });

        // Mise à jour du stock virtuel après modification d'un BL
        static::saved(function ($model) {
            if ($model->wasChanged('dln_status')) {
                $stockService = app(StockService::class);

                // Récupérer toutes les lignes du BL
                foreach ($model->lines as $line) {
                    $stockService->updateVirtualStock($line->fk_prt_id, $model->fk_whs_id);
                }
            }
        });
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        // Ne pas utiliser car le numéro dépend de dln_operation
        return '';
    }

    /**
     * Relations
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function saleOrder(): BelongsTo
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }


    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_id', 'whs_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderModel::class, 'fk_por_id', 'por_id');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_dln_id', 'dln_id');
    }

    /**
     * Récupère les lignes associées à ce bon de livraison.
     */
    public function lines()
    {
        return $this->hasMany(DeliveryNoteLineModel::class, 'fk_dln_id', 'dln_id');
    }
    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_dln_id';
    }
}
