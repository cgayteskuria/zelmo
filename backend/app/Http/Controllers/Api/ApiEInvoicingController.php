<?php

namespace App\Http\Controllers\Api;

use App\Models\EInvoicingConfigModel;
use App\Models\EInvoicingEReportingModel;
use App\Models\EInvoicingReceivedModel;
use App\Models\EInvoicingTransmissionModel;
use App\Services\EInvoicing\EInvoicingService;
use App\Services\EInvoicing\PdpClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ApiEInvoicingController extends Controller
{
    public function __construct(private EInvoicingService $service)
    {
    }

    // -----------------------------------------------------------------------
    // Paramètres
    // -----------------------------------------------------------------------

    public function getSettings(): JsonResponse
    {
        $config   = $this->service->getConfig();
        $data     = $config->toArray();

        // eic_client_secret, eic_webhook_secret, eic_oauth_token sont dans $hidden → absents de toArray()
        // On les réinjecte masqués si une valeur existe (pour que le frontend sache qu'ils sont renseignés)
        if (!empty($config->eic_client_secret)) {
            $data['eic_client_secret'] = '***';
        }
        if (!empty($config->eic_webhook_secret)) {
            $data['eic_webhook_secret'] = '***';
        }

        $data['available_profiles'] = array_map(
            fn($k, $v) => ['key' => $k, 'label' => $v['label']],
            array_keys(EInvoicingConfigModel::$PROFILES),
            EInvoicingConfigModel::$PROFILES
        );

        return response()->json(['status' => true, 'data' => $data]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'eic_pdp_profile'          => 'nullable|string|max:50',
            'eic_api_url'              => 'nullable|url|max:255',
            'eic_token_url'            => 'nullable|url|max:255',
            'eic_client_id'            => 'nullable|string|max:255',
            'eic_client_secret'        => 'nullable|string',
            'eic_customer_id'          => 'nullable|string|max:100',
            'eic_webhook_secret'       => 'nullable|string|max:255',
            'eic_auto_transmit'        => 'nullable|boolean',
            'eic_validate_before_send' => 'nullable|boolean',
            'eic_facturex_profile'     => 'nullable|string|in:MINIMUM,BASIC,EN16931,EXTENDED',
        ]);

        $config = $this->service->saveConfig($validated, $request->user()->usr_id);

        return response()->json([
            'message' => 'Configuration sauvegardée.',
            'data'    => $config,
        ]);
    }

    public function testConnection(): JsonResponse
    {
        try {
            $message = $this->service->testConnection();
            return response()->json(['status' => true, 'message' => $message]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function registerEntity(Request $request): JsonResponse
    {
        try {
            $result = $this->service->registerBusinessEntity($request->user()->usr_id);
            return response()->json(['status' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            Log::error('EInvoicing registerEntity', ['error' => $e->getMessage()]);
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function searchDirectory(Request $request): JsonResponse
    {
        $query  = $request->query('q', '');
        $results = $this->service->searchDirectory($query);
        return response()->json(['status' => true, 'data' => $results]);
    }

    // -----------------------------------------------------------------------
    // Transmission (émission)
    // -----------------------------------------------------------------------

    public function transmitInvoice(Request $request, int $invId): JsonResponse
    {
        try {
            $transmission = $this->service->transmitInvoice($invId, $request->user()->usr_id);
            return response()->json([
                'status'  => true,
                'message' => 'Facture transmise au PA avec succès.',
                'data'    => [
                    'eit_id'            => $transmission->eit_id,
                    'eit_status'        => $transmission->eit_status,
                    'eit_status_label'  => EInvoicingTransmissionModel::getStatusLabel($transmission->eit_status),
                    'eit_status_color'  => EInvoicingTransmissionModel::getStatusColor($transmission->eit_status),
                    'eit_transmitted_at'=> $transmission->eit_transmitted_at,
                    'eit_pa_invoice_id' => $transmission->eit_pa_invoice_id,
                    'eit_error_message' => $transmission->eit_error_message,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('EInvoicing transmitInvoice', ['inv_id' => $invId, 'error' => $e->getMessage()]);
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function getTransmissionStatus(int $invId): JsonResponse
    {
        $transmission = $this->service->getTransmission($invId);

        return response()->json([
            'status' => true,
            'data'   => $transmission ? [
                'eit_id'              => $transmission->eit_id,
                'eit_status'          => $transmission->eit_status,
                'eit_status_label'    => EInvoicingTransmissionModel::getStatusLabel($transmission->eit_status),
                'eit_status_color'    => EInvoicingTransmissionModel::getStatusColor($transmission->eit_status),
                'eit_transmitted_at'  => $transmission->eit_transmitted_at,
                'eit_last_event_at'   => $transmission->eit_last_event_at,
                'eit_pa_invoice_id'   => $transmission->eit_pa_invoice_id,
                'eit_error_message'   => $transmission->eit_error_message,
            ] : null,
        ]);
    }

    public function downloadFactureX(int $invId): Response|JsonResponse
    {
        $binary = $this->service->downloadFactureX($invId);
        if (!$binary) {
            return response()->json(['status' => false, 'message' => 'Fichier Facture-X introuvable.'], 404);
        }

        return response($binary, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="facture-x-' . $invId . '.pdf"',
        ]);
    }

    // -----------------------------------------------------------------------
    // Réception
    // -----------------------------------------------------------------------

    public function listReceived(Request $request): JsonResponse
    {
        $query = EInvoicingReceivedModel::query();

        if ($request->query('status')) {
            $query->where('eir_our_status', $request->query('status'));
        }
        if ($request->query('imported') === '0') {
            $query->whereNull('eir_imported_at');
        }
        if ($request->query('imported') === '1') {
            $query->whereNotNull('eir_imported_at');
        }

        $data = $query->orderBy('eir_created', 'desc')
            ->paginate($request->query('page_size', 25));

        return response()->json(['status' => true, 'data' => $data]);
    }

    public function getReceived(int $id): JsonResponse
    {
        $received = EInvoicingReceivedModel::with('importedInvoice')->findOrFail($id);
        return response()->json(['status' => true, 'data' => $received]);
    }

    public function updateReceivedStatus(Request $request, int $id): JsonResponse
    {
        $request->validate(['status' => 'required|string|in:ACCEPTEE,REFUSEE,EN_PAIEMENT,PAYEE']);

        try {
            $this->service->updateReceivedStatus($id, $request->status, $request->user()->usr_id);
            return response()->json(['status' => true, 'message' => 'Statut mis à jour.']);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function importReceived(Request $request, int $id): JsonResponse
    {
        try {
            $invoice = $this->service->importReceivedInvoice($id, $request->user()->usr_id);
            return response()->json([
                'status'  => true,
                'message' => 'Facture importée en brouillon.',
                'data'    => ['inv_id' => $invoice->inv_id],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function countPendingReceived(): JsonResponse
    {
        $count = EInvoicingReceivedModel::where('eir_our_status', EInvoicingReceivedModel::STATUS_PENDING)
            ->whereNull('eir_imported_at')
            ->count();
        return response()->json(['status' => true, 'data' => ['count' => $count]]);
    }

    // -----------------------------------------------------------------------
    // E-reporting
    // -----------------------------------------------------------------------

    public function listEReporting(): JsonResponse
    {
        $data = EInvoicingEReportingModel::orderBy('eer_period', 'desc')->get();
        return response()->json(['status' => true, 'data' => $data]);
    }

    public function buildEReporting(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => 'required|string|regex:/^\d{4}-\d{2}$/',
            'type'   => 'required|string|in:B2C,B2B_INTL',
        ]);

        $reporting = $this->service->buildEReportingForPeriod($validated['period'], $validated['type']);
        return response()->json(['status' => true, 'data' => $reporting]);
    }

    public function transmitEReporting(Request $request): JsonResponse
    {
        $validated = $request->validate(['eer_id' => 'required|integer|exists:einvoicing_ereporting_eer,eer_id']);

        try {
            $result = $this->service->transmitEReporting($validated['eer_id'], $request->user()->usr_id);
            return response()->json(['status' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }
}
