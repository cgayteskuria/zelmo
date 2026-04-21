<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Services\SaleOrderService;
use App\Services\PurchaseOrderService;
use App\Models\AccountConfigModel;

class InvoiceLineModel extends BizDocumentLineModel
{
    use HasFactory;

    protected $table = 'invoice_line_inl';
    protected $primaryKey = 'inl_id';

    const CREATED_AT = 'inl_created';
    const UPDATED_AT = 'inl_updated';

    protected $guarded = ['inl_id'];

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Avant la création d'une ligne de facture, gérer les taux de TVA
        static::creating(function ($invoiceLine) {
          //  static::handleTaxRates($invoiceLine, true);
        });

        // Avant la modification d'une ligne de facture, gérer les taux de TVA
        static::updating(function ($invoiceLine) {
           // static::handleTaxRates($invoiceLine, false);
        });

        // Après la sauvegarde d'une ligne de facture, mettre à jour l'état de facturation de la commande
        static::saved(function ($invoiceLine) {
            static::updateOrderInvoicingState($invoiceLine);
        });

        // Après la suppression d'une ligne de facture, mettre à jour l'état de facturation de la commande
        static::deleted(function ($invoiceLine) {
            static::updateOrderInvoicingState($invoiceLine);
        });
    }

    /**
     * Met à jour l'état de facturation de la commande (client ou fournisseur) associée
     *
     * @param InvoiceLineModel $invoiceLine
     * @return void
     */
    protected static function updateOrderInvoicingState($invoiceLine): void
    {
        // Charger la facture parent pour récupérer l'ID de la commande
        $invoice = $invoiceLine->invoice;

        if (!$invoice) {
            return;
        }

        // Si la ligne est liée à une commande client via fk_orl_id
        if ($invoiceLine->fk_orl_id && $invoice->fk_ord_id) {
            $saleOrderService = new SaleOrderService();
            $saleOrderService->updateInvoicingState($invoice->fk_ord_id);
        }

        // Si la ligne est liée à une commande fournisseur via fk_pol_id
        if ($invoiceLine->fk_pol_id && $invoice->fk_por_id) {
            $purchaseOrderService = new PurchaseOrderService();
            $purchaseOrderService->updateInvoicingState($invoice->fk_por_id);
        }
    }


    protected $casts = [
        'inl_qty' => 'decimal:3',
        'inl_priceunitht' => 'decimal:3',
        'inl_purchasepriceunitht' => 'decimal:3',
        'inl_discount' => 'decimal:2',
        'inl_mtht' => 'decimal:3',
        'inl_tax_rate' => 'decimal:2',
        'inl_is_subscription' => 'boolean',
    ];

    /**
     * Les constantes LINE_TYPE_* sont héritées de BizDocumentLineModel
     */

    /**
     * Implémentation des méthodes abstraites de BizDocumentLineModel
     */

    /**
     * Retourne le mapping des champs de la ligne
     */
    protected function getFieldMapping(): array
    {
        return [
            'id' => 'inl_id',
            'parent_fk' => 'fk_inv_id',
            'product_id' => 'fk_prt_id',
            'tax_id' => 'fk_tax_id',
            'qty' => 'inl_qty',
            'price_unit_ht' => 'inl_priceunitht',
            'purchase_price_unit_ht' => 'inl_purchasepriceunitht',
            'discount' => 'inl_discount',
            'total_ht' => 'inl_mtht',
            'tax_rate' => 'inl_tax_rate',
            'line_type' => 'inl_type',
            'order' => 'inl_order',
            'is_subscription' => 'inl_is_subscription',
            'prt_lib' => 'inl_prtlib',
            'prt_desc' => 'inl_prtdesc',
            'prt_type' => 'inl_prttype',
            'note' => 'inl_note',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
        ];
    }


    /**
     * Détermine le type de document TRL en fonction de l'opération de la facture parente.
     *
     * inv_operation → trl_document_type :
     *   1 CUSTOMER_INVOICE  → out_invoice
     *   2 CUSTOMER_REFUND   → out_refund
     *   3 SUPPLIER_INVOICE  → in_invoice
     *   4 SUPPLIER_REFUND   → in_refund
     *   5 CUSTOMER_DEPOSIT  → out_invoice
     *   6 SUPPLIER_DEPOSIT  → in_invoice
     */
    protected function getTrlDocumentType(): string
    {
        $invoice = $this->invoice ?? InvoiceModel::find($this->fk_inv_id);

        if (!$invoice) {
            throw new \InvalidArgumentException(
                "InvoiceLine #{$this->inl_id} : impossible de déterminer le type TRL, facture parente introuvable."
            );
        }

        return match((int) $invoice->inv_operation) {
            InvoiceModel::OPERATION_CUSTOMER_INVOICE,
            InvoiceModel::OPERATION_CUSTOMER_DEPOSIT  => 'out_invoice',
            InvoiceModel::OPERATION_CUSTOMER_REFUND   => 'out_refund',
            InvoiceModel::OPERATION_SUPPLIER_INVOICE,
            InvoiceModel::OPERATION_SUPPLIER_DEPOSIT  => 'in_invoice',
            InvoiceModel::OPERATION_SUPPLIER_REFUND   => 'in_refund',
            default => throw new \InvalidArgumentException(
                "InvoiceLine : opération de facture inconnue ({$invoice->inv_operation})."
            ),
        };
    }

    public function tax(): BelongsTo
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id', 'tax_id');
    }


    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id', 'prt_id');
    }

    /**
     * Retourne le nom de la relation pour accéder au document parent
     */
    protected function getParentRelationship(): string
    {
        return 'invoice';
    }

    /**
     * Retourne le nom de la clé étrangère du document parent
     */
    protected function getParentForeignKey(): string
    {
        return 'fk_inv_id';
    }

    /**
     * Relations communes héritées de BizDocumentLineModel :
     * - product() : Produit
     * - tax() : Taxe (TVA)
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     */

    /**
     * Relation spécifique : le document parent (Invoice)
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    /**
     * Méthodes métier spécifiques à InvoiceLine
     * (Les méthodes calculateTotalHT(), updateSubTotal(), boot() sont héritées de BizDocumentLineModel)
     */
}
