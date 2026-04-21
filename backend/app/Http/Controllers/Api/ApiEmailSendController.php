<?php

namespace App\Http\Controllers\Api;

use App\Models\CompanyModel;
use App\Models\MessageEmailAccountModel;
use App\Models\DocumentModel;
use App\Services\EmailService;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ApiEmailSendController extends Controller
{
    protected EmailService $emailService;

    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }

    /**
     * Envoyer un email avec pièces jointes optionnelles.
     * Accepte multipart/form-data.
     */
    public function send(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email_account_id' => 'required|exists:message_email_account_eml,eml_id',
            'to'               => 'required|string',
            'cc'               => 'nullable|string',
            'bcc'              => 'nullable|string',
            'subject'          => 'required|string|max:500',
            'body'             => 'required|string',
            'attachments'      => 'nullable|array|max:10',
            'attachments.*'    => 'file|max:10240',
            'document_ids'     => 'nullable|string',
        ], [
            'email_account_id.required' => 'Veuillez sélectionner un compte email expéditeur.',
            'email_account_id.exists'   => "Le compte email sélectionné n'existe pas.",
            'to.required'               => 'Au moins un destinataire est requis.',
            'subject.required'          => "L'objet de l'email est requis.",
            'body.required'             => "Le corps de l'email est requis.",
            'attachments.max'           => 'Maximum 10 pièces jointes autorisées.',
            'attachments.*.max'         => 'Chaque pièce jointe ne doit pas dépasser 10 Mo.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        $tempFiles = [];

        try {
            $emailAccount = MessageEmailAccountModel::findOrFail($request->email_account_id);

            // Parse et validation des destinataires
            $toEmails = $this->parseAndValidateEmails($request->to);
            if (empty($toEmails)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucune adresse email valide dans le champ "À".',
                ], 422);
            }

            $ccEmails = $request->cc ? $this->parseAndValidateEmails($request->cc) : [];
            $bccEmails = $request->bcc ? $this->parseAndValidateEmails($request->bcc) : [];

            // Construction du tableau de pièces jointes
            $attachments = [];

            // Fichiers uploadés (drag-and-drop ou input file)
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $tempPath = $file->store('temp/email-attachments', 'private');
                    $fullPath = Storage::disk('private')->path($tempPath);
                    $tempFiles[] = $tempPath;
                    $attachments[] = [
                        'path' => $fullPath,
                        'name' => $file->getClientOriginalName(),
                    ];
                }
            }

            // Documents existants du système (par doc_id)
            if ($request->document_ids) {
                $docIds = array_filter(explode(',', $request->document_ids));
                $documentService = new DocumentService();

                foreach ($docIds as $docId) {
                    $document = DocumentModel::find(intval($docId));
                    if ($document) {
                        $filePath = $documentService->getFilePath($document);
                        if (file_exists($filePath)) {
                            $attachments[] = [
                                'path' => $filePath,
                                'name' => $document->doc_filename,
                            ];
                        }
                    }
                }
            }

            // Envoi via EmailService
            $options = [
                'cc'          => $ccEmails,
                'bcc'         => $bccEmails,
                'is_html'     => true,
                'attachments' => $attachments,
            ];

            $result = $this->emailService->sendEmail(
                $emailAccount,
                $toEmails,
                $request->subject,
                $request->body,
                $options
            );

            // Nettoyage des fichiers temporaires
            $this->cleanupTempFiles($tempFiles);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Email envoyé avec succès',
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'],
                ], 500);
            }
        } catch (\Exception $e) {
            // Nettoyage en cas d'erreur
            $this->cleanupTempFiles($tempFiles);

            Log::error('Erreur envoi email via dialog', [
                'error' => $e->getMessage(),
                'user'  => Auth::id(),
            ]);

            return response()->json([
                'success' => false,
                'message' => "Erreur lors de l'envoi de l'email : " . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupérer le compte email par défaut selon le contexte.
     */
    public function getDefaultAccount(Request $request): JsonResponse
    {
        $context = $request->query('context', 'default');

        $company = CompanyModel::with(['emailSale', 'emailDefault'])->first();

        if (!$company) {
            return response()->json([
                'success' => false,
                'message' => "Configuration de l'entreprise introuvable",
            ], 404);
        }

        $account = null;
        if ($context === 'sale' && $company->emailSale) {
            $account = $company->emailSale;
        }
        if (!$account && $company->emailDefault) {
            $account = $company->emailDefault;
        }

        return response()->json([
            'success' => (bool) $account,
            'data'    => $account ? [
                'eml_id'      => $account->eml_id,
                'eml_label'   => $account->eml_label,
                'eml_address' => $account->eml_address,
            ] : null,
            'message' => $account ? null : 'Aucun compte email configuré',
        ]);
    }

    /**
     * Parse une chaîne d'emails séparés par virgule ou point-virgule et valide chaque adresse.
     */
    private function parseAndValidateEmails(string $raw): array
    {
        $emails = preg_split('/[,;]\s*/', trim($raw));
        return array_values(array_filter(
            array_map('trim', $emails),
            fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL)
        ));
    }

    /**
     * Nettoyer les fichiers temporaires.
     */
    private function cleanupTempFiles(array $tempFiles): void
    {
        foreach ($tempFiles as $tempPath) {
            try {
                Storage::disk('private')->delete($tempPath);
            } catch (\Exception $e) {
                Log::warning('Impossible de supprimer le fichier temporaire : ' . $tempPath);
            }
        }
    }
}
