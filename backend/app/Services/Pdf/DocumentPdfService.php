<?php

namespace App\Services\Pdf;

use App\Models\SaleOrderModel;
use App\Models\InvoiceModel;
use App\Models\DeliveryNoteModel;
use App\Models\DeliveryNoteLineModel;
use App\Models\CompanyModel;
use App\Models\BankDetailsModel;
use App\Models\ContractConfigModel;
use App\Models\SaleConfigModel;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Service de génération de PDF pour les documents commerciaux
 * Gère la préparation des données et la génération des PDF
 */
class DocumentPdfService
{
    /**
     * Récupère les données de l'entreprise et configuration
     *
     * @return array ['company' => CompanyModel, 'bank' => BankDetailsModel, 'saleConfig' => SaleConfigModel]
     */
    private function getCompanyAndConfig(): array
    {
        $company = CompanyModel::first();

        $bankDetails = BankDetailsModel::where('fk_cop_id', $company->cop_id)
            ->where('bts_is_default', true)
            ->first();

        $saleConfig = SaleConfigModel::first();

        return [
            'company' => $company,
            'bank' => $bankDetails,
            'saleConfig' => $saleConfig
        ];
    }

    /**
     * Formate les données de l'entreprise pour le PDF
     *
     * @param CompanyModel $company
     * @param BankDetailsModel|null $bankDetails
     * @return array
     */
    private function formatCompanyData(CompanyModel $company, ?BankDetailsModel $bankDetails): array
    {
        return [
            "info" => [
                "cop_label" => $company->cop_label ?? '',
                "cop_address" => $company->cop_address ?? '',
                "cop_zip" => $company->cop_zip ?? '',
                "cop_city" => $company->cop_city ?? '',
                "cop_phone" => $company->cop_phone ?? '',
                "cop_legal_status" => $company->cop_legal_status ?? '',
                "cop_capital" => $company->cop_capital ?? '',
                "cop_registration_code" => $company->cop_registration_code ?? '',
                "cop_naf_code" => $company->cop_naf_code ?? '',
                "cop_rcs" => $company->cop_rcs ?? '',
                "cop_tva_code" => $company->cop_tva_code ?? '',
                "logo_printable" => $this->getLogoPrintablePath($company),
            ],
            "bank" => $bankDetails ? [
                "bts_label" => $bankDetails->bts_label ?? '',
                "bts_bank_code" => $bankDetails->bts_bank_code ?? '',
                "bts_sort_code" => $bankDetails->bts_sort_code ?? '',
                "bts_account_nbr" => $bankDetails->bts_account_nbr ?? '',
                "bts_bban_key" => $bankDetails->bts_bban_key ?? '',
                "bts_iban" => $bankDetails->bts_iban ?? '',
                "bts_bic" => $bankDetails->bts_bic ?? '',
            ] : [],
        ];
    }

    /**
     * Génère un PDF pour une commande
     *
     * @param int $orderId ID de la commande
     * @return string PDF en base64
     * @throws \Exception
     */
    public function generateSaleOrderPdf($orderId)
    {
        // Charger les données de la commande
        $saleOrder = SaleOrderModel::with([
            'partner',
            'contact',
            'seller',
            'paymentMode',
            'paymentCondition',
            'commitmentDuration',
            'taxPosition',
            'lines.product',
            'lines.tax',
            'author'
        ])->findOrFail($orderId);

        // Préparer les données du document
        $documentData = $this->prepareSaleOrderData($saleOrder);

        // Générer le PDF
        return $this->generatePdf($documentData);
    }

