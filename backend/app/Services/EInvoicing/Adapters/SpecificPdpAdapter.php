<?php

namespace App\Services\EInvoicing\Adapters;

use App\Models\EInvoicingConfigModel;

/**
 * Adaptateur pour un PA dont l'API utilise le profil "specific_v1".
 * Hérite de GenericPdpAdapter et surcharge uniquement les endpoints qui diffèrent.
 */
class SpecificPdpAdapter extends GenericPdpAdapter
{
    public function __construct(EInvoicingConfigModel $config)
    {
        parent::__construct($config);
    }

    public function generateInvoice(array $invoiceDto): array
    {
        // Ce PA attend le DTO encapsulé dans invoiceData
        $payload = [
            'invoiceLang'  => $invoiceDto['invoiceLang'] ?? 'fr',
            'signInvoice'  => $invoiceDto['signInvoice'] ?? false,
            'invoiceData'  => $invoiceDto['invoiceData'] ?? $invoiceDto,
        ];

        $result = $this->http->post('/v1/invoice/generate', $payload);

        return [
            'fileId' => $result['fileId'] ?? $result['id'] ?? null,
            'raw'    => $result,
        ];
    }

    public function supportsFeature(string $feature): bool
    {
        return in_array($feature, ['directory', 'validation', 'signing', 'e-reporting'], true);
    }
}
