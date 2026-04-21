<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStockModel extends Model
{
    /**
     * Nom de la table associée.
     */
    protected $table = 'product_stock_psk';

    /**
     * Clé primaire de la table.
     */
    protected $primaryKey = 'psk_id';

    /**
     * Personnalisation des colonnes de timestamps.
     */
    const CREATED_AT = 'psk_created';
    const UPDATED_AT = 'psk_updated';

    /**
     * Les attributs qui ne sont pas massivement assignables.
     * On inclut psk_total_value car c'est une colonne générée par MySQL.
     */
    protected $guarded = [
        'psk_id',
        'psk_total_value',
        'psk_created',
        'psk_updated'
    ];

    /**
     * Les attributs qui doivent être castés.
     */
    protected $casts = [
        'psk_qty_physical'        => 'decimal:4',
        'psk_qty_virtual'         => 'decimal:4',
        'psk_min_qty'             => 'decimal:4',
        'psk_max_qty'             => 'decimal:4',
        'psk_reorder_qty'         => 'decimal:4',
        'psk_last_purchase_price' => 'decimal:4',
        'psk_average_price'       => 'decimal:4',
        'psk_total_value'         => 'decimal:2',
        'psk_last_movement_date'  => 'datetime',
        'psk_last_inventory_date' => 'datetime',
    ];

    /**
     * Relation avec le produit.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id', 'prt_id');
    }

    /**
     * Relation avec l'entrepôt.
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_whs_id', 'whs_id');
    }

    /**
     * Utilisateur créateur.
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    /**
     * Dernier utilisateur ayant modifié.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Scope pour filtrer les produits en alerte de stock.
     */
    public function scopeInAlert($query)
    {
        return $query->whereColumn('psk_qty_physical', '<=', 'psk_min_qty');
    }
}
