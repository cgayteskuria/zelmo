<?php

namespace App\Services;

use App\Models\SaleOrderModel;
use App\Models\ContractModel;
use App\Models\CompanyModel;
use App\Models\SaleConfigModel;
use App\Models\ContractConfigModel;
use App\Services\Pdf\DocumentPdfService;
use App\Services\DocumentService;
use App\Services\EmailService;
use App\Services\TemplateParserService;
use App\Services\ContractCreationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SignatureService
{
    private const TOKEN_EXPIRY_DAYS = 30;
    private const CGV_VERSION = 'v2026-01';

    public function __construct(
        private DocumentPdfService $pdfService,
        private DocumentService $documentService,
        private EmailService $emailService,
        private TemplateParserService $templateParser,
        private ContractCreationService $contractCreation,
    ) {}

    /**
     * Génère une demande de signature pour un devis ou un contrat.
     * Gèle le PDF, génère un token sécurisé, persiste tout en base.
     *
     * @param string $docType  'sale_order' | 'contract'
     * @param int    $docId
     * @param string $signerEmail
     * @param int    $userId
     * @return array  ['token', 'sign_url', 'expires_at']
     */
    public function generateSignatureRequest(string $docType, int $docId, string $signerEmail, int $userId): array
    {
        [$document, $isOrder] = $this->loadDocument($docType, $docId);

        // Valider le statut
        if ($isOrder && $document->ord_status !== SaleOrderModel::STATUS_WAITING_VALIDATION) {
            throw new \InvalidArgumentException('L\'offre commerciale doit être au statut "En attente de validation" pour être envoyée à la signature.');
        }
        if (!$isOrder && $document->con_status !== ContractModel::STATUS_DRAFT) {
            throw new \InvalidArgumentException('Le contrat doit être au statut "Brouillon" pour être envoyé à la signature.');
        }

        // Valider la configuration requise avant d'envoyer
        if ($isOrder) {
            $this->validateSaleSignatureConfig();
        }

        // Générer le PDF brut (gelé à cet instant)
        $pdfBinary = $isOrder
            ? $this->pdfService->generateSaleOrderPdfRaw($docId)
            : $this->pdfService->generateContractPdfRaw($docId);

        $pdfHash = hash('sha256', $pdfBinary);

        // Stocker le PDF gelé sur le disque privé (sans créer de DocumentModel)
        $module   = $isOrder ? 'saleorder' : 'contract';
        $frozenPath = "{$module}/{$docId}/signature/frozen_" . time() . '.pdf';
        Storage::disk('private')->put($frozenPath, $pdfBinary);

        // Token aléatoire 256 bits
        $token   = bin2hex(random_bytes(32));
        $expires = Carbon::now()->addDays(self::TOKEN_EXPIRY_DAYS);

        $auditEntry = [
            'type'         => 'token_generated',
            'at'           => Carbon::now()->toIso8601String(),
            'by_user_id'   => $userId,
            'signer_email' => $signerEmail,
            'pdf_hash'     => $pdfHash,
        ];

        if ($isOrder) {
            $document->update([
                'ord_validation_token'     => $token,
                'ord_sign_token_expires_at' => $expires,
                'ord_sign_token_used_at'   => null,
                'ord_sign_pdf_hash'        => $pdfHash,
                'ord_sign_pdf_path'        => $frozenPath,
                'ord_sign_signer_email'    => $signerEmail,
                'ord_sign_audit'           => json_encode(['events' => [$auditEntry]]),
            ]);
        } else {
            $document->update([
                'con_sign_token'           => $token,
                'con_sign_token_expires_at' => $expires,
                'con_sign_token_used_at'   => null,
                'con_sign_pdf_hash'        => $pdfHash,
                'con_sign_pdf_path'        => $frozenPath,
                'con_sign_signer_email'    => $signerEmail,
                'con_sign_audit'           => json_encode(['events' => [$auditEntry]]),
            ]);
        }

        $signUrl = config('app.frontend_url') . '/sign/' . $token;

        // Envoyer l'email de demande de signature
        $this->sendSignatureRequestEmail($signerEmail, $docId, $isOrder, $signUrl, $expires);

        return [
            'token'      => $token,
            'sign_url'   => $signUrl,
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    /**
     * Génère le token de signature et gèle le PDF sans envoyer l'email.
     * Utilisé quand l'utilisateur souhaite composer l'email lui-même.
     *
     * @return array ['sign_url', 'sign_expires_at', 'sign_expires_str']
     */
    public function prepareSignatureToken(string $docType, int $docId, int $userId): array
    {
        [$document, $isOrder] = $this->loadDocument($docType, $docId);

        if ($isOrder && $document->ord_status !== SaleOrderModel::STATUS_WAITING_VALIDATION) {
            throw new \InvalidArgumentException('L\'offre commerciale doit être au statut "En attente de validation" pour être envoyée à la signature.');
        }
        if (!$isOrder && $document->con_status !== ContractModel::STATUS_DRAFT) {
            throw new \InvalidArgumentException('Le contrat doit être au statut "Brouillon" pour être envoyé à la signature.');
        }

        $pdfBinary = $isOrder
            ? $this->pdfService->generateSaleOrderPdfRaw($docId)
            : $this->pdfService->generateContractPdfRaw($docId);

        $pdfHash = hash('sha256', $pdfBinary);

        $module     = $isOrder ? 'saleorder' : 'contract';
        $frozenPath = "{$module}/{$docId}/signature/frozen_" . time() . '.pdf';
        Storage::disk('private')->put($frozenPath, $pdfBinary);

        $token   = bin2hex(random_bytes(32));
        $expires = Carbon::now()->addDays(self::TOKEN_EXPIRY_DAYS);

        $auditEntry = [
            'type'       => 'token_generated',
            'at'         => Carbon::now()->toIso8601String(),
            'by_user_id' => $userId,
            'pdf_hash'   => $pdfHash,
        ];

        if ($isOrder) {
            $document->update([
                'ord_validation_token'      => $token,
                'ord_sign_token_expires_at' => $expires,
                'ord_sign_token_used_at'    => null,
                'ord_sign_pdf_hash'         => $pdfHash,
                'ord_sign_pdf_path'         => $frozenPath,
                'ord_sign_audit'            => json_encode(['events' => [$auditEntry]]),
            ]);
        } else {
            $document->update([
                'con_sign_token'            => $token,
                'con_sign_token_expires_at' => $expires,
                'con_sign_token_used_at'    => null,
                'con_sign_pdf_hash'         => $pdfHash,
                'con_sign_pdf_path'         => $frozenPath,
                'con_sign_audit'            => json_encode(['events' => [$auditEntry]]),
            ]);
        }

        $signUrl    = config('app.frontend_url') . '/sign/' . $token;
        $expiresStr = $expires->locale('fr')->isoFormat('D MMMM YYYY');

        return [
            'sign_url'        => $signUrl,
            'sign_expires_at' => $expires->toIso8601String(),
            'sign_expires_str'=> $expiresStr,
        ];
    }

    /**
     * Stocke l'email du signataire sur le document après envoi via le dialog email.
     */
    public function storeSignerEmail(string $docType, int $docId, string $signerEmail): void
    {
        [$document, $isOrder] = $this->loadDocument($docType, $docId);

        if ($isOrder) {
            $document->update(['ord_sign_signer_email' => $signerEmail]);
        } else {
            $document->update(['con_sign_signer_email' => $signerEmail]);
        }
    }

    private function validateSaleSignatureConfig(): void
    {
        $config = SaleConfigModel::first();

        if (!$config) {
            throw new \RuntimeException('La configuration des ventes est introuvable.');
        }

        if (!$config->fk_eml_id) {
            throw new \RuntimeException("Aucun compte email n'est configuré pour l'envoi des signatures. Veuillez le configurer dans Configuration > Ventes.");
        }

        if (!$config->fk_emt_id_sale_validation) {
            throw new \RuntimeException("Le modèle email de demande de signature n'est pas configuré. Veuillez le configurer dans Configuration > Ventes.");
        }

        if (!$config->fk_emt_id_sale_confirmation) {
            throw new \RuntimeException("Le modèle email de confirmation de signature n'est pas configuré. Veuillez le configurer dans Configuration > Ventes.");
        }

        if (!$config->sco_cgv_path || !Storage::disk('private')->exists($config->sco_cgv_path)) {
            throw new \RuntimeException("Les Conditions Générales de Vente (CGV) ne sont pas configurées. Veuillez les uploader dans Configuration > Ventes.");
        }
    }

    private function sendSignatureRequestEmail(string $to, int $docId, bool $isOrder, string $signUrl, Carbon $expires): void
    {
        $expiresStr = $expires->locale('fr')->isoFormat('D MMMM YYYY');

        if ($isOrder) {
            $saleConfig = SaleConfigModel::with(['emailAccount'])->first();
            $account    = $saleConfig?->emailAccount;

            if (!$account) {
                throw new \RuntimeException("Aucun compte email n'est configuré pour l'envoi des demandes de signature (devis). Veuillez configurer le compte email dans Configuration > Ventes.");
            }

            $emtId = $saleConfig?->fk_emt_id_sale_validation;
        } else {
            $contractConfig = ContractConfigModel::with(['emailAccount'])->first();
            $account        = $contractConfig?->emailAccount;

            if (!$account) {
                throw new \RuntimeException("Aucun compte email n'est configuré pour l'envoi des demandes de signature (contrats). Veuillez configurer le compte email dans Configuration > Contrats.");
            }

            $emtId = $contractConfig?->fk_emt_id_sign_request;
        }

        if ($emtId) {
            $context = $isOrder ? 'sale' : 'sale'; // TemplateParserService gère uniquement 'sale' pour l'instant
            $data    = TemplateParserService::buildData($context, $docId);
            $data['signature_url']   = $signUrl;
            $data['sign_expires_at'] = $expiresStr;

            $parsed  = $this->templateParser->parseTemplate($emtId, $data);
            $subject = $parsed['subject'];
            $body    = $parsed['body'];
        } else {
            $company     = CompanyModel::first();
            $companyName = $company?->cop_label ?? '';
            $docType     = $isOrder ? 'offre commerciale' : 'contrat';
            $subject     = "[{$companyName}] Document à signer";
            $body        = "<p>Bonjour,</p>"
                . "<p>Vous avez une {$docType} à signer.</p>"
                . "<p><a href='{$signUrl}'>Signer le document</a></p>"
                . "<p>Lien valable jusqu'au {$expiresStr}.</p>";
        }

        // Joindre les CGV en PDF pour renforcer la valeur probante de la signature
        $options = [];
        if ($isOrder) {
            $saleConfig = SaleConfigModel::first();
            if ($saleConfig?->sco_cgv_path && Storage::disk('private')->exists($saleConfig->sco_cgv_path)) {
                $options['attachments'] = [[
                    'path' => Storage::disk('private')->path($saleConfig->sco_cgv_path),
                    'name' => 'Conditions_Generales_de_Vente.pdf',
                ]];
            }
        }

        $result = $this->emailService->sendEmail($account, $to, $subject, $body, $options);

        if (isset($result['success']) && $result['success'] === false) {
            throw new \RuntimeException($result['message'] ?? "Échec de l'envoi de l'email de demande de signature.");
        }
    }

    /**
     * Résout un token de signature et retourne les données nécessaires à la page de signature.
     *
     * @throws \Exception avec code 404 / 410
     */
    public function resolveToken(string $token): array
    {
        // Chercher dans SaleOrder puis Contract
        $document = SaleOrderModel::where('ord_validation_token', $token)->first();
        $isOrder  = true;

        if (!$document) {
            $document = ContractModel::where('con_sign_token', $token)->first();
            $isOrder  = false;
        }

        if (!$document) {
            throw new \Exception('Token de signature introuvable.', 404);
        }

        $usedAt   = $isOrder ? $document->ord_sign_token_used_at   : $document->con_sign_token_used_at;
        $expiresAt = $isOrder ? $document->ord_sign_token_expires_at : $document->con_sign_token_expires_at;

        if ($usedAt) {
            throw new \Exception('Ce document a déjà été signé.', 410);
        }
        if (!$expiresAt || Carbon::parse($expiresAt)->isPast()) {
            throw new \Exception('Le lien de signature a expiré.', 410);
        }

        $frozenPath = $isOrder ? $document->ord_sign_pdf_path : $document->con_sign_pdf_path;
        if (!$frozenPath || !Storage::disk('private')->exists($frozenPath)) {
            throw new \Exception('Le fichier PDF de référence est introuvable.', 500);
        }

        $pdfBinary = Storage::disk('private')->get($frozenPath);
        $partner   = $document->partner;

        // URL CGV publique (null si non configurée)
        $cgvUrl = null;
        if ($isOrder) {
            $saleConfig = SaleConfigModel::first();
            if ($saleConfig?->sco_cgv_path && Storage::disk('private')->exists($saleConfig->sco_cgv_path)) {
                $cgvUrl = config('app.api_url') . '/api/public/cgv';
            }
        }

        // Logo de la société
        $company   = \App\Models\CompanyModel::first();
        $logoBase64 = null;
        $companyName = $company?->cop_label ?? '';
        if ($company?->fk_doc_id_logo_large) {
            $logoData   = DocumentService::getOnBase64($company->fk_doc_id_logo_large);
            $logoBase64 = $logoData['base64'] ?? null;
        }

        return [
            'doc_type'      => $isOrder ? 'sale_order' : 'contract',
            'doc_number'    => $isOrder ? $document->ord_number : $document->con_number,
            'partner_name'  => $partner ? $partner->ptr_name : '',
            'total_ht'      => $isOrder ? (float) $document->ord_totalht  : (float) $document->con_totalht,
            'total_ttc'     => $isOrder ? (float) $document->ord_totalttc : (float) $document->con_totalttc,
            'signer_email'  => $isOrder ? $document->ord_sign_signer_email : $document->con_sign_signer_email,
            'expires_at'    => $expiresAt,
            'cgv_version'   => self::CGV_VERSION,
            'cgv_url'       => $cgvUrl,
            'pdf_base64'    => base64_encode($pdfBinary),
            'company_name'  => $companyName,
            'company_logo'  => $logoBase64,
        ];
    }

    /**
     * Traite la signature soumise par le client.
     * Valide l'intégrité, met à jour le document, envoie le PDF signé.
     *
     * @param array $data { signature_image, cgv_accepted, cgv_version, ip, user_agent }
     */
    public function processSignature(string $token, array $data): void
    {
        // Phase 1 : transaction DB uniquement (pas d'envoi d'email ici)
        $ctx = DB::transaction(function () use ($token, $data) {
            // Résolution et verrouillage du document
            $document = SaleOrderModel::where('ord_validation_token', $token)->lockForUpdate()->first();
            $isOrder  = true;

            if (!$document) {
                $document = ContractModel::where('con_sign_token', $token)->lockForUpdate()->first();
                $isOrder  = false;
            }

            if (!$document) {
                throw new \Exception('Token introuvable.', 404);
            }

            $usedAt    = $isOrder ? $document->ord_sign_token_used_at   : $document->con_sign_token_used_at;
            $expiresAt = $isOrder ? $document->ord_sign_token_expires_at : $document->con_sign_token_expires_at;
            $storedHash = $isOrder ? $document->ord_sign_pdf_hash : $document->con_sign_pdf_hash;
            $frozenPath = $isOrder ? $document->ord_sign_pdf_path : $document->con_sign_pdf_path;

            if ($usedAt) {
                throw new \Exception('Document déjà signé.', 410);
            }
            if (!$expiresAt || Carbon::parse($expiresAt)->isPast()) {
                throw new \Exception('Lien de signature expiré.', 410);
            }
            if (!$data['cgv_accepted']) {
                throw new \InvalidArgumentException('Les conditions générales doivent être acceptées.');
            }

            // Vérifier l'intégrité du PDF gelé
            if ($frozenPath && Storage::disk('private')->exists($frozenPath)) {
                $currentHash = hash('sha256', Storage::disk('private')->get($frozenPath));
                if ($currentHash !== $storedHash) {
                    throw new \Exception('Erreur d\'intégrité : le document a été modifié depuis l\'envoi du lien.', 409);
                }
            }

            $signerEmail     = $isOrder ? $document->ord_sign_signer_email : $document->con_sign_signer_email;
            $partner         = $document->partner;
            $signerFirstName = trim($data['signer_firstname'] ?? '');
            $signerLastName  = trim($data['signer_lastname'] ?? '');
            $signerName      = trim("{$signerFirstName} {$signerLastName}") ?: ($partner ? $partner->ptr_name : $signerEmail);
            $serverTime      = Carbon::now()->toIso8601String();

            // Données de validation pour addSignature() dans le PDF
            $validationData = json_encode([
                'serverTime'      => $serverTime,
                'name'            => $signerName,
                'ip'              => $data['ip'],
                'user_agent'      => $data['user_agent'],
                'cgv_version'     => $data['cgv_version'],
                'cgv_accepted_at' => $serverTime,
                'pdf_hash'        => $storedHash,
                'signer_email'    => $signerEmail,
                'signature_image' => $data['signature_image'],
            ]);

            // Construire le nouvel événement d'audit
            $existingAudit = $isOrder ? $document->ord_sign_audit : $document->con_sign_audit;
            $audit = $existingAudit ? json_decode($existingAudit, true) : ['events' => []];
            $audit['events'][] = [
                'type'         => 'signed',
                'at'           => $serverTime,
                'ip'           => $data['ip'],
                'user_agent'   => $data['user_agent'],
                'cgv_version'  => $data['cgv_version'],
                'signer_email' => $signerEmail,
                'pdf_hash'     => $storedHash,
            ];

            // Persister sur le document
            $docId = $isOrder ? $document->ord_id : $document->con_id;

            if ($isOrder) {
                $document->update([
                    'ord_validation_data'      => $validationData,
                    'ord_sign_token_used_at'   => Carbon::now(),
                    'ord_sign_signature_image' => $data['signature_image'],
                    'ord_sign_cgv_version'     => $data['cgv_version'],
                    'ord_sign_audit'           => json_encode($audit),
                    'ord_status'               => SaleOrderModel::STATUS_IN_PROGRESS,
                ]);

                // Créer automatiquement le contrat si la commande contient des lignes d'abonnement
                $document->refresh();
                $hasSubscriptionLines = $document->lines()
                    ->where('orl_is_subscription', 1)
                    ->where('orl_type', 0)
                    ->exists();

                if ($hasSubscriptionLines) {
                    $authorUserId = $document->fk_usr_id_author ?? $document->fk_usr_id_seller ?? $document->fk_usr_id_updater;
                    $this->contractCreation->createFromSaleOrder($document, (int) $authorUserId);
                }
            } else {
                $document->update([
                    'con_validation_data'      => $validationData,
                    'con_sign_token_used_at'   => Carbon::now(),
                    'con_sign_signature_image' => $data['signature_image'],
                    'con_sign_cgv_version'     => $data['cgv_version'],
                    'con_sign_audit'           => json_encode($audit),
                    'con_status'               => ContractModel::STATUS_ACTIVE,
                ]);
            }

            // Régénérer le PDF final avec la signature embarquée
            // On recharge le document pour que validation_data soit pris en compte
            $document->refresh();

            $signedPdfBinary = $isOrder
                ? $this->pdfService->generateSaleOrderPdfRaw($docId)
                : $this->pdfService->generateContractPdfRaw($docId);

            $docModule = $isOrder ? 'sale-orders' : 'contracts';
            $docNumber = $isOrder ? $document->ord_number : $document->con_number;
            $filename  = ($isOrder ? 'Offre_commerciale_signee_' : 'Contrat_signe_') . $docNumber . '_' . date('Ymd_His') . '.pdf';

            // Stocker le PDF signé (apparaît dans l'onglet Fichiers)
            $authorUserId = $isOrder
                ? ($document->fk_usr_id_author ?? $document->fk_usr_id_seller ?? $document->fk_usr_id_updater)
                : ($document->fk_usr_id_author ?? $document->fk_usr_id_updater);
            $this->documentService->storeFileFromContent(
                $signedPdfBinary,
                $filename,
                'application/pdf',
                $docModule,
                $docId,
                $authorUserId
            );

            // Retourner le contexte nécessaire aux emails (hors transaction)
            return compact('signerEmail', 'docId', 'docNumber', 'isOrder', 'signedPdfBinary', 'filename', 'document');
        });

        // Phase 2 : envois d'emails après commit (jamais dans la transaction)
        if (!empty($ctx['signerEmail'])) {
            $this->sendConfirmationEmail(
                $ctx['signerEmail'],
                $ctx['docId'],
                $ctx['docNumber'],
                $ctx['isOrder'],
                $ctx['signedPdfBinary'],
                $ctx['filename']
            );
        } else {
            Log::warning('SignatureService: signerEmail manquant, email de confirmation non envoyé.', ['docId' => $ctx['docId']]);
        }

        if ($ctx['isOrder']) {
            $this->sendSellerAlertEmail($ctx['document'], $ctx['docId']);
        }
    }

    private function sendConfirmationEmail(string $to, int $docId, string $docNumber, bool $isOrder, string $pdfBinary, string $filename): void
    {
        try {
            if ($isOrder) {
                $saleConfig = SaleConfigModel::with(['emailAccount'])->first();
                $account    = $saleConfig?->emailAccount;
                $emtId      = $saleConfig?->fk_emt_id_sale_confirmation;
            } else {
                $contractConfig = ContractConfigModel::with(['emailAccount'])->first();
                $account        = $contractConfig?->emailAccount;
                $emtId          = null;
            }

            if (!$account) {
                Log::warning('SignatureService: aucun compte email configuré pour l\'envoi de confirmation.');
                return;
            }

            if ($emtId) {
                $data    = TemplateParserService::buildData('sale', $docId);
                $parsed  = $this->templateParser->parseTemplate($emtId, $data);
                $subject = $parsed['subject'];
                $body    = $parsed['body'];
            } else {
                $docType = $isOrder ? 'offre commerciale' : 'contrat';
                $subject = "Votre {$docType} {$docNumber} — Confirmation de signature";
                $body    = "<p>Bonjour,</p>"
                    . "<p>Nous confirmons la bonne réception de votre signature électronique pour votre {$docType} <strong>{$docNumber}</strong>.</p>"
                    . "<p>Vous trouverez ci-joint le document signé pour vos archives.</p>"
                    . "<p>Cordialement</p>";
            }

            $tmpPath = sys_get_temp_dir() . '/' . uniqid('signed_') . '.pdf';
            file_put_contents($tmpPath, $pdfBinary);

            $this->emailService->sendEmail($account, $to, $subject, $body, [
                'attachments' => [['path' => $tmpPath, 'name' => $filename]],
            ]);

            @unlink($tmpPath);
        } catch (\Exception $e) {
            Log::error('SignatureService: erreur envoi email de confirmation', ['error' => $e->getMessage()]);
        }
    }

    private function sendSellerAlertEmail(SaleOrderModel $document, int $docId): void
    {
        try {
            $seller = $document->seller;
            if (!$seller || empty($seller->usr_login)) {
                return;
            }

            $saleConfig = SaleConfigModel::with(['emailAccount'])->first();
            $account    = $saleConfig?->emailAccount;

            if (!$account) {
                Log::warning('SignatureService: aucun compte email configuré pour l\'alerte commercial.');
                return;
            }

            $emtId = $saleConfig?->fk_emt_id_seller_alert;

            if ($emtId) {
                $data = TemplateParserService::buildData('sale', $docId);

                // En contexte public (signature sans auth), buildData ne remplit pas $data['user'].
                // On l'injecte manuellement depuis le commercial pour que {user.xxx} soit résolu.
                if (empty($data['user'])) {
                    $data['user'] = [
                        'id'        => $seller->usr_id,
                        'firstname' => $seller->usr_firstname ?? '',
                        'lastname'  => $seller->usr_lastname  ?? '',
                        'fullname'  => trim(($seller->usr_firstname ?? '') . ' ' . ($seller->usr_lastname ?? '')),
                        'email'     => $seller->usr_login     ?? '',
                        'phone'     => $seller->usr_tel       ?? '',
                        'mobile'    => $seller->usr_mobile    ?? '',
                        'job_title' => $seller->usr_jobtitle  ?? '',
                    ];
                }

                $parsed  = $this->templateParser->parseTemplate($emtId, $data);
                $subject = $parsed['subject'];
                $body    = $parsed['body'];
            } else {
                $docNumber = $document->ord_number;
                $subject   = "Offre commerciale {$docNumber} — Signature client reçue";
                $body      = "<p>Bonjour,</p>"
                    . "<p>L'offre commerciale <strong>{$docNumber}</strong> vient d'être signée par le client.</p>"
                    . "<p>Cordialement</p>";
            }

            $this->emailService->sendEmail($account, $seller->usr_login, $subject, $body);
        } catch (\Exception $e) {
            Log::error('SignatureService: erreur envoi alerte commercial', ['error' => $e->getMessage()]);
        }
    }

    private function loadDocument(string $docType, int $docId): array
    {
        if ($docType === 'sale_order') {
            $doc = SaleOrderModel::with(['partner'])->findOrFail($docId);
            return [$doc, true];
        }
        $doc = ContractModel::with(['partner'])->findOrFail($docId);
        return [$doc, false];
    }
}
