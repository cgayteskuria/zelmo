<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Http\Controllers\Api\ApiDeliveryNoteController;

class PurchaseOrderLineModel extends BizDocumentLineModel
{
    use HasFactory;

    protected $table = 'purchase_order_line_pol';
    protected $primaryKey = 'pol_id';

    const CREATED_AT = 'pol_created';
    const UPDATED_AT = 'pol_updated';

    protected $guarded = ['pol_id'];

    protected $casts = [
        'pol_qty' => 'decimal:3',
        'pol_priceunitht' => 'decimal:3',
        'pol_discount' => 'decimal:2',
        'pol_mtht' => 'decimal:3',
        'pol_tax_rate' => 'decimal:2',
        'pol_is_subscription' => 'boolean',
    ];

    /**
     * Les constantes LINE_TYPE_* sont héritées de BaseDocumentLineModel
     */

    protected static function boot()
    {
        parent::boot();

        // Synchroniser les lignes du BL brouillon quand une ligne de commande est modifiée ou supprimée
        $syncDeliveryNote = function ($line) {
            $order = $line->pruchaseOrder;
            if ($order && (int) $order->ord_status >= PurchaseOrderModel::STATUS_IN_PROGRESS) {
                ApiDeliveryNoteController::autoGenerateFromPurchaseOrder($order);
            }
        };

        static::saved($syncDeliveryNote);
        static::deleted($syncDeliveryNote);
    }


    /**
     * Implémentation des méthodes abstraites de BizDocumentLineModel
     */

    /**
     * Retourne le mapping des champs de la ligne
     */
    protected function getFieldMapping(): array
    {
        return [
            'id' => 'pol_id',
            'parent_fk' => 'fk_por_id',
            'product_id' => 'fk_prt_id',
            'tax_id' => 'fk_tax_id',
            'qty' => 'pol_qty',
            'price_unit_ht' => 'pol_priceunitht',
            'discount' => 'pol_discount',
            'total_ht' => 'pol_mtht',
            'tax_rate' => 'pol_tax_rate',
            'line_type' => 'pol_type',
            'order' => 'pol_order',

            'is_subscription' => 'pol_is_subscription',
            'prt_lib' => 'pol_prtlib',
            'prt_desc' => 'pol_prtdesc',
            'prt_type' => 'pol_prttype',
            'note' => 'pol_note',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
        ];
    }

    /**
     * Commandes fournisseur : toujours une facture entrante (in_invoice).
     */
    protected function getTrlDocumentType(): string
    {
        return 'in_invoice';
    }

    /**
     * Retourne le nom de la relation pour accéder au document parent
     */
    protected function getParentRelationship(): string
    {
        return 'purchaseOrder';
    }

    /**
     * Retourne le nom de la clé étrangère du document parent
     */
    protected function getParentForeignKey(): string
    {
        return 'fk_por_id';
    }

    /**
     * Relations communes héritées de BizDocumentLineModel :
     * - product() : Produit
     * - tax() : Taxe (TVA)
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     */

    /**
     * Relation spécifique : le document parent (PurchaseOrder)
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderModel::class, 'fk_por_id', 'por_id');
    }

    /**
     * Méthodes métier spécifiques à PurchaseOrderLine
     * (Les méthodes calculateTotalHT(), updateSubTotal(), boot() sont héritées de BaseDocumentLineModel)
     */


    /**
     * Vérifie si la ligne est facturée
     */
    public function isInvoiced(): bool
    {
        return $this->invoiceLines()->exists();
    }

    /**
     * Vérifie si la ligne est livrée
     */
    public function isDelivered(): bool
    {
        return $this->deliveryNoteLines()->exists();
    }

    /**
     * Obtient la quantité facturée
     */
    public function getInvoicedQuantityAttribute(): float
    {
        return $this->invoiceLines()->sum('quantity');
    }

    /**
     * Obtient la quantité livrée
     */
    public function getDeliveredQuantityAttribute(): float
    {
        return $this->deliveryNoteLines()
            ->whereHas('deliveryNote', function ($query) {
                $query->where('operation', DeliveryNoteModel::OPERATION_SUPPLIER_DELIVERY)->where('status', DeliveryNoteModel::STATUS_VALIDATED);
            })
            ->sum('quantity');
    }

    /**
     * Obtient la quantité restant à facturer
     */
    public function getRemainingToInvoiceAttribute(): float
    {
        return $this->quantity - $this->invoiced_quantity;
    }

    /**
     * Obtient la quantité restant à livrer
     */
    public function getRemainingToDeliverAttribute(): float
    {
        return $this->quantity - $this->delivered_quantity;
    }
}
