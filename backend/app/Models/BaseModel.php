<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use App\Traits\HasAuthorUpdater;

abstract class BaseModel extends Model
{
    use HasAuthorUpdater;
    /**
     * Retourne dynamiquement les colonnes modifiables pour assignation de masse.
     * Exclut la clé primaire et les timestamps définis dans le modèle.
     */
    public static function getFillableColumns(): array
    {
        try {
            $model = new static; // Utilise le modèle enfant
            $columns = Schema::getColumnListing($model->getTable());

            return array_diff($columns, [
                $model->getKeyName(),     // clé primaire
                static::CREATED_AT,       // doit être défini dans le modèle
                static::UPDATED_AT,       // doit être défini dans le modèle
            ]);
        } catch (\Throwable $e) {
            logger()->error('getFillableColumns failed', [
                'model' => static::class,
                'error' => $e->getMessage(),
            ]);

            throw $e; // on laisse le contrôleur décider
        }
    }

    /**
     * Update “auto-safe” : ne met à jour que les colonnes existantes
     */
    public function updateSafe(array $data): bool
    {
        if (empty($data)) {
            throw new InvalidArgumentException('Aucune donnée fournie pour la mise à jour.');
        }

        $fillableColumns = static::getFillableColumns();
        $filteredData = array_intersect_key($data, array_flip($fillableColumns));

        if (empty($filteredData)) {
            throw new InvalidArgumentException('Aucune colonne valide à mettre à jour.');
        }

        try {
            return DB::transaction(function () use ($filteredData) {
                return $this->fill($filteredData)->save();
            });
        } catch (\Throwable $e) {
            /*logger()->error('updateSafe failed', [
                'model' => static::class,
                'data' => $filteredData,
                'error' => $e->getMessage(),
            ]);*/

            throw $e;
        }
    }
}
