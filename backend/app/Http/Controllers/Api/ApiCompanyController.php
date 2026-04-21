<?php

namespace App\Http\Controllers\Api;

use App\Models\CompanyModel;
use App\Models\BankDetailsModel;
use App\Models\MessageEmailAccountModel;
use App\Models\MessageTemplateModel;
use App\Models\DocumentModel;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class ApiCompanyController extends Controller
{
    /**
     * Récupérer les informations de la company avec la banque par défaut
     * @return \Illuminate\Http\JsonResponse
     */
    public function getCompanyInfo()
    {
        // Récupérer la company (actuellement il n'y en a qu'une avec cop_id = 1)
        $company = CompanyModel::where('cop_id', 1)
            ->select(
                'cop_id',
                'cop_label',
                'cop_address',
                'cop_zip',
                'cop_city',
                'cop_phone',
                'cop_registration_code',
                'cop_legal_status',
                'cop_rcs',
                'cop_capital',
                'cop_naf_code',
                'cop_tva_code'
            )
            ->first();

        if (!$company) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        // Récupérer la banque par défaut de cette company
        $defaultBank = BankDetailsModel::where('fk_cop_id', $company->cop_id)
            ->where('bts_is_default', 1)
            ->where('bts_is_active', 1)
            ->select(
                'bts_id',
                'bts_label',
                'bts_bank_code',
                'bts_sort_code',
                'bts_account_nbr',
                'bts_bban_key',
                'bts_bic',
                'bts_iban',
                'bts_bnal_address'
            )
            ->first();

        return response()->json([
            'data' => [
                'company' => $company,
                'default_bank' => $defaultBank
            ]
        ]);
    }

    /**
     * Public branding info used on the login page (no auth required).
     */
    public function publicBranding()
    {
        $company = CompanyModel::where('cop_id', 1)
            ->with([
                'logoSquare:doc_id,doc_filepath,doc_filename',
                'logoLarge:doc_id,doc_filepath,doc_filename',
            ])
            ->first(['cop_id', 'cop_label', 'fk_doc_id_logo_square', 'fk_doc_id_logo_large']);

        $logoLarge = null;
        $logoSquare = null;

        if ($company?->fk_doc_id_logo_large) {
            $d = DocumentService::getOnBase64($company->fk_doc_id_logo_large);
            if ($d) $logoLarge = $d['base64'];
        }
        if ($company?->fk_doc_id_logo_square) {
            $d = DocumentService::getOnBase64($company->fk_doc_id_logo_square);
            if ($d) $logoSquare = $d['base64'];
        }

        return response()->json([
            'name'        => $company?->cop_label ?? 'Zelmo',
            'logo'        => $logoLarge ?? $logoSquare,
            'logo_square' => $logoSquare,
        ]);
    }

    /**
     * Display the specified company.
     */
    public function show($id)
    {
        $company = CompanyModel::where('cop_id', $id)
            ->with([
                'emailSale:eml_id,eml_label',
                'emailDefault:eml_id,eml_label',
                'resetPasswordTemplate:emt_id,emt_label',
                'changedPasswordTemplate:emt_id,emt_label',
                'logoLarge:doc_id,doc_filepath,doc_filename',
                'logoSquare:doc_id,doc_filepath,doc_filename',
                'logoPrintable:doc_id,doc_filepath,doc_filename'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $company
        ], 200);
    }

    /**
     * Update the specified company.
     */
    public function update(Request $request, $id)
    {
        $company = CompanyModel::findOrFail($id);

        $validatedData = $request->validate([
            'cop_label' => 'required|string|max:255',
            'cop_address' => 'nullable|string|max:255',
            'cop_zip' => 'nullable|string|max:10',
            'cop_city' => 'nullable|string|max:100',
            'cop_phone' => 'nullable|string|max:50',
            'cop_registration_code' => 'nullable|string|max:50',
            'cop_legal_status' => 'nullable|string|max:100',
            'cop_rcs' => 'nullable|string|max:100',
            'cop_capital' => 'nullable|string|max:100',
            'cop_naf_code' => 'nullable|string|max:50',
            'cop_tax_code' => 'nullable|string|max:50',
            'cop_mail_parser' => 'nullable|string|max:255',
            'fk_eml_id_sale' => 'nullable|exists:message_email_account_eml,eml_id',
            'fk_eml_id_default' => 'nullable|exists:message_email_account_eml,eml_id',
            'fk_emt_id_reset_password' => 'nullable|exists:message_template_emt,emt_id',
            'fk_emt_id_changed_password' => 'nullable|exists:message_template_emt,emt_id',
            'cop_veryfi_client_id' => 'nullable|string|max:255',
            'cop_veryfi_client_secret' => 'nullable|string|max:255',
            'cop_veryfi_username' => 'nullable|string|max:255',
            'cop_veryfi_api_key' => 'nullable|string|max:255',
            'cop_url_site' => 'nullable|string|max:255',
        ]);

        $company->update($validatedData);

        return response()->json([
            'message' => 'Société mise à jour avec succès',
            'data' => $company,
        ]);
    }

    /**
     * Upload a logo for the company
     */
    public function uploadLogo(Request $request, $id)
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg|max:10240',
            'logo_type' => 'required|in:large,square,printable'
        ]);

        $company = CompanyModel::findOrFail($id);
        $documentService = new DocumentService();

        try {
            DB::beginTransaction();

            $file = $request->file('logo');
            $logoType = $request->input('logo_type');
            $userId = $request->user()->usr_id;

            $fieldMapping = [
                'large' => 'fk_doc_id_logo_large',
                'square' => 'fk_doc_id_logo_square',
                'printable' => 'fk_doc_id_logo_printable'
            ];

            // Upload du nouveau logo via DocumentService
            $document = $documentService->uploadLogoFile($file, $logoType, $userId);

            // Supprimer l'ancien logo si existant via DocumentService
            $fieldName = $fieldMapping[$logoType];
            if ($company->$fieldName) {
                $oldDocument = DocumentModel::find($company->$fieldName);
                if ($oldDocument) {
                    $documentService->deleteDocument($oldDocument, $userId);
                }
            }

            // Mettre à jour la company avec le nouveau doc_id
            $company->$fieldName = $document->doc_id;
            $company->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Logo uploadé avec succès',
                'data' => $document
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de l\'upload: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get logo as base64 encoded string
     */
    public function getLogo(Request $request, $id, $logoType)
    {
        $company = CompanyModel::findOrFail($id);

        $fieldMapping = [
            'large' => 'fk_doc_id_logo_large',
            'square' => 'fk_doc_id_logo_square',
            'printable' => 'fk_doc_id_logo_printable'
        ];

        if (!isset($fieldMapping[$logoType])) {
            return response()->json([
                'success' => false,
                'message' => 'Type de logo invalide'
            ], 400);
        }

        $fieldName = $fieldMapping[$logoType];
        $docId = $company->$fieldName;

        if (!$docId) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun logo de ce type'
            ], 404);
        }

        $logoData = DocumentService::getOnBase64($docId);

        if (!$logoData) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de récupérer le logo'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $logoData
        ]);
    }

    /**
     * Generate SVG from square logo
     */
    public function generateSvgFromSquareLogo($id)
    {
        $company = CompanyModel::findOrFail($id);

        $docId = $company->fk_doc_id_logo_square;

        if (!$docId) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun logo carré défini'
            ], 404);
        }

        $logoData = DocumentService::getOnBase64($docId);

        if (!$logoData) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de récupérer le logo carré'
            ], 404);
        }

        try {
            // Create SVG with embedded base64 image
            $base64Data = $logoData['base64'];

            // Extract width/height - for simplicity we'll use a square 512x512
            $size = 512;

            $svg = <<<SVG
                <?xml version="1.0" encoding="UTF-8"?>
                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                    width="{$size}" height="{$size}" viewBox="0 0 {$size} {$size}">
                    <image xlink:href="{$base64Data}" width="{$size}" height="{$size}"/>
                </svg>
                SVG;

            // Save SVG file
            $svgFilename = 'app_icon_' . time() . '.svg';
            $svgPath = 'company/icons/' . $svgFilename;

            Storage::disk('public')->put($svgPath, $svg);

            // Create document record for SVG
            $svgDocument = DocumentModel::create([
                'doc_filename' => $svgFilename,
                'doc_securefilename' => $svgFilename,
                'doc_filepath' => 'company/icons',
                'doc_filetype' => 'image/svg+xml',
                'doc_filesize' => strlen($svg),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'SVG généré avec succès',
                'data' => [
                    'doc_id' => $svgDocument->doc_id,
                    'filename' => $svgFilename,
                    'path' => $svgPath,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération du SVG: ' . $e->getMessage()
            ], 500);
        }
    }
}
