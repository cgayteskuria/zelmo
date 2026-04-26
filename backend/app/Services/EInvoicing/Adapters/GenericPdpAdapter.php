<?php

namespace App\Services\EInvoicing\Adapters;

use App\Models\EInvoicingConfigModel;
use App\Services\EInvoicing\PdpClientInterface;
use App\Services\EInvoicing\PdpHttpClient;

/**
 * Adaptateur Iopole (et PAs compatibles REST multipart).
 * Flux d'émission : POST /v1/invoice (multipart PDF) → invoiceId.
 */
class GenericPdpAdapter implements PdpClientInterface
{
    protected PdpHttpClient $http;
    protected EInvoicingConfigModel $config;

    public function __construct(EInvoicingConfigModel $config)
    {
        $this->config = $config;
        $this->http   = new PdpHttpClient($config);
    }

    /**
     * Envoie le Facture-X PDF au PA via multipart/form-data.
     * POST /v1/invoice → { type: "INVOICE", id: "<uuid>" }
     */
    public function sendInvoice(string $pdfBinary, string $filename): array
    {
        $result = $this->http->postMultipart('/v1/invoice', [
            [
                'name'     => 'file',
                'contents' => $pdfBinary,
                'filename' => $filename,
                'headers'  => ['Content-Type' => 'application/pdf'],
            ],
        ]);

        $invoiceId = $result['id'] ?? null;
        if (!$invoiceId) {
            throw new \RuntimeException(
                'Le PA n\'a pas retourné d\'identifiant de facture. Réponse : ' . json_encode($result)
            );
        }

        return ['invoiceId' => $invoiceId, 'raw' => $result];
    }

    public function downloadFile(string $invoiceId): string
    {
        return $this->http->downloadBinary("/v1/invoice/{$invoiceId}/download");
    }

    public function sendStatus(string $paInvoiceId, string $status, ?string $message = null): void
    {
        $body = ['code' => $status];
        if ($message) {
            $body['message'] = $message;
        }
        $this->http->post("/v1/invoice/{$paInvoiceId}/status", $body);
    }

    public function registerLegalUnit(array $entityData): array
    {
        return $this->http->post('/v1/pdp/business/entity/legalunit', $entityData);
    }

    public function registerOffice(string $legalUnitId, array $officeData): array
    {
        return $this->http->post("/v1/pdp/business/entity/legalunit/{$legalUnitId}/office", $officeData);
    }

    public function claimEntity(string $businessEntityId): array
    {
        return $this->http->post("/v1/pdp/business/entity/{$businessEntityId}/claim");
    }

    public function registerIdentifier(string $identifierId): array
    {
        return $this->http->post("/v1/pdp/business/entity/identifier/{$identifierId}/register");
    }

    public function searchDirectory(string $query): array
    {
        return $this->http->get('/v1/directory/french', ['q' => $query]);
    }

    public function supportsFeature(string $feature): bool
    {
        return in_array($feature, ['directory', 'e-reporting'], true);
    }

    public function testConnection(): string
    {
        return $this->http->testCredentials();
    }
}