    /**
     * Prépare les données d'une commande pour la génération PDF
     *
     * @param SaleOrderModel $saleOrder
     * @return array
     */
    private function prepareSaleOrderData(SaleOrderModel $saleOrder)
    {
        // Récupérer données entreprise et config (méthode factorisée)
        $companyData = $this->getCompanyAndConfig();

        // Déterminer le type et le label du document
        $documentType = $saleOrder->ord_status <= 2 ? 'salequotation' : 'saleorder';
        $documentTypeLabel = $saleOrder->ord_status <= 2 ? 'Devis' : 'Commande';

        // Informations du partenaire
        $partner = $saleOrder->partner;
        //$contact = $saleOrder->contact;

        // Créateur du document
        $creator = Auth::user() ? Auth::user()->usr_firstname . ' ' . Auth::user()->usr_lastname : 'System';

        $data = [
            "document" => [
                "type" => $documentType,
                "typeLabel" => $documentTypeLabel,
                "creator" => $creator,
                "header" => [
                    "number" => $saleOrder->ord_number,
                    "date" => $saleOrder->ord_date ? $saleOrder->ord_date->format('Y-m-d') : date('Y-m-d'),
                    "valid" => $saleOrder->ord_valid ? $saleOrder->ord_valid->format('Y-m-d') : null,
                    "ptr_name" => $partner ? $partner->ptr_name : '',
                    "ptr_address" => $partner ? $partner->ptr_address : '',
                    "ptr_zip" => $partner ? $partner->ptr_zip : '',
                    "ptr_city" => $partner ? $partner->ptr_city : '',
                    "ptr_fulladdress" => $this->formatPartnerAddress($partner),
                    "payment_mode" => $saleOrder->paymentMode ? $saleOrder->paymentMode->pmc_label : '',
                    "payment_condition" => $saleOrder->paymentCondition ? $saleOrder->paymentCondition->dur_label : '',
                    "ref" => $saleOrder->ord_ref ?? '',
                    "commitment" => $saleOrder->commitmentDuration ? $saleOrder->commitmentDuration->dur_label : '',
                    "totalht" => (float)$saleOrder->ord_totalht,
                    "totalhtsub" => (float)$saleOrder->ord_totalhtsub,
                    "totalhtcomm" => (float)$saleOrder->ord_totalhtcomm,
                    "totaltax" => (float)$saleOrder->ord_totaltax,
                    "totalttc" => (float)$saleOrder->ord_totalttc,
                    "amount_remaining" => 0, // À adapter si besoin
                    "validation_data" => null, // À adapter si besoin
                ],
                "lines" => $this->formatSaleOrderLines($saleOrder->lines()->with('tax')->get()),
                "payment" => [], // Historique des paiements si nécessaire
            ],
            "company" => $this->formatCompanyData($companyData['company'], $companyData['bank']),
            "sale" => [
                "conf" => [
                    "sco_sale_legal_notice" => $companyData['saleConfig']->sco_sale_legal_notice ?? '',
                ],
            ],
        ];

        return $data;
    }

    /**
     * Formate les lignes de commande pour le PDF
     *
     * @param \Illuminate\Database\Eloquent\Collection $lines
     * @return array
     */
    private function formatSaleOrderLines($lines)
    {
        $formattedLines = [];

        foreach ($lines as $line) {
            $type = $line->orl_type ?? 0;

            $formattedLines[] = [
                "type" => $type,
                "prtlib" => $line->orl_prtlib ?? '',
                "prtdesc" => $line->orl_prtdesc ??  '',
                "qty" => $line->orl_qty ?? 0,
                "priceunitht" => (float)($line->orl_priceunitht ?? 0),
                "discount" => (float)($line->orl_discount ?? 0),
                "tax" => (float)($line->orl_tax_rate ?? 0),
                "mtht" => (float)($line->orl_mtht ?? 0),
            ];
        }

        return $formattedLines;
    }

    /**
     * Formate l'adresse complète du partenaire
     *
     * @param mixed $partner
     * @return string
     */
    private function formatPartnerAddress($partner)
    {
        if (!$partner) {
            return '';
        }

        $address = [];

        if (!empty($partner->ptr_address)) {
            $address[] = $partner->ptr_address;
        }

        if (!empty($partner->ptr_zip) || !empty($partner->ptr_city)) {
            $address[] = trim(($partner->ptr_zip ?? '') . ' ' . ($partner->ptr_city ?? ''));
        }

        return implode(chr(10), $address);
    }

    /**
     * Récupère le chemin du logo imprimable
     *
     * @param CompanyModel $company
     * @return string|null
     */
    private function getLogoPrintablePath($company)
    {
        if (!$company || !$company->logoPrintable) {
            return null;
        }

        $logo = $company->logoPrintable;
        $relativePath = $logo->doc_filepath . '/' . $logo->doc_securefilename;

        // Vérifier sur le disque privé
        if (Storage::disk('private')->exists($relativePath)) {
            return Storage::disk('private')->path($relativePath);
        }

        // Vérifier sur le disque public (ancien emplacement)
        if (Storage::disk('public')->exists($relativePath)) {
            return Storage::disk('public')->path($relativePath);
        }

        return null;
    }

