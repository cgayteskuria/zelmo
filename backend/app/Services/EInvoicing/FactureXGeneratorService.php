<?php

namespace App\Services\EInvoicing;

use App\Models\CompanyModel;
use App\Models\InvoiceModel;
use App\Models\SaleConfigModel;
use App\Services\Pdf\DocumentPdfService;
use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdProfiles;
use horstoeko\zugferd\codelists\ZugferdInvoiceType;
use horstoeko\zugferd\ZugferdDocumentPdfBuilder;
use Illuminate\Support\Facades\Log;

/**
 * Génère un fichier Facture-X (PDF/A-3 + XML CII EN16931)
 * à partir d'une InvoiceModel existante.
 */
class FactureXGeneratorService
{
    public function __construct(private DocumentPdfService $pdfService) {}

    /**
     * Génère le binaire PDF Facture-X pour une facture.
     * @throws \RuntimeException si les données obligatoires sont manquantes
     */
    public function generateFromInvoice(InvoiceModel $invoice): string
    {
        $this->validateRequiredData($invoice);

        $company = CompanyModel::first();
        $partner = $invoice->partner;

        // 1. Générer le PDF de base via le service existant
        $basePdfBase64 = $this->pdfService->generateInvoicePdf($invoice->inv_id);
        $basePdfBinary = base64_decode($basePdfBase64);

        // 2. Construire le document XML CII
        $doc = $this->buildCiiDocument($invoice, $company, $partner);

        // 3. Embarquer le XML dans le PDF (PDF/A-3)
        return $this->embedXmlInPdf($doc, $basePdfBinary);
    }

    /**
     * Retourne le DTO array attendu par l'API PA (format standard).
     */
    public function buildInvoiceDto(InvoiceModel $invoice): array
    {
        $company = CompanyModel::first();
        $partner = $invoice->partner;
        $lines   = $invoice->lines ?? collect();

        $isCredit = in_array($invoice->inv_operation, [
            InvoiceModel::OPERATION_CUSTOMER_REFUND,
            InvoiceModel::OPERATION_SUPPLIER_REFUND,
        ]);
        $isSupplier = in_array($invoice->inv_operation, [
            InvoiceModel::OPERATION_SUPPLIER_INVOICE,
            InvoiceModel::OPERATION_SUPPLIER_REFUND,
        ]);

        $seller = $isSupplier
            ? $this->buildPartyDto($partner, 'partner')
            : $this->buildPartyDto($company, 'company');

        $buyer = $isSupplier
            ? $this->buildPartyDto($company, 'company')
            : $this->buildPartyDto($partner, 'partner');

        // Agréger les taxes par taux
        $taxDetails = $this->buildTaxDetails($lines, $invoice);

        return [
            'invoiceLang' => 'fr',
            'signInvoice' => false,
            'invoiceData' => [
                'Type'           => $isCredit ? '381' : '380',
                'processType'    => 'B1',
                'invoiceId'      => $invoice->inv_number,
                'invoiceDate'    => $invoice->inv_date,
                'invoiceDueDate' => $invoice->inv_duedate,
                'seller'         => $seller,
                'buyer'          => $buyer,
                'taxDetails'     => $taxDetails,
                'monetary'       => [
                    'invoiceAmount'      => (float) $invoice->inv_totalttc,
                    'taxBasisTotalAmount' => (float) $invoice->inv_totalht,
                    'taxTotalAmount'     => (float) $invoice->inv_totaltax,
                    'payableAmount'      => (float) ($invoice->inv_amount_remaining ?? $invoice->inv_totalttc),
                    'lineTotalAmount'    => (float) $invoice->inv_totalht,
                    'invoiceCurrency'    => 'EUR',
                ],
                'lines' => $this->buildLines($lines),
            ],
        ];
    }

    private function buildPartyDto(mixed $entity, string $type): array
    {
        if ($type === 'company') {
            $siret = $this->sanitizeId($entity->cop_siret ?? $entity->cop_registration_code ?? '');
            $siren = strlen($siret) >= 9 ? substr($siret, 0, 9) : $siret;
            return [
                'name'             => $entity->cop_label,
                'siren'            => $siren,
                'siret'            => $siret,
                'vatNumber'        => $entity->cop_tva_code ?? '',
                'electronicAddress' => $siret,
                'postalAddress'    => [
                    'country'        => $entity->cop_country_code ?? 'FR',
                    'addressLineOne' => $entity->cop_address ?? '',
                    'cityName'       => $entity->cop_city ?? '',
                    'postalCode'     => $entity->cop_zip ?? '',
                ],
            ];
        }

        // Partner — même cascade que buildCiiDocument : SIRET prioritaire,
        $siret    = $this->sanitizeId($entity->ptr_siret ?? '');
        if (strlen($siret) !== 14) {
            $siret =  '';
        }
        $siren   = strlen($siret) === 14 ? substr($siret, 0, 9) : '';
        $country = $entity->ptr_country_code ?? 'FR';

        return [
            'name'             => $entity->ptr_name,
            'siren'            => $siren,
            'siret'            => $siret,
            'vatNumber'        => trim($entity->ptr_vat_number ?? ''),
            'electronicAddress' => $siret ?: $siren,
            'postalAddress'    => [
                'country'        => $country,
                'addressLineOne' => $entity->ptr_address ?? '',
                'cityName'       => $entity->ptr_city ?? '',
                'postalCode'     => $entity->ptr_zip ?? '',
            ],
        ];
    }

