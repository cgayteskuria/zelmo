<?php

namespace App\Http\Controllers\Api;

use App\Models\SaleConfigModel;
use App\Models\MessageTemplateModel;
use App\Models\DurationsModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
                'saleConfirmationTemplate:emt_id,emt_label',
                'sellerAlertTemplate:emt_id,emt_label',
                'emailAccount:eml_id,eml_label',
                'commitmentDuration:dur_id,dur_label',
                'renewDuration:dur_id,dur_label',
                'noticeDuration:dur_id,dur_label',
                'invoicingDuration:dur_id,dur_label',
                'paymentCondition:dur_id,dur_label',
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

        // Convertir les chaînes vides en null pour les champs FK optionnels
        $request->merge(collect([
            'fk_eml_id', 'fk_dur_id_commitment', 'fk_dur_id_renew',
            'fk_dur_id_notice', 'fk_dur_id_invoicing', 'fk_dur_id_payment_condition',
        ])->mapWithKeys(fn($field) => [$field => $request->input($field) ?: null])->all());

        $validatedData = $request->validate([
            'sco_qutote_default_validity' => 'required|integer',
            'sco_sale_legal_notice'        => 'nullable|string',
            'fk_eml_id'                    => 'nullable|exists:message_email_account_eml,eml_id',
            'fk_emt_id_sale'               => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_sale_validation'    => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_sale_confirmation'  => 'required|exists:message_template_emt,emt_id',
            'fk_emt_id_seller_alert'       => 'required|exists:message_template_emt,emt_id',
            'fk_dur_id_commitment'         => 'nullable|exists:duration_dur,dur_id',
            'fk_dur_id_renew'              => 'nullable|exists:duration_dur,dur_id',
            'fk_dur_id_notice'             => 'nullable|exists:duration_dur,dur_id',
            'fk_dur_id_invoicing'          => 'nullable|exists:duration_dur,dur_id',
            'fk_dur_id_payment_condition'  => 'nullable|exists:duration_dur,dur_id',
        ], [
            'sco_qutote_default_validity.required' => 'La durée de validité des devis est obligatoire.',
            'sco_qutote_default_validity.integer'  => 'La durée de validité doit être un nombre entier.',
            'fk_eml_id.exists'                     => 'Le compte email sélectionné est invalide ou n\'existe plus.',
            'fk_emt_id_sale.required'              => 'Le modèle email "Bon de commande standard" est obligatoire.',
            'fk_emt_id_sale.exists'                => 'Le modèle email "Bon de commande standard" est invalide ou n\'existe plus.',
            'fk_emt_id_sale_validation.required'   => 'Le modèle email "Demande de validation" est obligatoire.',
            'fk_emt_id_sale_validation.exists'     => 'Le modèle email "Demande de validation" est invalide ou n\'existe plus.',
            'fk_emt_id_sale_confirmation.required' => 'Le modèle email "Confirmation client" est obligatoire.',
            'fk_emt_id_sale_confirmation.exists'   => 'Le modèle email "Confirmation client" est invalide ou n\'existe plus.',
            'fk_emt_id_seller_alert.required'      => 'Le modèle email "Alerte commercial" est obligatoire.',
            'fk_emt_id_seller_alert.exists'        => 'Le modèle email "Alerte commercial" est invalide ou n\'existe plus.',
            'fk_dur_id_commitment.exists'          => 'La durée d\'engagement par défaut sélectionnée est invalide.',
            'fk_dur_id_renew.exists'               => 'La reconduction par défaut sélectionnée est invalide.',
            'fk_dur_id_notice.exists'              => 'Le préavis par défaut sélectionné est invalide.',
            'fk_dur_id_invoicing.exists'           => 'La périodicité de facturation par défaut sélectionnée est invalide.',
            'fk_dur_id_payment_condition.exists'   => 'La condition de règlement par défaut sélectionnée est invalide.',
        ]);

        // Ajouter l'utilisateur qui fait la modification
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $config->update($validatedData);

        return response()->json([
            'message' => 'Configuration des ventes mise à jour avec succès',
            'data' => $config->load([
                'saleTemplate',
                'saleValidationTemplate',
                'saleConfirmationTemplate',
                'sellerAlertTemplate',
                'emailAccount',
                'commitmentDuration',
                'renewDuration',
                'noticeDuration',
                'invoicingDuration',
                'paymentCondition',
            ]),
        ]);
    }

    /**
     * POST /sale-order-conf/{id}/upload-cgv
     * Upload du fichier PDF des CGV.
     */
    public function uploadCgv(Request $request, $id)
    {
        $config = SaleConfigModel::findOrFail($id);

        $request->validate([
            'cgv_file' => 'required|file|mimes:pdf|max:10240',
        ]);

        // Supprimer l'ancien fichier si existant
        if ($config->sco_cgv_path && Storage::disk('private')->exists($config->sco_cgv_path)) {
            Storage::disk('private')->delete($config->sco_cgv_path);
        }

        $path = $request->file('cgv_file')->storeAs(
            'saleconfig/cgv',
            'cgv_' . time() . '.pdf',
            'private'
        );

        $config->update([
            'sco_cgv_path'         => $path,
            'fk_usr_id_updater'    => $request->user()->usr_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'CGV uploadées avec succès.',
            'data'    => ['cgv_configured' => true],
        ]);
    }
}
