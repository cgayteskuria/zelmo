<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;


abstract class Controller
{
    /**
     * Détermine le modèle automatiquement à partir du nom du contrôleur.
     */
    protected function getModelClass(): string
    {
        $controllerName = class_basename($this); // "ApiContactController"
        // Exemple : ContactController -> ContactModel
        // Retirer le préfixe "Api"
        if (str_starts_with($controllerName, 'Api')) {
            $controllerName = substr($controllerName, 3); // "ContactController"
        }
        $modelName = str_replace('Controller', 'Model', $controllerName); // "ContactModel"
        $modelClass = "App\\Models\\{$modelName}";

        if (!class_exists($modelClass)) {
            throw new \Exception("Le modèle $modelClass n'existe pas");
        }

        return $modelClass;
    }


    /**
     * Display the specified resource.
     * Retourne toutes les données d'un item spécifique
     */
    public function show($id)
    {
        $modelClass = $this->getModelClass();
        $model = $modelClass::find($id);



        if (!$model) {
            return response()->json([
                'success' => false,
                'message' => 'Modèle non défini'
            ], 500);
        }
        $data = $modelClass::find($id);
        // $data = $modelClass::withCount('documents')->find($id);

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $data
        ], 200);
    }

    /**
     * Ajout d'un item
     */
    public function store(Request $request)
    {
        try {
            /** @var Model $item */
            $modelClass = $this->getModelClass();
            $item = new $modelClass();

            $r = $item->updateSafe($request->all());

            $primaryKey = $item->getKeyName();

            return response()->json([
                'success' => true,
                'message' => 'Created successfully',
                'data' => [$primaryKey => $item->{$primaryKey}]
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Update d'un item
     */
    public function update(Request $request, $id)
    {
        /** @var Model $data */
        $data = $this->getModelClass()::find($id);

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $data->updateSafe($request->all());

        $primaryKey = $data->getKeyName();
        return response()->json([
            'success' => true,
            'message' => 'Updated successfully',
            'data' => [$primaryKey => $data->{$primaryKey}]
        ]);
    }



    /**
     * Delete d'un item
     */
    public function destroy($id)
    {
        $modelClass = $this->getModelClass();
        $item = $modelClass::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        try {
            $item->delete();
            return response()->json([
                'success' => true,
                'message' => 'Item deleted successfully'
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), '1451')) {
                $code = $e->errorInfo[1]; // Code SQL 
                $table = null;

                // Extraire la table du message si tu veux
                preg_match("/foreign key constraint fails\s+\(`[^`]+`\.`([^`]+)`/i", $e->getMessage(), $matches);

                $table = $matches[1] ?? null;

                return response()->json([
                    'success' => false,
                    'code' => $code,
                    'table' => $table,
                    'message' => $e->getMessage(),
                ], 400);
            }

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la suppression.'
            ], 500);
        }
    }
}
