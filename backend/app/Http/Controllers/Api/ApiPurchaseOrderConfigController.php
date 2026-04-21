<?php

namespace App\Http\Controllers\Api;

use App\Models\PurchaseOrderConfigModel;
use App\Models\MessageTemplateModel;
use App\Models\ProductModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiPurchaseOrderConfigController extends Controller
{
    /**
     * Display the specified purchase order config.
     */
    public function show($id)
    {
        $config = PurchaseOrderConfigModel::where('pco_id', $id)
            ->with([
                'messageTemplate:emt_id,emt_label',
                'defaultProduct:prt_id,prt_label',
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $config
        ], 200);
    }

    /**
     * Update the specified purchase order config.
     */
    public function update(Request $request, $id)
    {
        $config = PurchaseOrderConfigModel::findOrFail($id);

        $validatedData = $request->validate([
            'fk_emt_id' => 'required|exists:message_template_emt,emt_id',
            'fk_prt_id_default' => 'nullable|exists:product_prt,prt_id',
        ]);

        // Ajouter l'utilisateur qui fait la modification
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $config->update($validatedData);

        return response()->json([
            'message' => 'Configuration des achats mise à jour avec succès',
            'data' => $config->load(['messageTemplate', 'defaultProduct']),
        ]);
    }
}
