<?php

namespace App\Http\Controllers\Api;

use App\Models\TimeConfigModel;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ApiTimeConfigController extends Controller
{
    /**
     * Afficher la configuration du module temps (ID=1 unique)
     */
    public function show($id = 1)
    {
        $config = TimeConfigModel::with([
            'product:prt_id,prt_label,prt_ref',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => $config,
        ], 200);
    }

    /**
     * Mettre à jour la configuration du module temps
     */
    public function update(Request $request, $id = 1)
    {
        try {
            $validatedData = $request->validate([
                'fk_prt_id' => 'nullable|integer|exists:product_prt,prt_id',
            ]);

            $config = TimeConfigModel::findOrFail($id);
            $config->update($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Configuration du module temps mise à jour avec succès',
                'data'    => $config->load('product:prt_id,prt_label,prt_ref'),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage(),
            ], 500);
        }
    }
}