    /**
     * Génère le PDF à partir des données préparées
     *
     * @param array $documentData
     * @return string PDF en base64
     * @throws \Exception
     */
    private function generatePdf($documentData)
    {
        try {
            // Créer l'instance du PDF
            $pdf = new BusinessDocumentPDF($documentData);

            // Générer le PDF en string
            $pdfContent = $pdf->Output('document.pdf', 'S');

            // Encoder en base64
            return base64_encode($pdfContent);
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la génération du PDF : " . $e->getMessage());
        }
    }

    /**
     * Génère et sauvegarde un PDF sur le disque
     *
     * @param int $orderId
     * @param string $filename
     * @return string Chemin du fichier sauvegardé
     */
    public function generateAndSaveSaleOrderPdf($orderId, $filename = null)
    {
        $saleOrder = SaleOrderModel::findOrFail($orderId);

        if (!$filename) {
            $filename = 'order_' . $saleOrder->ord_number . '_' . date('Ymd_His') . '.pdf';
        }

        $documentData = $this->prepareSaleOrderData($saleOrder);
        $pdf = new BusinessDocumentPDF($documentData);

        // Créer le dossier si nécessaire
        $storagePath = 'pdfs/saleorders/' . $saleOrder->ord_id;
        Storage::disk('private')->makeDirectory($storagePath);

        // Sauvegarder le fichier
        $fullPath = $storagePath . '/' . $filename;
        Storage::disk('private')->put($fullPath, $pdf->Output('', 'S'));

        return $fullPath;
    }

    /**
     * Génère un PDF pour une facture
     *
     * @param int $invoiceId ID de la facture
     * @return string PDF en base64
     * @throws \Exception
     */
    public function generateInvoicePdf($invoiceId)
    {
  
        // Charger les données de la facture avec toutes les relations
        $invoice = InvoiceModel::with([
            'partner',
            'contact',
            'paymentMode',
            'paymentCondition',
            'taxPosition',
            'lines.product',
            'lines.tax',
            'author'
        ])->findOrFail($invoiceId);
      
        // Préparer les données du document
        $documentData = $this->prepareInvoiceData($invoice);

        // Générer le PDF
        return $this->generatePdf($documentData);
    }

    /**
     * Prépare les données d'une facture pour la génération PDF
     *
     * @param InvoiceModel $invoice
     * @return array
     */
    private function prepareInvoiceData(InvoiceModel $invoice)
    {
        // Récupérer données entreprise et config (méthode factorisée)
        $companyData = $this->getCompanyAndConfig();

        // Déterminer le type et le label du document
        list($documentType, $documentTypeLabel) = $this->getInvoiceTypeAndLabel($invoice->inv_operation);

        // Informations du partenaire
        $partner = $invoice->partner;

        // Créateur du document
        $creator = Auth::user() ? Auth::user()->usr_firstname . ' ' . Auth::user()->usr_lastname : 'System';

        // Récupérer l'historique des paiements
        $payments = $this->fetchInvoicePayments($invoice->inv_id);

        $data = [
            "document" => [
                "type" => $documentType,
                "typeLabel" => $documentTypeLabel,
                "creator" => $creator,
                "header" => [
                    "number" => $invoice->inv_number,
                    "date" => $invoice->inv_date ? $invoice->inv_date->format('Y-m-d') : date('Y-m-d'),
                    "duedate" => $invoice->inv_duedate ? $invoice->inv_duedate->format('Y-m-d') : null,
                    "valid" => null,  // N/A pour Invoice
                    "ptr_name" => $partner ? $partner->ptr_name : '',
                    "ptr_address" => $partner ? $partner->ptr_address : '',
                    "ptr_zip" => $partner ? $partner->ptr_zip : '',
                    "ptr_city" => $partner ? $partner->ptr_city : '',
                    "ptr_fulladdress" => $this->formatPartnerAddress($partner),
                    "payment_mode" => $invoice->paymentMode ? $invoice->paymentMode->pam_label : '',
                    "payment_condition" => $invoice->paymentCondition ? $invoice->paymentCondition->dur_label : '',
                    "ref" => $invoice->inv_externalreference ?? '',
                    "commitment" => null,  // N/A pour Invoice
                    "totalht" => (float)$invoice->inv_totalht,
                    "totalhtsub" => 0,  // N/A pour Invoice standard
                    "totalhtcomm" => 0,  // N/A pour Invoice standard
                    "totaltax" => (float)$invoice->inv_totaltax,
                    "totalttc" => (float)$invoice->inv_totalttc,
                    "amount_remaining" => (float)$invoice->inv_amount_remaining,
                    "validation_data" => null,
                ],
                "lines" => $this->formatInvoiceLines($invoice->lines()->with('tax')->get()),
                "payment" => $this->formatPaymentHistory($payments),
            ],
            "company" => $this->formatCompanyData($companyData['company'], $companyData['bank']),
            "sale" => [
                "conf" => [
                    "sco_sale_legal_notice" => $companyData['saleConfig']->sco_sale_legal_notice ?? '',
                ],
            ],
        ];

        return $data;
    }

