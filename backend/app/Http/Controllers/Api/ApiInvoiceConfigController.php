<?php

namespace App\Http\Controllers\Api;

use App\Models\InvoiceConfigModel;
use App\Models\MessageTemplateModel;
use App\Models\DurationsModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiInvoiceConfigController extends Controller
{
    /**
     * Display the specified sale order config.
     */
    public function show($id)
    {
        $config = InvoiceConfigModel::where('ico_id', $id)
            ->with([
                'invoiceTemplate:emt_id,emt_label',
                'emailAccount:eml_id,eml_label',
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
        $config = InvoiceConfigModel::findOrFail($id);

        $validatedData = $request->validate([
            'fk_emt_id_invoice' => 'required|exists:message_template_emt,emt_id',
            'fk_eml_id' => 'nullable|exists:message_email_account_eml,eml_id',
        ]);

        // Ajouter l'utilisateur qui fait la modification
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $config->update($validatedData);

        return response()->json([
            'message' => 'Configuration des factures mise à jour avec succès',
            'data' => $config->load([
                'invoiceTemplate',
                'emailAccount',
            ]),
        ]);
    }
}
