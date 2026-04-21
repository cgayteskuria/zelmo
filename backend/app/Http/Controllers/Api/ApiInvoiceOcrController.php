<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\VeryfiService;
use App\Services\InvoiceService;
use App\Services\DocumentService;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\AccountTaxModel;
use App\Models\PurchaseOrderConfigModel;
use App\Models\PartnerModel;

class ApiInvoiceOcrController extends Controller
{
    private VeryfiService $veryfiService;
    private InvoiceService $invoiceService;
    private DocumentService $documentService;

    public function __construct(
        VeryfiService $veryfiService,
        InvoiceService $invoiceService,
        DocumentService $documentService
    ) {
        $this->veryfiService = $veryfiService;
        $this->invoiceService = $invoiceService;
        $this->documentService = $documentService;
    }

    /**
     * Upload PDF and process through OCR
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadAndProcess(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240' // Max 10MB
        ]);

        try {
            $file = $request->file('file');

            // Store temporarily
            $tempPath = $file->store('tmp/ocr', 'private');
            $fullPath = Storage::disk('private')->path($tempPath);

            $processedData = $this->veryfiService->processInvoiceImport($fullPath);

            // Generate preview token
            $token = Str::uuid()->toString();

            // Get default product from purchase order config
            $defaultProductConfig = PurchaseOrderConfigModel::with([
                'defaultProduct' => function ($query) {
                    // On sélectionne les colonnes du PRODUIT
                    $query->select('prt_id', 'prt_label', 'fk_tax_id_purchase', 'prt_desc');
                },
                'defaultProduct.taxPurchase' => function ($query) {
                    // On sélectionne les colonnes de la TAXE (dont le taux)
                    $query->select('tax_id', 'tax_rate', 'tax_label');
                }
            ])->select(['fk_prt_id_default'])->find(1);


            // Cache the data with the PDF path (1 hour expiration)
            Cache::put("ocr_preview_{$token}", [
                'file_path' => $tempPath,
                'original_name' => $file->getClientOriginalName(),
                'ocr_data' => $processedData['ocr_data'],
                'vendor' => $processedData['vendor'],
                'duplicate' => $processedData['duplicate'],
                'line_items' => $processedData['line_items']
            ], now()->addHours(1));

            return response()->json([
                'success' => true,
                'data' => [
                    'token' => $token,
                    'vendor' => $processedData['vendor'],
                    'ocr_data' => $processedData['ocr_data'],
                    'duplicate' => $processedData['duplicate'],
                    'line_items' => $processedData['line_items'],
                    'payment_condition' => $processedData['payment_condition'],
                    'default_product' => $defaultProductConfig->defaultProduct
                ]
            ]);
        } catch (\Exception $e) {
            // Clean up temp file on error
            if (isset($tempPath)) {
                Storage::disk('private')->delete($tempPath);
            }

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get PDF preview as base64
     *
     * @param string $token Preview token
     * @return JsonResponse
     */
    public function getPreview(string $token): JsonResponse
    {
        $data = Cache::get("ocr_preview_{$token}");

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Session expirée ou invalide. Veuillez réimporter le document.'
            ], 404);
        }

        try {
            // Generate base64 PDF for preview
            $pdfContent = Storage::disk('private')->get($data['file_path']);
            $base64Pdf = base64_encode($pdfContent);

            return response()->json([
                'success' => true,
                'data' => [
                    'pdf' => $base64Pdf,
                    'filename' => $data['original_name']
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération du PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Confirm and create invoice from validated data
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function confirmImport(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'fk_ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
            'inv_date' => 'required|date',
            'inv_duedate' => 'nullable|date',
            'inv_externalreference' => 'nullable|string|max:100',
            'fk_pam_id' => 'nullable|integer',
            'fk_dur_id_payment_condition' => 'nullable|integer',
            'inv_note' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.fk_prt_id' => 'nullable|integer',
            'lines.*.fk_tax_id' => 'required|integer|exists:account_tax_tax,tax_id',
            'lines.*.inl_prtlib' => 'required|string|max:255',
            'lines.*.inl_prtdesc' => 'nullable|string',
            'lines.*.inl_qty' => 'required|numeric|min:0',
            'lines.*.inl_priceunitht' => 'required|numeric',
        ]);

        try {
            $cachedData = Cache::get("ocr_preview_{$request->token}");

            if (!$cachedData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Session expirée. Veuillez réimporter le document.'
                ], 400);
            }

            $userId = $request->user()->usr_id;

            DB::beginTransaction();

            // Create invoice
            $invoiceData = [
                'inv_date' => $request->inv_date,
                'inv_duedate' => $request->inv_duedate,
                'inv_operation' => InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                'fk_ptr_id' => $request->fk_ptr_id,
                'inv_externalreference' => $request->inv_externalreference,
                'fk_pam_id' => $request->fk_pam_id,
                'fk_dur_id_payment_condition' => $request->fk_dur_id_payment_condition,
                'inv_note' => $request->inv_note,
                'inv_status' => InvoiceModel::STATUS_DRAFT,
            ];

            $invoice = $this->invoiceService->createInvoice($invoiceData, $userId);

            // Create lines
            $order = 1;
            foreach ($request->lines as $lineData) {
                // Get tax rate from tax
                $tax = AccountTaxModel::find($lineData['fk_tax_id']);
                $taxRate = $tax ? $tax->tax_rate : 20;

                $line = new InvoiceLineModel([
                    'fk_inv_id' => $invoice->inv_id,
                    'inl_order' => $order++,
                    'inl_type' => 0, // Normal line
                    'fk_prt_id' => $lineData['fk_prt_id'] ?? null,
                    'fk_tax_id' => $lineData['fk_tax_id'],
                    'inl_prtlib' => $lineData['inl_prtlib'],
                    'inl_prtdesc' => $lineData['inl_prtdesc'] ?? null,
                    'inl_qty' => $lineData['inl_qty'],
                    'inl_priceunitht' => $lineData['inl_priceunitht'],
                    'inl_discount' => 0,
                    'inl_tax_rate' => $taxRate,
                    'fk_usr_id_author' => $userId,
                    'fk_usr_id_updater' => $userId,
                ]);
                $line->save();
            }

            // Recalculate totals
            $invoice->recalculateTotals();

            // Store the PDF as a document attached to the invoice
            $pdfContent = Storage::disk('private')->get($cachedData['file_path']);
            $this->documentService->storeFileFromContent(
                $pdfContent,
                $cachedData['original_name'],
                'application/pdf',
                'invoices',
                $invoice->inv_id,
                $userId
            );

            DB::commit();

            // Clean up
            Storage::disk('private')->delete($cachedData['file_path']);
            Cache::forget("ocr_preview_{$request->token}");

            return response()->json([
                'success' => true,
                'message' => 'Facture créée avec succès',
                'data' => [
                    'inv_id' => $invoice->inv_id,
                    'inv_number' => $invoice->inv_number
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création de la facture: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a quick supplier partner from OCR vendor name
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function createQuickSupplier(Request $request): JsonResponse
    {
        $request->validate([
            'ptr_name' => 'required|string|max:255'
        ]);

        try {
            $userId = $request->user()->usr_id;

            $partner = PartnerModel::create([
                'ptr_name' => $request->ptr_name,
                'ptr_is_supplier' => 1,
                'ptr_is_customer' => 0,
                'ptr_is_active' => 1,
                'fk_usr_id_author' => $userId,
                'fk_usr_id_updater' => $userId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Fournisseur créé avec succès',
                'data' => [
                    'ptr_id' => $partner->ptr_id,
                    'ptr_name' => $partner->ptr_name
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création du fournisseur: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel an import session and clean up
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function cancelImport(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string'
        ]);

        try {
            $cachedData = Cache::get("ocr_preview_{$request->token}");

            if ($cachedData) {
                // Delete temp file
                Storage::disk('private')->delete($cachedData['file_path']);
                // Clear cache
                Cache::forget("ocr_preview_{$request->token}");
            }

            return response()->json([
                'success' => true,
                'message' => 'Import annulé'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de l\'annulation: ' . $e->getMessage()
            ], 500);
        }
    }
}
