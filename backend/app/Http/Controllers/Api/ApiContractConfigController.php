<?php

namespace App\Http\Controllers\Api;

use App\Models\ContractConfigModel;
use App\Models\MessageTemplateModel;
use App\Models\DurationsModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiContractConfigController extends Controller
{
    /**
     * Display the specified sale order config.
     */
    public function show($id)
    {
        $config = ContractConfigModel::where('cco_id', $id)
            ->with([                
                'contractTemplate:emt_id,emt_label',             
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $config
        ], 200);
    }

    /**
     * Update the specified sale order config.
     */
    public function update(Request $request, $id)
    {
        $config = ContractConfigModel::findOrFail($id);

        $validatedData = $request->validate([           
            'fk_emt_id' => 'required|exists:message_template_emt,emt_id',           
        ]);

        // Ajouter l'utilisateur qui fait la modification
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $config->update($validatedData);

        return response()->json([
            'message' => 'Configuration des ventes mise à jour avec succès',
            'data' => $config->load([               
                'contractTemplate',               
            ]),
        ]);
    }
}
