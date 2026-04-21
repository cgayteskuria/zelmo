<?php

namespace App\Http\Controllers\Api;

use App\Models\ExpenseConfigModel;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ApiExpenseConfigController extends Controller
{
    /**
     * Afficher la configuration du module notes de frais (il n'y en a qu'une seule, ID=1)
     */
    public function show($id = 1)
    {
        $config = ExpenseConfigModel::with([
            'author:usr_id,usr_firstname,usr_lastname',
            'updater:usr_id,usr_firstname,usr_lastname',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $config,
        ], 200);
    }

    /**
     * Mettre à jour la configuration du module notes de frais
     */
    public function update(Request $request, $id = 1)
    {
        try {
            $validatedData = $request->validate([
                'eco_ocr_enable' => 'nullable|boolean',
            ]);

            $config = ExpenseConfigModel::findOrFail($id);

            $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
            $validatedData['eco_ocr_enable'] = $request->input('eco_ocr_enable', false);

            $config->update($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Configuration du module notes de frais mise à jour avec succès',
                'data' => $config->load(['author', 'updater']),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }
}
