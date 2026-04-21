<?php

namespace App\Http\Controllers\Api;

use App\Models\SaleConfigModel;
use App\Models\MessageTemplateModel;
use App\Models\DurationsModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiSaleOrderConfigController extends Controller
{
    /**
     * Display the specified sale order config.
     */
    public function show($id)
    {
        $config = SaleConfigModel::where('sco_id', $id)
            ->with([
                'saleTemplate:emt_id,emt_label',
                'saleValidationTemplate:emt_id,emt_label',
                'tokenRenewTemplate:emt_id,emt_label',
                'saleConfirmationTemplate:emt_id,emt_label',
                'sellerAlertTemplate:emt_id,emt_label',
                'emailAccount:eml_id,eml_label',
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
     * Update the specified sale order config.
     */
    public function update(Request $request, $id)
    {
        $config = SaleConfigModel::findOrFail($id);

        $validatedData = $request->validate([
            'sco_qutote_default_validity' => 'required|int',
            'sco_sale_legal_notice' => 'nullable|string',
            'fk_eml_id' => 'nullable|exists:message_email_account_eml,eml_id',
            'fk_emt_id_sale' => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_sale_validation' => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_token_renew' => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_sale_confirmation' => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_seller_alert' => 'required|exists:message_template_emt,emt_id',
        ]);

        // Ajouter l'utilisateur qui fait la modification
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $config->update($validatedData);

        return response()->json([
            'message' => 'Configuration des ventes mise à jour avec succès',
            'data' => $config->load([
                'saleTemplate',
                'saleValidationTemplate',
                'tokenRenewTemplate',
                'saleConfirmationTemplate',
                'sellerAlertTemplate',
                'emailAccount'
            ]),
        ]);
    }
}
