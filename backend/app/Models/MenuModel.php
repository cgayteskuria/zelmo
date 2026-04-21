<?php

namespace App\Models;


class MenuModel extends BaseModel
{
    protected $table = 'menu_mnu';
    protected $primaryKey = 'mnu_id';
    public $incrementing = true;
    protected $keyType = 'int';
    public $timestamps = true;

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    /**
     * Champs autorisés pour l'assignation de masse
     */
    protected $fillable = [
        'mnu_lib',
        'mnu_parent',
        'mnu_order',
        'mnu_href',
        'mnu_mif',
        'mnu_name',
        'mnu_type',
        'mnu_display_mode',
        'fk_permission_name',
        'fk_app_id',
        'fk_usr_id_author',
        'fk_usr_id_updater',
    ];

    /**
     * Relation : Récupère les éléments enfants du menu
     */
    public function children()
    {
        return $this->hasMany(MenuModel::class, 'mnu_parent', 'mnu_id')
            ->orderBy('mnu_order', 'asc');
    }

    /**
     * Relation : Récupère le parent du menu
     */
    public function parent()
    {
        return $this->belongsTo(MenuModel::class, 'mnu_parent', 'mnu_id');
    }
}
