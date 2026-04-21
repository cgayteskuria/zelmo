<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

trait HasGridFilters
{
    /**
     * Charge les grid settings sauvegardés pour une grille donnée.
     *
     * @param string $gridKey  Clé de la grille (ex: "customer-invoices")
     * @return array|null      Les settings ou null si aucun n'est trouvé
     */
    protected function loadGridSettings(string $gridKey): ?array
    {
        $user = Auth::user();
        if (!$user) return null;

        $allSettings = json_decode($user->usr_gridsettings ?? '{}', true);
        return $allSettings[$gridKey] ?? null;
    }

    /**
     * Sauvegarde les grid settings pour une grille donnée.
     *
     * @param string $gridKey   Clé de la grille
     * @param array  $settings  Les settings à sauvegarder
     */
    protected function saveGridSettings(string $gridKey, array $settings): void
    {
        $user = Auth::user();
        if (!$user) return;

        $allSettings = json_decode($user->usr_gridsettings ?? '{}', true);
        if (!is_array($allSettings)) $allSettings = [];

        $allSettings[$gridKey] = $settings;
        $user->usr_gridsettings = json_encode($allSettings);
        $user->save();
    }
    /**
     * Applique les filtres dynamiques de colonnes à une requête.
     *
     * Paramètres attendus dans la requête :
     *   filters[column]       = "texte"       -> WHERE column LIKE '%texte%'
     *   filters[column_gte]   = "2024-01-01"  -> WHERE column >= '2024-01-01'
     *   filters[column_lte]   = "2024-12-31"  -> WHERE column <= '2024-12-31'
     *
     * @param Builder $query           Le query builder Eloquent
     * @param Request $request         La requête HTTP
     * @param array   $filterColumnMap Map des clés de filtre autorisées vers les colonnes DB réelles
     * @return Builder
     */
    protected function applyGridFilters(Builder $query, Request $request, array $filterColumnMap): Builder
    {
        $filters = $request->input('filters', []);

        if (!is_array($filters) || empty($filters)) {
            return $query;
        }

        foreach ($filters as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            // Filtres de plage : clé se terminant par _gte ou _lte
            if (str_ends_with($key, '_gte')) {
                $baseKey = substr($key, 0, -4);
                $dbColumn = $filterColumnMap[$baseKey] ?? null;
                if ($dbColumn) {
                    $query->where($dbColumn, '>=', $value);
                }
            } elseif (str_ends_with($key, '_lte')) {
                $baseKey = substr($key, 0, -4);
                $dbColumn = $filterColumnMap[$baseKey] ?? null;
                if ($dbColumn) {
                    $query->where($dbColumn, '<=', $value);
                }
            } else {
                $dbColumn = $filterColumnMap[$key] ?? null;
                if ($dbColumn) {
                    if (is_array($value)) {
                        // Filtre multi-select : WHERE column IN (...)
                        $query->whereIn($dbColumn, $value);
                    } else {
                        // Filtre texte LIKE
                        $query->where($dbColumn, 'LIKE', '%' . $value . '%');
                    }
                }
            }
        }

        return $query;
    }

    /**
     * Applique le tri depuis les paramètres de la requête.
     *
     * @param Builder $query
     * @param Request $request
     * @param array   $sortColumnMap   Map des clés de tri autorisées vers les colonnes DB
     * @param string  $defaultSort     Colonne par défaut si aucune n'est spécifiée
     * @param string  $defaultOrder    Direction par défaut
     * @return Builder
     */
    protected function applyGridSort(Builder $query, Request $request, array $sortColumnMap, string $defaultSort = 'id', string $defaultOrder = 'DESC'): Builder
    {
        $sortBy = $request->input('sort_by', $defaultSort);
        $sortOrder = strtoupper($request->input('sort_order', $defaultOrder)) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumn = $sortColumnMap[$sortBy] ?? $sortColumnMap[$defaultSort] ?? array_values($sortColumnMap)[0];

        $query->orderBy($sortColumn, $sortOrder);

        return $query;
    }

    /**
     * Applique la pagination depuis les paramètres de la requête.
     *
     * @param Builder $query
     * @param Request $request
     * @param int     $defaultLimit
     * @return Builder
     */
    protected function applyGridPagination(Builder $query, Request $request, int $defaultLimit = 50): Builder
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', $defaultLimit);

        $limit = min($limit, 500);

        return $query->skip($offset)->take($limit);
    }
}
