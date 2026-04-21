<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Storage;

/**
 * Job de ping pour vérifier que le worker de queue est opérationnel
 * Écrit un fichier timestamp qui sera vérifié par le service
 */
class WorkerPingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    protected string $pingId;

    public function __construct(string $pingId)
    {
        $this->pingId = $pingId;
    }

    public function handle(): void
    {
        $pingFile = Storage::disk('private')->path("/temp/worker_ping_{$this->pingId}.txt");

        // Créer le répertoire si nécessaire
        $dir = dirname($pingFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Écrire le timestamp de traitement
        file_put_contents($pingFile, (string) time());
    }
}
