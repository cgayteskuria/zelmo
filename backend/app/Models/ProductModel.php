<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class ProductModel extends BaseModel
{
    protected $table = 'product_prt';
    protected $primaryKey = 'prt_id';
    public $incrementing = true;
    protected $keyType = 'int';


    const CREATED_AT = 'prt_created';
    const UPDATED_AT = 'prt_updated';

    const TYPE_STOCKABLE = 'conso';
    const TYPE_SERVICE   = 'service';

    // Protéger la clé primaire
    protected $guarded = ['prt_id'];

    /**
     * Les attributs qui doivent être convertis (castés).
     */
    protected $casts = [
        'prt_priceunitht'           => 'decimal:2',
        'prt_pricehtcost'           => 'decimal:2',
        'prt_stock_alert_threshold' => 'decimal:2',
        'prt_subscription'          => 'boolean',
        'prt_is_active'             => 'boolean',
        'prt_is_purchasable'        => 'boolean',
        'prt_is_sellable'           => 'boolean',
        'prt_stockable'             => 'boolean', // Notre fameux champ !
    ];
    /**
     * Relations
     */
    public function taxSale()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id_sale', 'tax_id');
    }

    public function taxPurchase()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id_purchase', 'tax_id');
    }

    public function accountSale()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale', 'acc_id');
    }

    public function accountPurchase()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase', 'acc_id');
    }

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    // Accès aux lignes de stock détaillées par entrepôt
    public function stocks()
    {
        return $this->hasMany(ProductStockModel::class, 'fk_prt_id', 'prt_id');
    }

    // ... tes autres relations (taxSale, accountSale, etc.) ...

    /**
     * ATTRIBUTS VIRTUELS (ACCESSORS)
     * Permet de faire $product->total_physical_stock
     */

    // Somme du stock physique sur tous les entrepôts
    public function getTotalPhysicalStockAttribute()
    {
        return $this->stocks()->sum('psk_qty_physical');
    }

    // Somme du stock virtuel sur tous les entrepôts
    public function getTotalVirtualStockAttribute()
    {
        return $this->stocks()->sum('psk_qty_virtual');
    }
    /**
     * SCOPES (Facilitateurs de requêtes)
     */

    public function scopeActive($query)
    {
        return $query->where('prt_is_active', true);
    }

    public function scopeStockableOnly($query)
    {
        return $query->where('prt_stockable', true);
    }
}