    private function buildTaxDetails($lines, InvoiceModel $invoice): array
    {
        // Agréger par taux de TVA
        $byRate = [];
        foreach ($lines as $line) {
            if ($line->inl_type !== 0) continue; // ignorer lignes commentaires
            $rate = (float) ($line->inl_tax_rate ?? 0);
            $key  = (string) $rate;
            if (!isset($byRate[$key])) {
                $byRate[$key] = ['taxableAmount' => 0, 'taxAmount' => 0, 'percent' => $rate];
            }
            $byRate[$key]['taxableAmount'] += (float) $line->inl_mtht;
            $byRate[$key]['taxAmount']     += round((float) $line->inl_mtht * $rate / 100, 3);
        }

        $result = [];
        foreach ($byRate as $detail) {
            $result[] = [
                'taxableAmount' => round($detail['taxableAmount'], 3),
                'taxAmount'     => round($detail['taxAmount'], 3),
                'categoryCode'  => $detail['percent'] == 0 ? 'E' : 'S',
                'percent'       => $detail['percent'],
                'taxType'       => 'VAT',
            ];
        }

        // Si aucune ligne (facture sans lignes chargées), utiliser les totaux
        if (empty($result)) {
            $result[] = [
                'taxableAmount' => (float) $invoice->inv_totalht,
                'taxAmount'     => (float) $invoice->inv_totaltax,
                'categoryCode'  => 'S',
                'percent'       => $invoice->inv_totaltax > 0 ? 20.0 : 0.0,
                'taxType'       => 'VAT',
            ];
        }

        return $result;
    }

    private function buildLines($lines): array
    {
        $result = [];
        $order  = 1;
        foreach ($lines as $line) {
            if ($line->inl_type !== 0) continue;
            $result[] = [
                'id'          => $order++,
                'description' => $line->inl_prtlib ?? '',
                'quantity'    => (float) $line->inl_qty,
                'unitPrice'   => (float) $line->inl_priceunitht,
                'lineTotal'   => (float) $line->inl_mtht,
                'taxPercent'  => (float) ($line->inl_tax_rate ?? 0),
            ];
        }
        return $result;
    }

    /** Supprime tout caractère non numérique d'un identifiant (SIREN, SIRET, etc.) */
    private function sanitizeId(?string $value): string
    {
        return preg_replace('/\D/', '', $value ?? '');
    }

