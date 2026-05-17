<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Alertes TVA — envoi quotidien à 08h00
Schedule::command('vat:send-alerts')->dailyAt('08:00');

// Facturation électronique — synchronisation des statuts toutes les 15 minutes
Schedule::job(new \App\Jobs\SyncEInvoicingStatusesJob)->everyFifteenMinutes();

// Collecte automatique des emails → tickets (intervalle configuré dans settings/assistance)
try {
    $ticketConfig = \App\Models\TicketConfigModel::find(1);
    $interval = max(5, (int) ($ticketConfig?->tco_email_collection_interval ?? 15));

    if ($ticketConfig?->fk_eml_id && in_array($interval, [5, 10, 15, 30, 60])) {
        Schedule::job(new \App\Jobs\FetchEmailTicketsJob)
            ->cron("*/{$interval} * * * *")
            ->withoutOverlapping();
    }
} catch (\Throwable $e) {
    // DB indisponible au démarrage du scheduler — on ignore silencieusement
}