    /**
     * Détermine le type et le label du document selon inv_operation
     *
     * @param int $invOperation
     * @return array [type, label]
     */
    private function getInvoiceTypeAndLabel($invOperation): array
    {
        $mapping = [
            InvoiceModel::OPERATION_CUSTOMER_INVOICE => ['custinvoice', 'Facture client'],
            InvoiceModel::OPERATION_CUSTOMER_REFUND => ['custrefund', 'Avoir client'],
            InvoiceModel::OPERATION_SUPPLIER_INVOICE => ['supplierinvoice', 'Facture fournisseur'],
            InvoiceModel::OPERATION_SUPPLIER_REFUND => ['supplierrefund', 'Avoir fournisseur'],
            InvoiceModel::OPERATION_CUSTOMER_DEPOSIT => ['custdeposit', 'Acompte client'],
            InvoiceModel::OPERATION_SUPPLIER_DEPOSIT => ['supplierdeposit', 'Acompte fournisseur'],
        ];

        return $mapping[$invOperation] ?? ['invoice', 'Facture'];
    }

    /**
     * Formate les lignes de facture pour le PDF
     *
     * @param \Illuminate\Database\Eloquent\Collection $lines
     * @return array
     */
    private function formatInvoiceLines($lines)
    {
        $formattedLines = [];

        foreach ($lines as $line) {
            $type = $line->inl_type ?? 0;

            $formattedLines[] = [
                "type" => $type,
                "prtlib" => $line->inl_prtlib ?? '',
                "prtdesc" => $line->inl_prtdesc ?? '',
                "qty" => $line->inl_qty ?? 0,
                "priceunitht" => (float)($line->inl_priceunitht ?? 0),
                "discount" => (float)($line->inl_discount ?? 0),
                "tax" => (float)($line->inl_tax_rate ?? 0),
                "mtht" => (float)($line->inl_mtht ?? 0),
            ];
        }

        return $formattedLines;
    }

