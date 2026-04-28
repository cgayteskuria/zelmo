<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Models\PartnerModel;
use App\Models\ProductModel;
use App\Models\AccountTaxModel;
use App\Models\InvoiceModel;
use App\Models\CompanyModel;
use App\Models\PurchaseOrderConfigModel;
use App\Models\DurationsModel;

use veryfi\Client;

class VeryfiService
{


    public function __construct() {}

    /**
     * Process a document through Veryfi OCR
     *
     * @param string $filePath Full path to the file
     * @return array Normalized OCR data
     * @throws \Exception
     */
    public function processDocument(string $filePath): array
    {
        try {

            // Load credentials from company table (cop_id = 1)
            $company = CompanyModel::find(1);

            if (!$company) {
                throw new \Exception('Company not found');
            }

            $clientId = $company->cop_veryfi_client_id;
            $clientSecret = $company->cop_veryfi_client_secret;
            $username = $company->cop_veryfi_username;
            $apiKey = $company->cop_veryfi_api_key;

            if (!$clientId || !$clientSecret || !$username || !$apiKey) {
                throw new \Exception('Veryfi API credentials are not configured. Please configure them in Settings > Company > Veryfi tab.');
            }


            $veryfi_client = new Client($clientId, $clientSecret, $username, $apiKey);


            if (!file_exists($filePath)) {
                throw new \Exception("Fichier introuvable: " . $filePath);
            }

            if (!is_readable($filePath)) {
                throw new \Exception("Fichier non lisible: " . $filePath);
            }

            if (filesize($filePath) === 0) {
                throw new \Exception("Fichier vide: " . $filePath);
            }

            $additionalParams = [
                'document_type' => 'invoice',
                'country' => 'FR'
            ];

            $rawResponse = $veryfi_client->process_document_base64($filePath, [], false, $additionalParams);

            if ($rawResponse === false || $rawResponse === '') {
                $networkError = $this->debugVeryfiConnection();
                throw new \Exception(
                    "Veryfi ne répond pas.\n" .
                        $networkError . "\n" .
                        "Cause probable : SSL, proxy, pare-feu ou certificats manquants."
                );
            }


            $response = json_decode($rawResponse, true);

            if (isset($response['status']) && $response['status'] === 'fail') {
                throw new \Exception($response['error'] ?? 'Veryfi processing failed');
            }

            //Log::info('Veryfi OCR response', ['response' => $response]);
            return $response;
            ///     return $this->normalizeVeryfiResponse($response);
        } catch (\Exception $e) {
            //  Log::error('Veryfi OCR error', ['error' => $e->getMessage()]);
            throw new \Exception("Erreur lors de l'analyse OCR: " . $e->getMessage());
        }
    }

