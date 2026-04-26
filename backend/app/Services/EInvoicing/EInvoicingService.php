<?php

namespace App\Services\EInvoicing;

use App\Models\CompanyModel;
use App\Models\EInvoicingConfigModel;
use App\Models\EInvoicingEReportingModel;
use App\Models\EInvoicingReceivedModel;
use App\Models\EInvoicingTransmissionModel;
use App\Models\InvoiceModel;
use App\Models\PartnerModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class EInvoicingService
{
    public function __construct(private FactureXGeneratorService $factureXService)
    {
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    public function getConfig(): EInvoicingConfigModel
    {
        return EInvoicingConfigModel::firstOrCreate(
            [],
            [
                'eic_pdp_profile'          => 'custom',
                'eic_pdp_adapter'          => 'generic',
                'eic_api_url'              => '',
                'eic_validate_before_send' => true,
                'eic_auto_transmit'        => false,
                'eic_facturex_profile'     => 'EN16931',
            ]
        );
    }

    public function saveConfig(array $data, int $userId): EInvoicingConfigModel
    {
        $config = $this->getConfig();

        // Si un profil pré-paramétré est sélectionné, appliquer l'URL et l'adaptateur
        if (!empty($data['eic_pdp_profile']) && $data['eic_pdp_profile'] !== 'custom') {
            $profile = PdpClientFactory::getProfile($data['eic_pdp_profile']);
            if ($profile) {
                $data['eic_api_url']     = $data['eic_api_url']     ?? $profile['api_url'];
                $data['eic_pdp_adapter'] = $profile['pdp_adapter'];
            }
        }

        $data['fk_usr_id_updater'] = $userId;

        // Ne pas écraser les champs sensibles si le frontend envoie '***' (valeur masquée)
        foreach (['eic_client_secret', 'eic_webhook_secret'] as $sensitive) {
            if (isset($data[$sensitive]) && $data[$sensitive] === '***') {
                unset($data[$sensitive]);
            }
        }

        // Invalider le cache OAuth2 si les credentials changent
        $credentialFields = ['eic_client_id', 'eic_client_secret', 'eic_token_url', 'eic_api_url'];
        foreach ($credentialFields as $field) {
            if (isset($data[$field]) && $data[$field] !== $config->$field) {
                $data['eic_oauth_token']      = null;
                $data['eic_oauth_expires_at'] = null;
                break;
            }
        }

        $config->update($data);
        return $config->fresh();
    }

    public function testConnection(): string
    {
        $config = $this->getConfig();
        $pdp    = PdpClientFactory::make($config);
        return $pdp->testConnection(); // retourne le message de succès ou lance une exception
    }

    // -----------------------------------------------------------------------
    // Enregistrement de l'entreprise chez le PA (one-time setup)
    // -----------------------------------------------------------------------

    public function registerBusinessEntity(int $userId): array
    {
        $config  = $this->getConfig();
        $pdp     = PdpClientFactory::make($config);
        $company = CompanyModel::first();

        $siren = substr($company->cop_registration_code ?? '', 0, 9);
        $siret = $company->cop_siret ?? $company->cop_registration_code ?? '';

        DB::beginTransaction();
        try {
            // Étape 1 — Créer l'unité légale
            $legalUnit = $pdp->registerLegalUnit([
                'name'  => $company->cop_label,
                'siren' => $siren,
            ]);
            $legalUnitId = $legalUnit['id'] ?? $legalUnit['legalUnitId'] ?? null;

            // Étape 2 — Créer l'établissement
            $office = $pdp->registerOffice($legalUnitId, [
                'siret'   => $siret,
                'address' => $company->cop_address,
                'city'    => $company->cop_city,
                'zip'     => $company->cop_zip,
                'country' => 'FR',
            ]);
            $businessEntityId = $office['businessEntityId'] ?? $office['id'] ?? $legalUnitId;

            // Étape 3 — Revendiquer l'entité
            $pdp->claimEntity($businessEntityId);

            // Étape 4 — Enregistrer l'identifiant électronique
            $pdp->registerIdentifier($businessEntityId);

            // Sauvegarder l'ID
            $config->update([
                'eic_business_entity_id' => $businessEntityId,
                'eic_entity_registered'  => true,
                'fk_usr_id_updater'      => $userId,
            ]);

            DB::commit();

            return [
                'success'          => true,
                'businessEntityId' => $businessEntityId,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('EInvoicing registerBusinessEntity failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    // -----------------------------------------------------------------------
    // Émission — Transmission de facture client
    // -----------------------------------------------------------------------

    public function transmitInvoice(int $invoiceId, int $userId): EInvoicingTransmissionModel
    {
        $invoice = InvoiceModel::with(['partner', 'lines'])->findOrFail($invoiceId);

        // Validation des prérequis
        if ($invoice->inv_status < InvoiceModel::STATUS_FINALIZED) {
            throw new \RuntimeException('Seules les factures validées peuvent être transmises.');
        }
        if (!in_array($invoice->inv_operation, [
            InvoiceModel::OPERATION_CUSTOMER_INVOICE,
            InvoiceModel::OPERATION_CUSTOMER_REFUND,
        ])) {
            throw new \RuntimeException('Seules les factures et avoirs clients peuvent être transmis.');
        }

        // Vérifier qu'une transmission n'est pas déjà en cours
        $existing = EInvoicingTransmissionModel::where('fk_inv_id', $invoiceId)
            ->whereNotIn('eit_status', [
                EInvoicingTransmissionModel::STATUS_REFUSEE,
                EInvoicingTransmissionModel::STATUS_ERROR,
            ])
            ->first();
        if ($existing) {
            throw new \RuntimeException('Une transmission est déjà active pour cette facture (statut: ' . $existing->eit_status . ').');
        }

        $config = $this->getConfig();
        $pdp    = PdpClientFactory::make($config);

        DB::beginTransaction();
        try {
            // Créer la trace de transmission
            $transmission = EInvoicingTransmissionModel::create([
                'fk_inv_id'          => $invoiceId,
                'fk_usr_id_author'   => $userId,
                'eit_status'         => EInvoicingTransmissionModel::STATUS_PENDING,
                'eit_created'        => now(),
                'eit_updated'        => now(),
            ]);

            // Générer le Facture-X localement (PDF/A-3 + XML CII)
            $factureXBinary = $this->factureXService->generateFromInvoice($invoice);

            // Stocker le fichier Facture-X localement
            $filename = ($invoice->inv_number ?? 'facture') . '_' . now()->format('Ymd_His') . '.pdf';
            $path     = 'einvoicing/sent/' . $filename;
            Storage::disk('private')->put($path, $factureXBinary);
            $transmission->update(['eit_facturex_path' => $path]);

            // Envoyer le PDF au PA via multipart (POST /v1/invoice)
            $sent      = $pdp->sendInvoice($factureXBinary, $filename);
            $paInvId   = $sent['invoiceId'];

            $transmission->update([
                'eit_pa_invoice_id'  => $paInvId,
                'eit_status'         => EInvoicingTransmissionModel::STATUS_DEPOSEE,
                'eit_transmitted_at' => now(),
                'eit_last_event_at'  => now(),
                'eit_pa_response'    => json_encode($sent['raw'] ?? []),
            ]);

            DB::commit();
            return $transmission->fresh();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('EInvoicing transmitInvoice failed', [
                'inv_id' => $invoice->inv_id,
                'error'  => $e->getMessage(),
            ]);
            // Marquer en erreur si la transmission a été créée
            if (isset($transmission)) {
                $transmission->update([
                    'eit_status'        => EInvoicingTransmissionModel::STATUS_ERROR,
                    'eit_error_message' => $e->getMessage(),
                ]);
            }
            throw $e;
        }
    }

    public function getTransmission(int $invoiceId): ?EInvoicingTransmissionModel
    {
        return EInvoicingTransmissionModel::where('fk_inv_id', $invoiceId)
            ->latest('eit_created')
            ->first();
    }

    public function downloadFactureX(int $invoiceId): ?string
    {
        $transmission = $this->getTransmission($invoiceId);
        if (!$transmission || !$transmission->eit_facturex_path) {
            return null;
        }
        return Storage::disk('private')->get($transmission->eit_facturex_path);
    }

    // -----------------------------------------------------------------------
    // Réception — Webhooks entrants
    // -----------------------------------------------------------------------

    public function processWebhookLifecycle(string $paInvoiceId, array $payload): void
    {
        // Mettre à jour une transmission sortante
        $transmission = EInvoicingTransmissionModel::where('eit_pa_invoice_id', $paInvoiceId)->first();
        if ($transmission) {
            $newStatus = $payload['status'] ?? $payload['lifecycleStatus'] ?? null;
            if ($newStatus) {
                $transmission->update([
                    'eit_status'        => strtoupper($newStatus),
                    'eit_last_event_at' => now(),
                    'eit_pa_response'   => json_encode($payload),
                ]);
            }
            return;
        }

        // Sinon, c'est une facture fournisseur reçue
        $this->processReceivedInvoice($paInvoiceId, $payload);
    }

    private function processReceivedInvoice(string $paInvoiceId, array $payload): void
    {
        EInvoicingReceivedModel::updateOrCreate(
            ['eir_pa_invoice_id' => $paInvoiceId],
            [
                'eir_pa_status'      => $payload['status'] ?? null,
                'eir_our_status'     => EInvoicingReceivedModel::STATUS_PENDING,
                'eir_sender_siren'   => $payload['sender']['siren'] ?? $payload['senderSiren'] ?? null,
                'eir_sender_siret'   => $payload['sender']['siret'] ?? $payload['senderSiret'] ?? null,
                'eir_sender_name'    => $payload['sender']['name'] ?? $payload['senderName'] ?? null,
                'eir_invoice_number' => $payload['invoiceId'] ?? $payload['invoiceNumber'] ?? null,
                'eir_invoice_date'   => $payload['invoiceDate'] ?? null,
                'eir_due_date'       => $payload['invoiceDueDate'] ?? null,
                'eir_amount_ht'      => $payload['monetary']['taxBasisTotalAmount'] ?? null,
                'eir_amount_ttc'     => $payload['monetary']['invoiceAmount'] ?? null,
                'eir_raw_payload'    => json_encode($payload),
                'eir_created'        => now(),
                'eir_updated'        => now(),
            ]
        );
    }

    public function storeReceivedFactureX(string $paInvoiceId): void
    {
        $config  = $this->getConfig();
        $pdp     = PdpClientFactory::make($config);
        $received = EInvoicingReceivedModel::where('eir_pa_invoice_id', $paInvoiceId)->firstOrFail();

        // Télécharger le fichier Facture-X depuis le PA
        $binary = $pdp->downloadFile($paInvoiceId);
        $path   = 'einvoicing/received/' . $paInvoiceId . '.pdf';
        Storage::disk('private')->put($path, $binary);

        $received->update(['eir_facturex_path' => $path, 'eir_updated' => now()]);
    }

    public function updateReceivedStatus(int $receivedId, string $status, int $userId): void
    {
        $received = EInvoicingReceivedModel::findOrFail($receivedId);

        $allowed = [
            EInvoicingReceivedModel::STATUS_ACCEPTEE,
            EInvoicingReceivedModel::STATUS_REFUSEE,
            EInvoicingReceivedModel::STATUS_EN_PAIEMENT,
            EInvoicingReceivedModel::STATUS_PAYEE,
        ];
        if (!in_array($status, $allowed)) {
            throw new \InvalidArgumentException("Statut invalide: {$status}");
        }

        $config = $this->getConfig();
        $pdp    = PdpClientFactory::make($config);
        $pdp->sendStatus($received->eir_pa_invoice_id, $status);

        $received->update(['eir_our_status' => $status, 'eir_updated' => now()]);
    }

    public function importReceivedInvoice(int $receivedId, int $userId): InvoiceModel
    {
        $received = EInvoicingReceivedModel::findOrFail($receivedId);

        if ($received->isImported()) {
            throw new \RuntimeException('Cette facture a déjà été importée.');
        }

        // Chercher ou créer le partenaire fournisseur
        $partner = null;
        if ($received->eir_sender_siren) {
            $partner = PartnerModel::where('ptr_siret', $received->eir_sender_siren)
                ->orWhere('ptr_siret', $received->eir_sender_siret)
                ->first();
        }
        if (!$partner && $received->eir_sender_name) {
            $partner = PartnerModel::where('ptr_name', 'like', '%' . $received->eir_sender_name . '%')
                ->where('ptr_is_supplier', 1)
                ->first();
        }

        DB::beginTransaction();
        try {
            // Créer la facture fournisseur en brouillon
            $invoice = InvoiceModel::create([
                'inv_operation'        => InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                'inv_status'           => InvoiceModel::STATUS_DRAFT,
                'inv_date'             => $received->eir_invoice_date,
                'inv_duedate'          => $received->eir_due_date,
                'inv_externalreference'=> $received->eir_invoice_number,
                'inv_totalht'          => $received->eir_amount_ht,
                'inv_totalttc'         => $received->eir_amount_ttc,
                'inv_totaltax'         => ($received->eir_amount_ttc ?? 0) - ($received->eir_amount_ht ?? 0),
                'inv_amount_remaining' => $received->eir_amount_ttc,
                'inv_payment_progress' => 0,
                'fk_ptr_id'            => $partner?->ptr_id,
                'fk_usr_id_author'     => $userId,
                'fk_usr_id_updater'    => $userId,
            ]);

            // Lier la réception à la facture importée
            $received->update([
                'fk_inv_id'      => $invoice->inv_id,
                'eir_imported_at'=> now(),
                'eir_our_status' => EInvoicingReceivedModel::STATUS_ACCEPTEE,
                'eir_updated'    => now(),
            ]);

            // Envoyer l'accusé ACCEPTEE au PA
            try {
                $config = $this->getConfig();
                $pdp    = PdpClientFactory::make($config);
                $pdp->sendStatus($received->eir_pa_invoice_id, EInvoicingReceivedModel::STATUS_ACCEPTEE);
            } catch (\Throwable $e) {
                Log::warning('EInvoicing: accusé de réception PA échoué', ['error' => $e->getMessage()]);
            }

            DB::commit();
            return $invoice;
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // -----------------------------------------------------------------------
    // E-reporting
    // -----------------------------------------------------------------------

    public function buildEReportingForPeriod(string $period, string $type): EInvoicingEReportingModel
    {
        [$year, $month] = explode('-', $period);
        $start = "{$year}-{$month}-01";
        $end   = date('Y-m-t', strtotime($start));

        // Identifier les factures concernées selon le type
        $query = InvoiceModel::whereBetween('inv_date', [$start, $end])
            ->where('inv_status', '>=', InvoiceModel::STATUS_FINALIZED)
            ->where('inv_operation', InvoiceModel::OPERATION_CUSTOMER_INVOICE);

        if ($type === EInvoicingEReportingModel::TYPE_B2C) {
            // B2C : partenaires sans SIREN (particuliers)
            $query->whereHas('partner', fn($q) => $q->whereNull('ptr_siret')->orWhere('ptr_siret', ''));
        } elseif ($type === EInvoicingEReportingModel::TYPE_B2B_INTL) {
            // B2B international : partenaires hors France
            $query->whereHas('partner', fn($q) => $q->where('ptr_country_code', '!=', 'FR')
                ->whereNotNull('ptr_country_code'));
        }

        $invoices   = $query->get();
        $totalHt    = $invoices->sum('inv_totalht');
        $totalTtc   = $invoices->sum('inv_totalttc');
        $invoiceIds = $invoices->pluck('inv_id')->all();

        return EInvoicingEReportingModel::updateOrCreate(
            ['eer_period' => $period, 'eer_type' => $type],
            [
                'eer_status'     => EInvoicingEReportingModel::STATUS_PENDING,
                'eer_amount_ht'  => $totalHt,
                'eer_amount_ttc' => $totalTtc,
                'eer_invoice_ids'=> $invoiceIds,
                'eer_created'    => now(),
                'eer_updated'    => now(),
            ]
        );
    }

    public function transmitEReporting(int $erId, int $userId): EInvoicingEReportingModel
    {
        $reporting = EInvoicingEReportingModel::findOrFail($erId);
        $config    = $this->getConfig();
        $pdp       = PdpClientFactory::make($config);

        if (!$pdp->supportsFeature('e-reporting')) {
            throw new \RuntimeException('Le PA configuré ne supporte pas l\'e-reporting.');
        }

        // TODO: implémenter l'endpoint e-reporting spécifique au PA une fois documenté
        // Pour l'instant, simuler la transmission
        $reporting->update([
            'eer_status'         => EInvoicingEReportingModel::STATUS_TRANSMITTED,
            'eer_transmitted_at' => now(),
            'eer_updated'        => now(),
        ]);

        return $reporting->fresh();
    }

    // -----------------------------------------------------------------------
    // Sync des statuts (polling — appelé par le scheduler)
    // -----------------------------------------------------------------------

    public function syncPendingStatuses(): void
    {
        $pending = EInvoicingTransmissionModel::whereNotIn('eit_status', [
            EInvoicingTransmissionModel::STATUS_ACCEPTEE,
            EInvoicingTransmissionModel::STATUS_REFUSEE,
            EInvoicingTransmissionModel::STATUS_PAYEE,
            EInvoicingTransmissionModel::STATUS_ERROR,
        ])->whereNotNull('eit_pa_invoice_id')->get();

        if ($pending->isEmpty()) return;

        // Le polling actif n'est utilisé que si les webhooks ne sont pas configurés
        // Ici on log seulement — les statuts arrivent normalement via webhook
        Log::info('EInvoicing: ' . $pending->count() . ' transmission(s) en attente de statut PA.');
    }

    // -----------------------------------------------------------------------
    // Annuaire PA
    // -----------------------------------------------------------------------

    public function searchDirectory(string $query): array
    {
        $config = $this->getConfig();
        $pdp    = PdpClientFactory::make($config);
        return $pdp->searchDirectory($query);
    }
}
