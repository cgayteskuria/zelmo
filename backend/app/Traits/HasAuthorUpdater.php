<?php

namespace App\Traits;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

/**
 * Trait pour remplir automatiquement les champs author et updater
 *
 * Supporte deux conventions de nommage :
 * - fk_usr_id_author / fk_usr_id_updater (tables existantes)
 * - fk_usr_id_author / fk_usr_id_updater (nouvelles tables)
 */
trait HasAuthorUpdater
{
    /**
     * Boot du trait - appelé automatiquement par Laravel
     */
    protected static function bootHasAuthorUpdater()
    {
        // À la création : remplir author et updater
        static::creating(function ($model) {
            $userId = Auth::id();
            if ($userId) {
                $authorCol = $model->getAuthorColumn();
                if ($authorCol && empty($model->{$authorCol})) {
                    $model->{$authorCol} = $userId;
                }

                $updaterCol = $model->getUpdaterColumn();
                if ($updaterCol) {
                    $model->{$updaterCol} = $userId;
                }
            }
        });

        // À la mise à jour : remplir updater seulement
        static::updating(function ($model) {
            $userId = Auth::id();
            $updaterCol = $model->getUpdaterColumn();
            if ($userId && $updaterCol) {
                $model->{$updaterCol} = $userId;
            }
        });
    }

    /**
     * Retourne le nom de la colonne author existante, ou null
     */
    protected function getAuthorColumn(): ?string
    {
        if ($this->hasColumn('fk_usr_id_author')) return 'fk_usr_id_author';
        if ($this->hasColumn('fk_usr_id_author')) return 'fk_usr_id_author';
        return null;
    }

    /**
     * Retourne le nom de la colonne updater existante, ou null
     */
    protected function getUpdaterColumn(): ?string
    {
        if ($this->hasColumn('fk_usr_id_updater')) return 'fk_usr_id_updater';
        if ($this->hasColumn('fk_usr_id_updater')) return 'fk_usr_id_updater';
        return null;
    }

    /**
     * Vérifie si la colonne existe dans la table
     */
    protected function hasColumn(string $column): bool
    {
        return Schema::hasColumn($this->getTable(), $column);
    }
}