    /**
     * Test Veryfi API credentials by listing documents (limit 1)
     */
    public function testCredentials(string $clientId, string $clientSecret, string $username, string $apiKey): array
    {
        try {
            $client = new Client($clientId, $clientSecret, $username, $apiKey);
            $raw = $client->get_documents(['limit' => 1]);
            $response = is_string($raw) ? json_decode($raw, true) : $raw;

            if (isset($response['status']) && $response['status'] === 'fail') {
                return ['success' => false, 'message' => $response['error'] ?? 'Authentification échouée'];
            }

            return ['success' => true, 'message' => 'Connexion Veryfi établie avec succès'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function debugVeryfiConnection(): string
    {
        $ch = curl_init("https://api.veryfi.com/api/v8/partner/documents/");

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HEADER => false,
        ]);

        $response = curl_exec($ch);

        if ($response === false) {
            $error = curl_error($ch);
            $errno = curl_errno($ch);
            curl_close($ch);

            return "Erreur réseau Veryfi (cURL): [$errno] $error";
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return "Connexion Veryfi OK (HTTP $httpCode). Réponse brute: " . substr($response, 0, 300);
    }

    
    /**
     * Match vendor name to existing partner (supplier)
     *
     * @param string|null $vendorName
     * @return array Partner match info
     */
    public function matchVendor(?string $vendorName): array
    {
        if (!$vendorName) {
            return [
                'ptr_id' => null,
                'ptr_name' => null,
                'matched' => false
            ];
        }

        // Normalize search string: lowercase, remove spaces
        $searchNormalized = strtolower(str_replace(' ', '', $vendorName));

        // Search for matching supplier
        $partner = PartnerModel::whereRaw(
            "LOWER(REPLACE(ptr_name, ' ', '')) LIKE ?",
            ['%' . $searchNormalized . '%']
        )
            ->where('ptr_is_supplier', 1)
            ->first();

        if ($partner) {
            return [
                'ptr_id' => $partner->ptr_id,
                'ptr_name' => $partner->ptr_name,
                'fk_pam_id' => $partner->fk_pam_id_supplier,
                'fk_dur_id_payment_condition' => $partner->fk_dur_id_supplier,
                'matched' => true
            ];
        }

        return [
            'ptr_id' => null,
            'ptr_name' => $vendorName,
            'matched' => false
        ];
    }

    /**
     * Check for duplicate invoice numbers for a partner
     *
     * @param string|null $invoiceNumber External reference
     * @param int|null $ptrId Partner ID
     * @return array|null Duplicate info if found
     */
    public function checkDuplicateInvoice(?string $invoiceNumber, ?int $ptrId): ?array
    {
        if (!$invoiceNumber) {
            return null;
        }

        $query = InvoiceModel::where('inv_externalreference', $invoiceNumber)
            ->whereIn('inv_operation', [
                InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                InvoiceModel::OPERATION_SUPPLIER_REFUND,
                InvoiceModel::OPERATION_SUPPLIER_DEPOSIT
            ]);

        if ($ptrId) {
            $query->where('fk_ptr_id', $ptrId);
        }

        $existing = $query->first();

        if ($existing) {
            return [
                'inv_id' => $existing->inv_id,
                'inv_number' => $existing->inv_number,
                'inv_date' => $existing->inv_date
            ];
        }

        return null;
    }

    /**
     * Match products by description or SKU
     *
     * @param array $lineItems Line items from OCR
     * @return array Line items with product matches
     */
    public function matchProducts(array $lineItems): array
    {
        // On récupère l'ID par défaut une seule fois avant la boucle
        $purchaseConfig = PurchaseOrderConfigModel::find(1);
        $defaultProductId = $purchaseConfig?->fk_prt_id_default;

        return array_map(function ($item) use ($defaultProductId) {
            $product = null;

            // 1. Recherche par SKU/Référence
            if (!empty($item['sku'])) {
                $product = ProductModel::where('prt_ref', $item['sku'])
                    ->where('prt_is_purchasable', 1)
                    ->first();
            }

            // 2. Recherche par Description
            if (!$product && !empty($item['description'])) {
                // Correspondance exacte
                $product = ProductModel::where('prt_label', $item['description'])
                    ->where('prt_is_purchasable', 1)
                    ->first();

                // Correspondance partielle (Fuzzy)
                if (!$product) {
                    $searchTerms = array_filter(explode(' ', $item['description']));
                    if (count($searchTerms) > 0) {
                        $query = ProductModel::where('prt_is_purchasable', 1);
                        foreach (array_slice($searchTerms, 0, 3) as $term) {
                            if (strlen($term) >= 3) {
                                $query->where('prt_label', 'LIKE', '%' . $term . '%');
                            }
                        }
                        $product = $query->first();
                    }
                }
            }

            // 3. Application du produit trouvé OU du produit par défaut
            // On considère 'matched' à true SEULEMENT si un vrai produit a été trouvé en base
            $isMatched = $product !== null;

            // Si aucun produit n'est trouvé, on tente de charger le produit par défaut pour récupérer ses infos (taxes, labels)
            if (!$isMatched && $defaultProductId) {
                $product = ProductModel::find($defaultProductId);
            }

            return array_merge($item, [
                'prt_id'             => $product?->prt_id ?? $defaultProductId,
                'prt_label'          => $product?->prt_label ?? $item['description'],
                'fk_tax_id_purchase' => $product?->fk_tax_id_purchase,
                'matched'            => $isMatched // Reste à false si c'est le fallback par défaut
            ]);
        }, $lineItems);
    }

    /**
     * Match tax rates to existing taxes
     *
     * @param array $lineItems Line items with potential tax rates
     * @return array Line items with tax matches
     */
    public function matchTaxRates(array $lineItems): array
    {
        // Cache for tax lookups to avoid repeated queries
        $taxCache = [];

        return array_map(function ($item) use (&$taxCache) {
            $taxRate = $item['tax_rate'] ?? null;
            $taxId = null;
            $taxLabel = null;

            // If product has a purchase tax, use that
            if (!empty($item['fk_tax_id_purchase'])) {
                $productTax = AccountTaxModel::find($item['fk_tax_id_purchase']);
                if ($productTax && $productTax->tax_use === 'purchase') {
                    $taxId = $productTax->tax_id;
                    $taxLabel = $productTax->tax_label;
                    $taxRate = $productTax->tax_rate;
                }
            }

            // Otherwise, try to match by rate
            if (!$taxId && $taxRate !== null) {
                $cacheKey = (string) $taxRate;

                if (!isset($taxCache[$cacheKey])) {
                    $tax = AccountTaxModel::where('tax_rate', $taxRate)
                        ->where('tax_use', 'purchase')
                        ->where('tax_is_active', 1)
                        ->first();

                    $taxCache[$cacheKey] = $tax;
                }

                if ($taxCache[$cacheKey]) {
                    $taxId = $taxCache[$cacheKey]->tax_id;
                    $taxLabel = $taxCache[$cacheKey]->tax_label;
                }
            }

            // Default to 20% TVA if nothing found
            if (!$taxId) {
                if (!isset($taxCache['default'])) {
                    $defaultTax = AccountTaxModel::where('tax_rate', 20)
                        ->where('tax_use', 'purchase')
                        ->where('tax_is_active', 1)
                        ->first();

                    $taxCache['default'] = $defaultTax;
                }

                if ($taxCache['default']) {
                    $taxId = $taxCache['default']->tax_id;
                    $taxLabel = $taxCache['default']->tax_label;
                    $taxRate = $taxCache['default']->tax_rate;
                }
            }

            return array_merge($item, [
                'fk_tax_id' => $taxId,
                'tax_label' => $taxLabel,
                'tax_rate_matched' => $taxRate
            ]);
        }, $lineItems);
    }

    /**
     * Process a complete invoice import workflow
     *
     * @param string $filePath Path to the PDF file
     * @return array Complete processed data with all matches
     */
    public function processInvoiceImport(string $filePath): array
    {
        // 1. OCR Processing
         $ocrData = $this->processDocument($filePath);
       
        // 2. Match vendor
        $vendor = $this->matchVendor($ocrData['vendor']["name"]);

        // 3. Check for duplicates
        $duplicate = null;
        if ($ocrData['invoice_number']) {
            $duplicate = $this->checkDuplicateInvoice(
                $ocrData['invoice_number'],
                $vendor['ptr_id']
            );
        }

        $paymentCondition = DurationsModel::findIdByOcrLabel($ocrData["payment"]["terms"]);
 
        // 4. Match products
        $lineItems = $this->matchProducts($ocrData['line_items']);

        // 5. Match tax rates
        $lineItems = $this->matchTaxRates($lineItems);

        return [
            'ocr_data' => $ocrData,
            'vendor' => $vendor,
            'duplicate' => $duplicate,
            'line_items' => $lineItems,
            'payment_condition' => $paymentCondition
        ];
    }
}
