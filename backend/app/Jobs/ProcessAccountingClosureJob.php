<?php

namespace App\Jobs;

use App\Services\AccountingClosureService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class ProcessAccountingClosureJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected string $processId;
    protected bool $openExercise;
    protected int $userId;

    public function __construct(string $processId, bool $openExercise, int $userId)
    {
        $this->processId = $processId;
        $this->openExercise = $openExercise;
        $this->userId = $userId;
    }

    public function handle(AccountingClosureService $closureService): void
    {
        $statusFile = Storage::disk('private')->path("/temp/closure_status_{$this->processId}.json");
        $actionId = null;
        $reportsData = null;
        $tempDirToClean = null;

        try {
            DB::beginTransaction();

            $status = json_decode(file_get_contents($statusFile), true);
            $actions = $status['actions'];
            $totalActions = count($actions);
            $currentStep = 0;

            Log::channel('private')->info("Closure process started", [
                'process_id' => $this->processId,
                'total_actions' => $totalActions,
                'actions' => array_keys($actions)
            ]);

            foreach ($actions as $actionId => $actionData) {
                $currentStep++;

                Log::channel('private')->info("Processing action {$currentStep}/{$totalActions}: {$actionId}");

                // Mettre à jour le statut: action en cours
                $status['actions'][$actionId]['status'] = 'processing';
                $status['status'] = 'processing';
                $status['progress'] = (($currentStep - 1) / $totalActions) * 100;
                $status['current_action'] = $actionId;
                $status['message'] = "Traitement en cours: {$actionData['label']}";
                file_put_contents($statusFile, json_encode($status));

                try {
                    // Exécuter l'action via le service
                    $result = $closureService->executeClosureAction($actionId, $this->userId);

                    // Stocker les données des rapports pour enregistrement ultérieur
                    if ($actionId === 'reports') {
                        $reportsData = $result;
                        $tempDirToClean = $result['temp_dir'] ?? null;
                    }

                    // Marquer l'action comme terminée
                    $status['actions'][$actionId]['status'] = 'completed';
                    $status['actions'][$actionId]['message'] = $result['message'] ?? 'Terminé';
                    $status['progress'] = ($currentStep / $totalActions) * 100;
                    $status['message'] = $result['message'] ?? 'Terminé';
                    file_put_contents($statusFile, json_encode($status));

                    Log::channel('private')->info("Action {$actionId} completed successfully");
                } catch (\Exception $e) {
                    Log::channel('private')->error("Action {$actionId} failed", [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);

                    // Marquer l'action comme en erreur
                    $status['actions'][$actionId]['status'] = 'error';
                    $status['actions'][$actionId]['message'] = $e->getMessage();
                    file_put_contents($statusFile, json_encode($status));

                    throw $e; // Re-throw pour le catch global
                }

                // Petite pause pour permettre au frontend de récupérer le statut
                usleep(100000); // 0.1 seconde
            }

            // Enregistrer le ZIP uniquement si generateReports et closeExercise ont réussi
            if ($reportsData && isset($reportsData['zip_content'], $reportsData['zip_filename'], $reportsData['exercise_id'])) {
                Log::channel('private')->info("Storing closure archive after successful closure");

                try {
                    $exerciseModel = \App\Models\AccountExerciseModel::find($reportsData['exercise_id']);
                    if ($exerciseModel) {
                        $documentService = app(\App\Services\DocumentService::class);
                        $documentService->storeFileFromContent(
                            base64_decode($reportsData['zip_content']),
                            $reportsData['zip_filename'],
                            'application/zip',
                            'accounting-exercises',
                            $exerciseModel->aex_id,
                            $this->userId,
                            false
                        );
                        Log::channel('private')->info("Closure archive stored successfully");
                    }
                } catch (\Exception $e) {
                    Log::channel('private')->error("Failed to store closure archive", [
                        'error' => $e->getMessage()
                    ]);
                    throw new \Exception("Erreur lors de l'enregistrement de l'archive: " . $e->getMessage());
                }
            }

            DB::commit();

            Log::channel('private')->info("Closure process completed successfully", [
                'process_id' => $this->processId
            ]);

            // Nettoyer le répertoire temporaire après le commit
            if ($tempDirToClean && is_dir($tempDirToClean)) {
                $this->cleanupTempDirectory($tempDirToClean);
                Log::channel('private')->info("Temporary directory cleaned up: {$tempDirToClean}");
            }

            // Marquer comme complété
            $status['status'] = 'completed';
            $status['progress'] = 100;
            $status['message'] = 'Processus terminé avec succès';
            $status['completed_at'] = now()->toDateTimeString();
            file_put_contents($statusFile, json_encode($status));

            Log::channel('private')->info("Closure process file saved, will be deleted after 10 seconds");

            // Garder le fichier pendant 10 sec pour permettre la récupération
            sleep(10);
            @unlink($statusFile);

            Log::channel('private')->info("Closure process status file deleted");
        } catch (\Exception $e) {
            DB::rollBack();
           
            // Nettoyer le répertoire temporaire en cas d'erreur
            if ($tempDirToClean && is_dir($tempDirToClean)) {
                $this->cleanupTempDirectory($tempDirToClean);
                Log::channel('private')->info("Temporary directory cleaned up after error: {$tempDirToClean}");
            }

            Log::channel('private')->error("Closure process failed with exception", [
                'process_id' => $this->processId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            $status = json_decode(file_get_contents($statusFile), true);

            if (isset($actionId)) {
                $status['actions'][$actionId]['status'] = 'error';
                $status['actions'][$actionId]['message'] = $e->getMessage();
            }

            $status['status'] = 'error';
            $status['message'] = $e->getMessage();
            $status['completed_at'] = now()->toDateTimeString();
            file_put_contents($statusFile, json_encode($status));

            // Garder le fichier pendant 10 sec pour permettre la récupération de l'erreur
            sleep(10);
            @unlink($statusFile);
        }
    }

    /**
     * Nettoie un répertoire temporaire et son contenu
     */
    private function cleanupTempDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        try {
            // Supprimer tous les fichiers du répertoire
            $files = glob($directory . '/*');
            if ($files !== false) {
                foreach ($files as $file) {
                    if (is_file($file)) {
                        @unlink($file);
                    } elseif (is_dir($file)) {
                        $this->cleanupTempDirectory($file);
                    }
                }
            }

            // Supprimer le répertoire lui-même
            @rmdir($directory);
        } catch (\Exception $e) {
            Log::channel('private')->warning("Impossible de nettoyer le répertoire temporaire: {$directory}", [
                'error' => $e->getMessage()
            ]);
        }
    }
}