    /**
     * Récupère l'historique des paiements d'une facture
     *
     * @param int $invId
     * @return \Illuminate\Support\Collection
     */
    private function fetchInvoicePayments($invId)
    {
        return DB::table('payment_pay as pay')
            ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
            ->leftJoin('payment_mode_pam as pam', 'pay.fk_pam_id', '=', 'pam.pam_id')
            ->leftJoin('invoice_inv as deposit_inv', 'pay.fk_inv_id_deposit', '=', 'deposit_inv.inv_id')
            ->leftJoin('invoice_inv as refund_inv', 'pay.fk_inv_id_refund', '=', 'refund_inv.inv_id')
            ->where('pal.fk_inv_id', $invId)
            ->select([
                'pay.pay_date',
                'pal.pal_amount',
                DB::raw("
                    CASE
                        WHEN pay.fk_inv_id_deposit IS NOT NULL THEN CONCAT('Acompte n° ', deposit_inv.inv_number)
                        WHEN pay.fk_inv_id_refund IS NOT NULL THEN CONCAT('Avoir n° ', refund_inv.inv_number)
                        ELSE pam.pam_label
                    END AS payment_mode
                "),
            ])
            ->orderBy('pay.pay_date', 'DESC')
            ->get();
    }

    /**
     * Formate l'historique des paiements pour le PDF
     *
     * @param \Illuminate\Support\Collection $payments
     * @return array
     */
    private function formatPaymentHistory($payments)
    {
        $formatted = [];

        foreach ($payments as $payment) {
            $formatted[] = [
                'date' => $payment->pay_date,
                'amount' => (float)$payment->pal_amount,
                'mode' => $payment->payment_mode ?? ''
            ];
        }

        return $formatted;
    }

    /**
     * Génère un PDF pour un bon de livraison/réception
     *
     * @param int $dlnId ID du bon
     * @return string PDF en base64
     * @throws \Exception
     */
    public function generateDeliveryNotePdf($dlnId)
    {
        $deliveryNote = DeliveryNoteModel::with(['partner'])->findOrFail($dlnId);

        $lines = DeliveryNoteLineModel::from('delivery_note_line_dnl as dnl')
            ->leftJoin('product_prt as prt', 'dnl.fk_prt_id', '=', 'prt.prt_id')
            ->leftJoin('sale_order_line_orl as orl', 'dnl.fk_orl_id', '=', 'orl.orl_id')
            ->leftJoin('purchase_order_line_pol as pol', 'dnl.fk_pol_id', '=', 'pol.pol_id')
            ->where('dnl.fk_dln_id', $dlnId)
            ->where('dnl.dnl_type', 0)
            ->orderBy('dnl.dnl_order')
            ->select(['dnl.*', 'prt.prt_type', 'orl.orl_qty', 'pol.pol_qty'])
            ->get();

        $documentData = $this->prepareDeliveryNoteData($deliveryNote, $lines);

        return $this->generatePdf($documentData);
    }

    /**
     * Prépare les données d'un bon de livraison/réception pour le PDF
     */
    private function prepareDeliveryNoteData(DeliveryNoteModel $deliveryNote, $lines)
    {
        $companyData = $this->getCompanyAndConfig();

        $isCustomer = $deliveryNote->dln_operation == DeliveryNoteModel::OPERATION_CUSTOMER_DELIVERY;
        $documentType = $isCustomer ? 'custdeliverynote' : 'supplierdeliverynote';
        $documentTypeLabel = $isCustomer ? 'Bon de livraison' : 'Bon de réception';

        $partner = $deliveryNote->partner;
        $creator = Auth::user() ? Auth::user()->usr_firstname . ' ' . Auth::user()->usr_lastname : 'System';

        $formattedLines = [];
        foreach ($lines as $line) {
            $qtyDelivered = $line->dnl_qty ?? 0;
            $qtyOrdered = $isCustomer
                ? ($line->orl_qty ?? $qtyDelivered)
                : ($line->pol_qty ?? $qtyDelivered);
            $qtyRemaining = $qtyOrdered - $qtyDelivered;

            $formattedLines[] = [
                "type" => $line->dnl_type ?? 0,
                "prtlib" => $line->dnl_prtlib ?? '',
                "prtdesc" => $line->dnl_prtdesc ?? '',
                "qty" => $qtyDelivered,
                "qty_ordered" => $qtyOrdered,
                "qty_remaining" => $qtyRemaining > 0 ? $qtyRemaining : 0,
                "priceunitht" => 0,
                "discount" => 0,
                "tax" => 0,
                "mtht" => 0,
                "lot_number" => $line->dnl_lot_number ?? '',
                "serial_number" => $line->dnl_serial_number ?? '',
            ];
        }

        return [
            "document" => [
                "type" => $documentType,
                "typeLabel" => $documentTypeLabel,
                "creator" => $creator,
                "header" => [
                    "number" => $deliveryNote->dln_number,
                    "date" => $deliveryNote->dln_date ? (is_string($deliveryNote->dln_date) ? $deliveryNote->dln_date : $deliveryNote->dln_date->format('Y-m-d')) : date('Y-m-d'),
                    "valid" => null,
                    "ptr_name" => $partner ? $partner->ptr_name : '',
                    "ptr_address" => $partner ? $partner->ptr_address : '',
                    "ptr_zip" => $partner ? $partner->ptr_zip : '',
                    "ptr_city" => $partner ? $partner->ptr_city : '',
                    "ptr_fulladdress" => $this->formatPartnerAddress($partner),
                    "payment_mode" => '',
                    "payment_condition" => '',
                    "ref" => $deliveryNote->dln_externalreference ?? '',
                    "commitment" => '',
                    "totalht" => 0,
                    "totalhtsub" => 0,
                    "totalhtcomm" => 0,
                    "totaltax" => 0,
                    "totalttc" => 0,
                    "amount_remaining" => 0,
                    "validation_data" => null,
                ],
                "lines" => $formattedLines,
                "payment" => [],
            ],
            "company" => $this->formatCompanyData($companyData['company'], $companyData['bank']),
            "sale" => [
                "conf" => [
                    "sco_sale_legal_notice" => $companyData['saleConfig']->sco_sale_legal_notice ?? '',
                ],
            ],
        ];
    }
}
