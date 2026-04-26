<?php

namespace App\Jobs;

use App\Services\EInvoicing\EInvoicingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessEInvoicingWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 60;

    public function __construct(
        private string  $type,
        private ?string $paInvoiceId,
        private array   $payload
    ) {
    }

    public function handle(EInvoicingService $service): void
    {
        Log::info('EInvoicing webhook job', ['type' => $this->type, 'invoice_id' => $this->paInvoiceId]);

        match ($this->type) {
            'lifecycle'    => $this->paInvoiceId
                ? $service->processWebhookLifecycle($this->paInvoiceId, $this->payload)
                : null,
            'billing_data' => $this->paInvoiceId
                ? $service->storeReceivedFactureX($this->paInvoiceId)
                : null,
            'declaration'  => null, // TODO: traitement e-reporting
            default        => Log::warning('EInvoicing webhook: type inconnu', ['type' => $this->type]),
        };
    }

    public function failed(\Throwable $e): void
    {
        Log::error('EInvoicing webhook job échoué', [
            'type'       => $this->type,
            'invoice_id' => $this->paInvoiceId,
            'error'      => $e->getMessage(),
        ]);
    }
}
