<?php

namespace App\Jobs;

use App\Services\EInvoicing\EInvoicingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Job planifié (scheduler) pour synchroniser les statuts des transmissions en attente.
 * Complète les webhooks si un événement a été manqué.
 */
class SyncEInvoicingStatusesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 1;
    public int $timeout = 120;

    public function handle(EInvoicingService $service): void
    {
        Log::info('SyncEInvoicingStatusesJob: démarrage');
        $service->syncPendingStatuses();
        Log::info('SyncEInvoicingStatusesJob: terminé');
    }
}
