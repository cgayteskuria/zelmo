<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WarehouseModel extends Model
{
    protected $table = 'warehouse_whs';
    protected $primaryKey = 'whs_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'whs_created';
    const UPDATED_AT = 'whs_updated';

    protected $guarded = ['whs_id'];

    /**
     * Boot du modèle - gestion de l'entrepôt par défaut unique
     */
    protected static function boot()
    {
        parent::boot();

        // Avant la sauvegarde, si cet entrepôt devient le défaut, retirer le défaut des autres
        static::saving(function ($warehouse) {
            if ($warehouse->whs_is_default) {
                static::where('whs_id', '!=', $warehouse->whs_id ?? 0)
                    ->where('whs_is_default', 1)
                    ->update(['whs_is_default' => 0]);
            }
        });
    }

    /**
     * Créateur et dernier modificateur
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Hiérarchie des entrepôts
     */
    public function parent()
    {
        return $this->belongsTo(WarehouseModel::class, 'fk_parent_whs_id', 'whs_id');
    }

    public function children()
    {
        return $this->hasMany(WarehouseModel::class, 'fk_parent_whs_id', 'whs_id');
    }

    /**
     * Scope pour les entrepôts actifs
     */
    public function scopeActive($query)
    {
        return $query->where('whs_is_active', 1);
    }

    /**
     * Scope pour l'entrepôt par défaut
     */
    public function scopeDefault($query)
    {
        return $query->where('whs_is_default', 1);
    }
}
