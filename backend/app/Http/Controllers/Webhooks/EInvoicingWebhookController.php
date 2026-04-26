<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessEInvoicingWebhookJob;
use App\Models\EInvoicingConfigModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Reçoit les callbacks du PA/PPF.
 * Routes publiques (pas d'auth Sanctum) — sécurisées par HMAC webhook secret.
 */
class EInvoicingWebhookController extends Controller
{
    /**
     * Cycle de vie d'une facture (émise ou reçue).
     * POST /webhooks/einvoicing/facture/cycledevie/{invoiceId}
     */
    public function handleLifecycleEvent(Request $request, string $invoiceId): JsonResponse
    {
        if (!$this->verifySignature($request)) {
            Log::warning('EInvoicing webhook: signature invalide', ['invoice_id' => $invoiceId]);
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $payload = $request->all();
        Log::info('EInvoicing webhook lifecycle', ['invoice_id' => $invoiceId, 'status' => $payload['status'] ?? null]);

        ProcessEInvoicingWebhookJob::dispatch('lifecycle', $invoiceId, $payload)->onQueue('default');

        return response()->json(['status' => 'accepted'], 202);
    }

    /**
     * Données de facturation depuis le PPF.
     * POST /webhooks/einvoicing/donneesfacturation/{invoiceId}
     */
    public function handleBillingData(Request $request, string $invoiceId): JsonResponse
    {
        if (!$this->verifySignature($request)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        ProcessEInvoicingWebhookJob::dispatch('billing_data', $invoiceId, $request->all())->onQueue('default');

        return response()->json(['status' => 'accepted'], 202);
    }

    /**
     * Déclaration e-reporting depuis le PPF.
     * POST /webhooks/einvoicing/declaration
     */
    public function handleDeclaration(Request $request): JsonResponse
    {
        if (!$this->verifySignature($request)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        ProcessEInvoicingWebhookJob::dispatch('declaration', null, $request->all())->onQueue('default');

        return response()->json(['status' => 'accepted'], 202);
    }

    /**
     * Vérifie la signature HMAC du webhook entrant.
     * Le PA envoie un header X-Webhook-Signature ou X-Hub-Signature.
     */
    private function verifySignature(Request $request): bool
    {
        $config = EInvoicingConfigModel::first();

        // Si pas de secret configuré, accepter (à sécuriser en production)
        if (empty($config?->eic_webhook_secret)) {
            Log::warning('EInvoicing webhook: secret non configuré, vérification ignorée.');
            return true;
        }

        $signature = $request->header('X-Webhook-Signature')
            ?? $request->header('X-Hub-Signature-256')
            ?? $request->header('X-Signature');

        if (!$signature) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $config->eic_webhook_secret);

        return hash_equals($expected, $signature);
    }
}
