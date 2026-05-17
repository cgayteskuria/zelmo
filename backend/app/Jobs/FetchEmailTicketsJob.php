<?php

namespace App\Jobs;

use App\Services\FetchEmailTicketsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class FetchEmailTicketsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 1;
    public int $timeout = 120;

    public function handle(FetchEmailTicketsService $service): void
    {
        Log::info('FetchEmailTicketsJob: démarrage');
        $result = $service->fetchAndCreateTickets();
        Log::info('FetchEmailTicketsJob: terminé', [
            'processed' => $result['processed'],
            'errors'    => count($result['errors']),
        ]);
    }
}
