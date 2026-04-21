<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractLineModel extends BizDocumentLineModel
{
    protected $table = 'contract_line_col';
    protected $primaryKey = 'col_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'col_created';
    const UPDATED_AT = 'col_updated';

    // Protection de la clé primaire
    protected $guarded = ['col_id'];

    /**
     * Types / catégories
     */
    public const TYPE_PRODUCT = 0;
    public const TYPE_SERVICE = 1;

    public const CATEGORY_MAIN = 0;
    public const CATEGORY_OPTION = 1;

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Forcer col_is_subscription à 1 pour toutes les lignes de contrat
        static::saving(function ($model) {
            $model->col_is_subscription = 1;
        });

        // Après la sauvegarde d'une ligne de contrat, mettre à jour l'état de facturation de la commande
        static::saved(function ($contractLine) {
            static::updateOrderInvoicingState($contractLine);
        });

        // Après la suppression d'une ligne de contrat, mettre à jour l'état de facturation de la commande
        static::deleted(function ($contractLine) {
            static::updateOrderInvoicingState($contractLine);
        });
    }

    /**
     * Met à jour l'état de facturation de la commande associée
     * (considère les contrats comme une forme de facturation)
     *
     * @param ContractLineModel $contractLine
     * @return void
     */
    protected static function updateOrderInvoicingState($contractLine): void
    {
        // Charger le contrat parent pour récupérer l'ID de la commande
        $contract = $contractLine->contract;

        if (!$contract || !$contract->fk_ord_id) {
            return;
        }

        // Mettre à jour l'état de facturation de la commande client
        $saleOrderService = new \App\Services\SaleOrderService();
        $saleOrderService->updateInvoicingState($contract->fk_ord_id);
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
            'id' => 'col_id',
            'parent_fk' => 'fk_con_id',
            'product_id' => 'fk_prt_id',
            'tax_id' => 'fk_tax_id',
            'qty' => 'col_qty',
            'price_unit_ht' => 'col_priceunitht',
            'purchase_price_unit_ht' => 'col_purchasepriceunitht',
            'discount' => 'col_discount',
            'total_ht' => 'col_mtht',
            'tax_rate' => 'col_tax_rate',
            'line_type' => 'col_type',
            'order' => 'col_order',
            'is_subscription' => 'col_is_subscription',
            'prt_lib' => 'col_prtlib',
            'prt_desc' => 'col_prtdesc',
            'prt_type' => 'col_prttype',
            'note' => 'col_note',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',            
        ];
    }

    /**
     * Contrats client : toujours une facture sortante (out_invoice).
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
        return 'contract';
    }

    /**
     * Retourne le nom de la clé étrangère du document parent
     */
    protected function getParentForeignKey(): string
    {
        return 'fk_con_id';
    }

    /**
     * Relations héritées de BizDocumentLineModel :
     * - product() : Produit
     * - tax() : Taxe (TVA)
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     */

    /**
     * Relation avec le contrat parent
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(ContractModel::class, 'fk_con_id', 'con_id');
    }
}
