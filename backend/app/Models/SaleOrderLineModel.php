<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Http\Controllers\Api\ApiDeliveryNoteController;

class SaleOrderLineModel extends BizDocumentLineModel
{
    use HasFactory;

    protected $table = 'sale_order_line_orl';
    protected $primaryKey = 'orl_id';

    const CREATED_AT = 'orl_created';
    const UPDATED_AT = 'orl_updated';

    protected $guarded = ['orl_id'];

    protected $casts = [
        'orl_qty' => 'decimal:3',
        'orl_priceunitht' => 'decimal:3',
        'orl_purchasepriceunitht' => 'decimal:3',
        'orl_discount' => 'decimal:2',
        'orl_mtht' => 'decimal:3',
        'orl_tax_rate' => 'decimal:2',
        'orl_is_subscription' => 'boolean',
    ];

    /**
     * Les constantes LINE_TYPE_* sont héritées de BaseDocumentLineModel
     */

    protected static function boot()
    {
        parent::boot();

        // Synchroniser les lignes du BL brouillon quand une ligne de commande est modifiée ou supprimée
        $syncDeliveryNote = function ($line) {
            $order = $line->saleOrder;
            if ($order && (int) $order->ord_status >= SaleOrderModel::STATUS_IN_PROGRESS) {
                ApiDeliveryNoteController::autoGenerateFromSaleOrder($order);
            }
        };

        static::saved($syncDeliveryNote);
        static::deleted($syncDeliveryNote);
    }

    /**
     * Implémentation des méthodes abstraites de BaseDocumentLineModel
     */

    /**
     * Retourne le mapping des champs de la ligne
     */
    protected function getFieldMapping(): array
    {
        return [
            'id' => 'orl_id',
            'parent_fk' => 'fk_ord_id',
            'product_id' => 'fk_prt_id',
            'tax_id' => 'fk_tax_id',
            'qty' => 'orl_qty',
            'price_unit_ht' => 'orl_priceunitht',
            'purchase_price_unit_ht' => 'orl_purchasepriceunitht',
            'discount' => 'orl_discount',
            'total_ht' => 'orl_mtht',
            'tax_rate' => 'orl_tax_rate',
            'line_type' => 'orl_type',
            'order' => 'orl_order',
            'is_subscription' => 'orl_is_subscription',
            'prt_lib' => 'orl_prtlib',
            'prt_desc' => 'orl_prtdesc',
            'prt_type' => 'orl_prttype',
            'note' => 'orl_note',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
        ];
    }

    /**
     * Commandes client : toujours une facture sortante (out_invoice).
     */
    protected function getTrlDocumentType(): string
    {
        return 'out_invoice';
    }

    /**
     * Retourne le nom de la relation pour accéder au document parent
     */
    protected function getParentRelationship(): string
    {
        return 'saleOrder';
    }

    /**
     * Retourne le nom de la clé étrangère du document parent
     */
    protected function getParentForeignKey(): string
    {
        return 'fk_ord_id';
    }

    /**
     * Relations communes héritées de BaseDocumentLineModel :
     * - product() : Produit
     * - tax() : Taxe (TVA)
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     */

    /**
     * Relation spécifique : le document parent (SaleOrder)
     */
    public function saleOrder(): BelongsTo
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    /**
     * Méthodes métier spécifiques à SaleOrderLine
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
                $query->where('operation', DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY)->where('status', DeliveryNoteModel::STATUS_VALIDATED);
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