    /**
     * Convertit une valeur date en \DateTime, qu'elle vienne de la DB (string 'Y-m-d')
     * ou d'Eloquent (Carbon, qui implémente DateTimeInterface).
     * Retourne null si la valeur est vide.
     */
    private function toDateTime(mixed $value): ?\DateTime
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return (new \DateTime())->setTimestamp($value->getTimestamp());
        }
        return \DateTime::createFromFormat('Y-m-d', (string) $value) ?: null;
    }

    private function buildCiiDocument(InvoiceModel $invoice, CompanyModel $company, $partner): ZugferdDocumentBuilder
    {
        $isCredit = in_array($invoice->inv_operation, [2, 4]);

        $lines = $invoice->lines ?? collect();

        $doc = ZugferdDocumentBuilder::CreateNew(ZugferdProfiles::PROFILE_EN16931);

        $doc->setDocumentInformation(
            $invoice->inv_number,
            $isCredit ? ZugferdInvoiceType::CREDITNOTE : ZugferdInvoiceType::INVOICE,
            $this->toDateTime($invoice->inv_date) ?? new \DateTime(),
            'EUR'
        );
        $doc->setDocumentBusinessProcess($this->resolveBusinessProcessType($invoice, $lines));

        // Vendeur (société) — strip des espaces sur tous les identifiants
        $sellerSiret  = $this->sanitizeId($company->cop_siret ?? $company->cop_registration_code ?? '');
        $sellerScheme = strlen($sellerSiret) === 14 ? '0009' : '0002';

        // BT-27 — Nom du vendeur (BT-29 laissé vide : identification via BT-30 et BT-34)
        $doc->setDocumentSeller($company->cop_label, null, null);
        $doc->setDocumentSellerAddress(
            $company->cop_address ?? '',
            '',
            '',
            $company->cop_zip ?? '',
            $company->cop_city ?? '',
            $company->cop_country_code ?? 'FR'
        );
        // BT-30 — Organisation légale du vendeur (SIRET ou SIREN selon disponibilité)
        if ($sellerSiret) {
            $doc->setDocumentSellerLegalOrganisation($sellerSiret, $sellerScheme, null);
        }
        // BT-34 — Adresse électronique du vendeur — obligatoire EN16931
        // Même schéma que BT-30 : 0009 si SIRET (14 chiffres), 0002 si SIREN (9 chiffres)
        if ($sellerSiret) {
            $doc->setDocumentSellerCommunication($sellerScheme, $sellerSiret);
        }
        if ($company->cop_tva_code) {
            $doc->addDocumentSellerTaxRegistration('VA', trim($company->cop_tva_code));
        }

        // Acheteur (partenaire)
        // SIRET prioritaire (14 chiffres exacts) ; si absent, utiliser ptr_siren (SIRET ou SIREN)
        $buyerSiret = $this->sanitizeId($partner->ptr_siret ?? '');
        $rawSiren   = $this->sanitizeId($partner->ptr_siren  ?? '');
        if (strlen($buyerSiret) !== 14) {
            $buyerSiret = strlen($rawSiren) === 14 ? $rawSiren : '';
        }
        $buyerSiren  = strlen($buyerSiret) === 14 ? substr($buyerSiret, 0, 9) : ($rawSiren ?: '');
        $buyerMainId = $buyerSiret ?: ($buyerSiren ?: null);
        // Schéma ICD : 0009 = SIRET (14 ch.), 0002 = SIREN (9 ch.)
        $buyerScheme = strlen($buyerSiret) === 14 ? '0009' : '0002';

        // BT-44/BT-46 — Nom et identifiant de l'acheteur
        $doc->setDocumentBuyer($partner->ptr_name, $buyerMainId);
        $doc->setDocumentBuyerAddress(
            $partner->ptr_address ?? '',
            '',
            '',
            $partner->ptr_zip ?? '',
            $partner->ptr_city ?? '',
            $partner->ptr_country_code 
        );
        // BT-47 — Organisation légale (SIRET ou SIREN selon disponibilité)         
        if ($buyerMainId) {          
            $doc->setDocumentBuyerLegalOrganisation($buyerMainId, $buyerScheme, null);
        }
        // BT-49 — Adresse électronique / routage PDP (même schéma que BT-47)
        if ($buyerMainId) {
            $doc->setDocumentBuyerCommunication($buyerScheme, $buyerMainId);
        }
        // BT-48 — Numéro de TVA intracommunautaire
        if ($partner->ptr_vat_number) {
            $doc->addDocumentBuyerTaxRegistration('VA', trim($partner->ptr_vat_number));
        }

        // BT-13 — Référence de commande de l'acheteur (numéro de commande ou référence externe)
        if (!empty($invoice->inv_externalreference)) {
            $doc->setDocumentBuyerOrderReferencedDocument(trim($invoice->inv_externalreference));
        }

        // IncludedNote — mentions légales de paiement (sco_sale_legal_notice)
        $saleConfig = SaleConfigModel::first();
        if ($saleConfig && !empty($saleConfig->sco_sale_legal_notice)) {
            $legalNotice = trim(strip_tags($saleConfig->sco_sale_legal_notice));
            if ($legalNotice !== '') {
                $doc->addDocumentNote($legalNotice, null, 'PMT');
            }
        }

        // BT-72 : date de livraison réelle — évite un élément ApplicableHeaderTradeDelivery vide (PEPPOL-EN16931-R008)
        $doc->setDocumentSupplyChainEvent($this->toDateTime($invoice->inv_date) ?? new \DateTime());

        // BT-9 / BR-CO-25 : date d'échéance (DueDateDateTime) — DuePayableAmount > 0 l'exige
        $dueDate = $this->toDateTime($invoice->inv_duedate);
        if ($dueDate) {
            $doc->addDocumentPaymentTerm('Net', $dueDate);
        } else {
            $doc->addDocumentPaymentTerm('À réception de la facture');
        }

        // Lignes
        $lineNo = 1;
        $taxByRate = [];
        foreach ($lines as $line) {
            if ($line->inl_type !== 0) continue;
            $doc->addNewPosition((string) $lineNo)
                ->setDocumentPositionProductDetails($line->inl_prtlib ?? '')
                ->setDocumentPositionGrossPrice((float) $line->inl_priceunitht)
                ->setDocumentPositionNetPrice((float) $line->inl_priceunitht)
                ->setDocumentPositionQuantity((float) $line->inl_qty, 'C62')
                ->addDocumentPositionTax('S', 'VAT', (float) ($line->inl_tax_rate ?? 0))
                ->setDocumentPositionLineSummation((float) $line->inl_mtht);
            $lineNo++;

            // Agréger pour le résumé TVA document (obligatoire EN16931)
            $rate = (float) ($line->inl_tax_rate ?? 0);
            $key  = (string) $rate;
            $taxByRate[$key] = ($taxByRate[$key] ?? 0) + (float) $line->inl_mtht;
        }

        // Résumé TVA au niveau document
        if (empty($taxByRate)) {
            $rate = (float) $invoice->inv_totaltax > 0 ? 20.0 : 0.0;
            $taxByRate[(string) $rate] = (float) $invoice->inv_totalht;
        }
        foreach ($taxByRate as $rate => $basisAmount) {
            $rate            = (float) $rate;
            $calculatedAmount = round($basisAmount * $rate / 100, 2);
            $categoryCode    = $rate == 0.0 ? 'E' : 'S';
            $doc->addDocumentTax($categoryCode, 'VAT', $basisAmount, $calculatedAmount, $rate);
        }

        // Totaux — BR-CO-16 : DuePayableAmount = GrandTotalAmount − TotalPrepaidAmount
        $totalTtc        = (float) $invoice->inv_totalttc;
        $amountRemaining = (float) ($invoice->inv_amount_remaining ?? $totalTtc);
        $prepaidAmount   = max(0.0, round($totalTtc - $amountRemaining, 2));

        $doc->setDocumentSummation(
            $totalTtc,                                           // BT-112 grandTotalAmount
            $amountRemaining,                                    // BT-115 duePayableAmount
            (float) $invoice->inv_totalht,                       // BT-106 lineTotalAmount
            0.0,                                                 // BT-107 chargeTotalAmount
            0.0,                                                 // BT-108 allowanceTotalAmount
            (float) $invoice->inv_totalht,                       // BT-109 taxBasisTotalAmount
            (float) $invoice->inv_totaltax,                      // BT-110 taxTotalAmount
            null,                                                // BT-114 roundingAmount
            $prepaidAmount > 0.0 ? $prepaidAmount : null         // BT-113 totalPrepaidAmount
        );

        return $doc;
    }

    /**
     * BT-23 : détermine le type de processus métier selon le contenu (biens/services/mixte)
     * et le statut de paiement.
     * Codes : B1-M1 = non acquitté (goods / services / mixte)
     *         B2-M2 = acquitté      (goods / services / mixte)
     */
    private function resolveBusinessProcessType(InvoiceModel $invoice, $lines): string
    {
        $hasGoods   = false;
        $hasService = false;

        foreach ($lines as $line) {
            if ($line->inl_type !== 0) continue;
            $type = $line->inl_prttype ?? null;
            if ($type === 'conso')   $hasGoods   = true;
            if ($type === 'service') $hasService = true;
        }

        $isPaid = (float) ($invoice->inv_amount_remaining ?? $invoice->inv_totalttc) <= 0.0;

        $index = match (true) {
            $hasGoods && $hasService => 2,   // mixte
            $hasService              => 1,   // services
            default                  => 0,   // biens / indéterminé
        };

        // B1=biens non payé, S1=services non payé, M1=mixte non payé
        // B2=biens payé,     S2=services payé,     M2=mixte payé
        $codes = $isPaid ? ['B2', 'S2', 'M2'] : ['B1', 'S1', 'M1'];

        return $codes[$index];
    }

    private function embedXmlInPdf(ZugferdDocumentBuilder $doc, string $basePdfBinary): string
    {
        $pdfBuilder = ZugferdDocumentPdfBuilder::fromPdfString($doc, $basePdfBinary);

        $pdfBuilder->generateDocument();

        return $pdfBuilder->downloadString();
    }

    private function validateRequiredData(InvoiceModel $invoice): void
    {
        if (!$invoice->inv_number) {
            throw new \RuntimeException('La facture doit être validée (numéro requis) avant transmission.');
        }
        if (!$invoice->partner) {
            throw new \RuntimeException('Partenaire introuvable sur la facture.');
        }
        $company = CompanyModel::first();
        if (!$company || !$company->cop_label) {
            throw new \RuntimeException('Les informations de la société ne sont pas configurées.');
        }
    }
}
