<?php

namespace App\Services;

use App\Jobs\ProcessAccountingClosureJob;
use App\Jobs\WorkerPingJob;
use App\Models\AccountExerciseModel;
use App\Models\AccountMoveModel;
use App\Models\AccountConfigModel;
use App\Services\AccountingService;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Pagination\LengthAwarePaginator;
use ZipArchive;
use Exception;
use Illuminate\Support\Collection;


class AccountingClosureService
{
    protected DocumentService $documentService;
    protected AccountingExportService $exportService;
    protected AccountTransferService $transferService;
    protected AccountingBackupService $backupService;
    protected AccountingEditionPdfService $pdfService;
    protected AccountBilanService $bilanService;
    protected ?AccountConfigModel $accountConfig = null;
    protected AccountingService $accountingService;

    public function __construct(
        DocumentService $documentService,
        AccountingExportService $exportService,
        AccountTransferService $transferService,
        AccountingBackupService $backupService,
        AccountingEditionPdfService $pdfService,
        AccountBilanService $bilanService,
        AccountingService $accountingService
    ) {
        $this->documentService = $documentService;
        $this->exportService = $exportService;
        $this->transferService = $transferService;
        $this->backupService = $backupService;
        $this->pdfService = $pdfService;
        $this->bilanService = $bilanService;
        $this->accountingService = $accountingService;

        //Charge la configuration comptable
        $this->accountConfig = $this->getAccountConfig();
    }

    /**
     * Récupère la configuration comptable par défaut (ID=1) avec mise en cache
     *
     * @return AccountConfigModel
     * @throws \Exception
     */
    private function getAccountConfig(): AccountConfigModel
    {
        if ($this->accountConfig !== null) {
            return $this->accountConfig;
        }

        $config = AccountConfigModel::find(1);

        if (!$config) {
            throw new \Exception(
                'Configuration comptable par défaut (ID=1) introuvable'
            );
        }

        // Validation de la configuration
        if (empty($config['fk_ajl_id_od'])) {
            throw new \Exception("Erreur de configuration : Journal OD non paramétré");
        }

        if (empty($config['fk_acc_id_profit'])) {
            throw new \Exception("Erreur de configuration des comptes : Résultat non paramétré");
        }

        if (empty($config['fk_acc_id_loss'])) {
            throw new \Exception("Erreur de configuration des comptes : Résultat non paramétré");
        }

        if (empty($config['fk_ajl_id_an'])) {
            throw new \Exception("Erreur de configuration : Journal A-Nouveau non paramétré");
        };

        if (empty($config['fk_acc_id_carry_forward'])) {
            throw new \Exception("Erreur de configuration des comptes : Report à nouveau non paramétré");
        };

        if (empty($config['fk_acc_id_carry_forward'])) {
            throw new \Exception("Erreur de configuration des comptes : Report à nouveau non paramétré");
        };
        return $this->accountConfig = $config;
    }

    /**
     * Récupérer une clôture spécifique
     */
    public function getClosure(int $id): ?array
    {
        $exercise = AccountExerciseModel::with(['closer', 'author'])
            ->whereNotNull('aex_closing_date')
            ->find($id);

        if (!$exercise) {
            return null;
        }

        // Récupérer les documents liés (archive ZIP)
        $documents = DB::table('document_doc')
            ->where('fk_aex_id', $id)
            ->get();

        return [
            'id' => $exercise->aex_id,
            'start_date' => $exercise->aex_start_date,
            'end_date' => $exercise->aex_end_date,
            'closing_date' => $exercise->aex_closing_date,
            'closer' => $exercise->closer ? [
                'id' => $exercise->closer->usr_id,
                'name' => trim($exercise->closer->usr_firstname . ' ' . $exercise->closer->usr_lastname)
            ] : null,
            'documents' => $documents->map(function ($doc) {
                return [
                    'id' => $doc->doc_id,
                    'filename' => $doc->doc_filename,
                    'size' => $doc->doc_filesize,
                    'type' => $doc->doc_filetype,
                ];
            })->toArray()
        ];
    }


    /**
     * Démarre le processus de clôture en arrière-plan
     */
    public function initiateClosure(bool $openExercise = false): array
    {
        $processId = uniqid('closure_', true);
        $statusFile = Storage::disk('private')->path("/temp/closure_status_{$processId}.json");

        // Déterminer les actions à exécuter
        $actions = $this->getClosureActions($openExercise);

        $initialStatus = [
            'status' => 'waiting',
            'user_id' => Auth::id(),
            'started_at' => now()->toDateTimeString(),
            'progress' => 0,
            'current_action' => null,
            'message' => 'Initialisation...',
            'actions' => $actions
        ];

        // Créer le fichier de statut
        if (!is_dir(dirname($statusFile))) {
            mkdir(dirname($statusFile), 0755, true);
        }
        file_put_contents($statusFile, json_encode($initialStatus));

        // Dispatcher le job en arrière-plan
        ProcessAccountingClosureJob::dispatch($processId, $openExercise, Auth::id());

        return [
            'process_id' => $processId,
            'status_file' => $statusFile
        ];
    }

    /**
     * Récupère le statut du processus
     */
    public function getProcessStatus(string $processId): ?array
    {
        $statusFile = Storage::disk('private')->path("/temp/closure_status_{$processId}.json");

        if (!file_exists($statusFile)) {
            return null;
        }

        $status = json_decode(file_get_contents($statusFile), true);
        return $status;
    }

    /**
     * Vérifie que le worker de queue est opérationnel
     * Dispatch un micro-job et vérifie qu'il est traité dans le délai imparti
     *
     * @param int $timeoutSeconds Délai maximum d'attente (défaut: 5 secondes)
     * @return array ['available' => bool, 'message' => string]
     */
    public function checkWorkerStatus(int $timeoutSeconds = 5): array
    {
        $pingId = uniqid('ping_', true);
        $pingFile = Storage::disk('private')->path("/temp/worker_ping_{$pingId}.txt");

        // Créer le répertoire si nécessaire
        $dir = dirname($pingFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            // Dispatcher le job de ping
            WorkerPingJob::dispatch($pingId);

            // Attendre que le fichier soit créé (polling toutes les 200ms)
            $startTime = microtime(true);
            $maxWait = $timeoutSeconds;

            while ((microtime(true) - $startTime) < $maxWait) {
                if (file_exists($pingFile)) {
                    // Le worker a traité le job
                    @unlink($pingFile);
                    return [
                        'available' => true,
                        'message' => 'Le worker est opérationnel'
                    ];
                }
                usleep(200000); // 200ms
            }

            // Timeout - le worker n'a pas répondu
            return [
                'available' => false,
                'message' => 'Le worker de traitement n\'est pas disponible. Veuillez contacter l\'administrateur.'
            ];
        } catch (\Exception $e) {
            Log::channel('private')->error("Erreur lors de la vérification du worker", [
                'error' => $e->getMessage()
            ]);

            return [
                'available' => false,
                'message' => 'Erreur lors de la vérification du worker: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Exécute une action spécifique (appelé par le Job)
     * Cette méthode doit être publique pour être accessible par le Job
     */
    public function executeClosureAction(string $actionId, int $userId): array
    {
        // Simuler l'authentification pour les actions qui en ont besoin
        Auth::loginUsingId($userId);

        return match ($actionId) {
            'checkconsistency' => $this->checkConsistency(),
            'backup' => $this->createBackup(),
            'transfer' => $this->transferToAccounting(),
            'validation' => $this->validateAccountingMoves(),
            'reports' => $this->generateReports(),
            'accountClosing' => $this->closeExercise(),
            'accountOpening' => $this->openNewExercise(),
            default => throw new \Exception("Action inconnue: {$actionId}")
        };
    }


    /**
     * Supprime une clôture
     */
    public function deleteClosure(int $id): void
    {
        $exercise = AccountExerciseModel::find($id);
        if ($exercise) {
            $exercise->delete(); // Le trait DeletesRelatedDocuments supprimera les documents
        }
    }

    /**
     * Définit les actions de clôture
     */
    private function getClosureActions(bool $openExercise): array
    {
        $currentExercise = $this->accountingService->getCurrentExercise();
        $isClosed = $currentExercise === null || $currentExercise['is_closed'];

        $actions = [];

        // Actions de clôture (si l'exercice n'est pas clos)
        if (!$isClosed) {
            $actions['checkconsistency'] = ['status' => 'waiting', 'message' => '', 'label' => 'Validation de la cohérence'];
            $actions['backup'] = ['status' => 'waiting', 'message' => '', 'label' => 'Sauvegarde des données'];
            $actions['transfer'] = ['status' => 'waiting', 'message' => '', 'label' => 'Transfert en comptabilité'];
            $actions['validation'] = ['status' => 'waiting', 'message' => '', 'label' => 'Validation des pièces comptables'];
            $actions['reports'] = ['status' => 'waiting', 'message' => '', 'label' => 'Édition des documents définitifs'];
            $actions['accountClosing'] = ['status' => 'waiting', 'message' => '', 'label' => 'Clôture de l\'exercice'];
        }

        // Action d'ouverture (si demandée ou si l'exercice est déjà clos)
        if ($openExercise || $isClosed) {
            $actions['accountOpening'] = ['status' => 'waiting', 'message' => '', 'label' => 'Réouverture de l\'exercice'];
        }

        return $actions;
    }

    /**
     * Vérifie la cohérence des données
     */
    private function checkConsistency(): array
    {
        $exercise = $this->accountingService->getCurrentExercise();
        if (!$exercise) {
            throw new \Exception("Pas d'exercice comptable en cours");
        }

        // Vérifier que toutes les écritures sont dans la période         
        $outOfPeriod = AccountMoveModel::where('fk_aex_id', $exercise['id'])
            ->where(function ($query) use ($exercise) {
                $query->where('amo_date', '<', $exercise['start_date'])
                    ->orWhere('amo_date', '>', $exercise['end_date']);
            })
            ->count();

        if ($outOfPeriod > 0) {
            throw new \Exception("Écritures hors période détectées: {$outOfPeriod}");
        }

        return ['success' => true, 'message' => 'Test de cohérence réussi'];
    }

    /**
     * Crée une sauvegarde
     */
    private function createBackup(): array
    {
        $this->backupService->createBackup(Auth::id(), "Sauvegarde avant clôture");
        return ['success' => true, 'message' => 'Sauvegarde créée'];
    }

    /**
     * Transfert en comptabilité
     */
    public function transferToAccounting(): array
    {
        try {
            $exercise = $this->accountingService->getCurrentExercise();
            $movesToTransfer = $this->transferService->extractMovesToTransfer($exercise['start_date'], $exercise['end_date']);

            if (!empty($movesToTransfer["movements"])) {

                $this->transferService->processTransfer(
                    $movesToTransfer["movements"],
                    $exercise['start_date'],
                    $exercise['end_date'],
                    Auth::id()
                );
            }

            return [
                'success' => true,
                'message' => 'Transfert effectué'
            ];
        } catch (\Exception $e) {
            throw new \Exception('Exception transfert : ' . $e->getMessage());
        }
    }

    /**
     * Valide les pièces comptables
     */
    private function validateAccountingMoves(): array
    {
        $exercise = $this->accountingService->getCurrentExercise();

        // Valider toutes les écritures de l'exercice
        AccountMoveModel::where('fk_aex_id', $exercise['id'])
            ->whereNull('amo_valid')
            ->update(['amo_valid' => now()]);

        return ['success' => true, 'message' => 'Validation des pièces effectuée'];
    }

    /**
     * Génère les rapports (FEC, Balance, Grand Livre, etc.)
     * Retourne les données du ZIP sans l'enregistrer dans la base
     */
    public function generateReports(): array
    {
       
        $tempDir = null;
        try {
            $exercise = $this->accountingService->getCurrentExercise();
            if (!$exercise) {
                throw new \Exception("Pas d'exercice comptable en cours");
            }

            $filters = [
                'start_date' => $exercise['start_date'],
                'end_date' => $exercise['end_date'],
            ];

            $files = [];

            $tempDir = Storage::disk('private')->path("/temp/closure_reports_" . uniqid());

            // Créer le répertoire temporaire
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // 1. Génération du fichier FEC
            try {
                $fecData = $this->exportService->exportFec($filters, Auth::id(), true);
                $fecFile = $tempDir . '/' . $fecData["filename"];
                file_put_contents($fecFile, base64_decode($fecData["base64"]));

                $files[] = [
                    'name' => $fecData["filename"],
                    'path' => $fecFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier FEC: " . $e->getMessage());
            }

            // 2. Génération de la Balance PDF
            try {
                $balanceData = $this->pdfService->generateBalanceData($filters);
                $balancePdf = $this->pdfService->generateBalancePdf($balanceData, $filters);

                $balanceFile = $tempDir . '/Balance.pdf';
                file_put_contents($balanceFile, base64_decode($balancePdf));

                $files[] = [
                    'name' => 'Balance.pdf',
                    'path' => $balanceFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier Balance.pdf: " . $e->getMessage());
            }

            // 3. Génération du Grand Livre PDF
            try {
                $grandLivreData = $this->pdfService->generateGrandLivreData($filters);
                $grandLivrePdf = $this->pdfService->generateGrandLivrePdf($grandLivreData, $filters);

                $grandLivreFile = $tempDir . '/Grand_Livre.pdf';
                file_put_contents($grandLivreFile, base64_decode($grandLivrePdf));

                $files[] = [
                    'name' => 'Grand Livre.pdf',
                    'path' => $grandLivreFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier Grand Livre.pdf: " . $e->getMessage());
            }

            // 4. Génération du Bilan Synthétique PDF
            try {
                $bilanData = $this->bilanService->generateBilan([
                    'aml_date_start' => $exercise['start_date'],
                    'aml_date_end' => $exercise['end_date'],
                ]);
                $bilanPdf = $this->pdfService->generateBilanPdf($bilanData, $filters);

                $bilanFile = $tempDir . '/Bilan_Synthetique.pdf';
                file_put_contents($bilanFile, base64_decode($bilanPdf));

                $files[] = [
                    'name' => 'Bilan Synthetique.pdf',
                    'path' => $bilanFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier Bilan Synthetique.pdf: " . $e->getMessage());
            }

            // 5. Génération des Journaux PDF
            try {
                $journauxData = $this->pdfService->generateJournauxData($filters);
                $journauxPdf = $this->pdfService->generateJournauxPdf($journauxData, $filters);

                $journauxFile = $tempDir . '/Journaux.pdf';
                file_put_contents($journauxFile, base64_decode($journauxPdf));

                $files[] = [
                    'name' => 'Journaux.pdf',
                    'path' => $journauxFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier Journaux.pdf: " . $e->getMessage());
            }

            // 6. Génération du Centralisateur PDF
            try {
                $centralisateurData = $this->pdfService->generateCentralisateurData($filters);
                $centralisateurPdf = $this->pdfService->generateCentralisateurPdf($centralisateurData, $filters);

                $centralisateurFile = $tempDir . '/Centralisateur.pdf';
                file_put_contents($centralisateurFile, base64_decode($centralisateurPdf));

                $files[] = [
                    'name' => 'Centralisateur.pdf',
                    'path' => $centralisateurFile,
                ];
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors de la génération du fichier Centralisateur.pdf: " . $e->getMessage());
            }

            // 7. Création de l'archive ZIP finale
            $zipFileName = "cloture_comptable_{$exercise['start_date']}_{$exercise['end_date']}.zip";
            $zipPath = $tempDir . '/' . $zipFileName;

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new \Exception("Impossible de créer l'archive ZIP");
            }

            foreach ($files as $file) {
                if (file_exists($file['path'])) {
                    $zip->addFile($file['path'], $file['name']);
                }
            }

            $zip->close();

            // Vérifier que le ZIP a bien été créé
            if (!file_exists($zipPath)) {
                throw new \Exception("L'archive ZIP n'a pas été créée");
            }

            $zipSize = filesize($zipPath);
            $zipContent = file_get_contents($zipPath);

            // Retourner les informations du ZIP sans l'enregistrer
            // Le nettoyage sera fait après l'enregistrement dans le Job
            return [
                'success' => true,
                'message' => 'Rapports générés',
                'zip_size' => $zipSize,
                'files_count' => count($files),
                'zip_content' => base64_encode($zipContent),
                'zip_filename' => $zipFileName,
                'temp_dir' => $tempDir,
                'exercise_id' => $exercise['id']
            ];
        } catch (\Exception $e) {
            // Nettoyage en cas d'erreur
            if ($tempDir && is_dir($tempDir)) {
                $this->cleanupTempDirectory($tempDir);
            }
            throw new \Exception('Exception états : ' . $e->getMessage());
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
            // Logger l'erreur mais ne pas la propager
             Log::channel('private')->warning("Impossible de nettoyer le répertoire temporaire: {$directory}", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Clôture l'exercice
     */
    public function closeExercise(): array
    {
        try {

            $exercise = $this->accountingService->getCurrentExercise();
            if (!$exercise) {
                throw new \Exception("Pas d'exercice comptable en cours");
            }

            // 1. Calcul des soldes pour les comptes de charges (6) et produits (7)
            $balances = $this->calculateClosingBalances($exercise["id"]);
            $labelEntry = "Clôture exercice au " . date("d/m/Y", strtotime($exercise["end_date"]));

            $moveLines = [];
            $totalBalance = 0;

            foreach ($balances as $balance) {
                $moveLines[] = [
                    "fk_acc_id"       => $balance->acc_id,
                    "aml_credit"      => $balance->credit,
                    "aml_debit"       => $balance->debit,
                    "aml_label_entry" => $labelEntry,
                ];

                $totalBalance += $balance->debit - $balance->credit;
            }

            // Écriture de résultat au compte 120 (bénéfice) ou 129 (perte)
            if ($totalBalance != 0) {
                if ($totalBalance > 0) {
                    // Bénéfice
                    $moveLines[] = [
                        "fk_acc_id"       => $this->accountConfig['fk_acc_id_profit'],
                        "aml_credit"      => $totalBalance,
                        "aml_debit"       => 0,
                        "aml_label_entry" => $labelEntry,
                    ];
                } else {
                    // Perte
                    $moveLines[] = [
                        "fk_acc_id"       => $this->accountConfig['fk_acc_id_loss'],
                        "aml_credit"      => 0,
                        "aml_debit"       => abs($totalBalance),
                        "aml_label_entry" => $labelEntry,
                    ];
                }

                // Création du mouvement comptable
                $moveData = [
                    'fk_usr_id_author' => Auth::id(),
                    'amo_date'         => $exercise["end_date"],
                    'amo_label'        => $labelEntry,
                    'amo_ref'          => "Cloture " . date("d/m/Y", strtotime($exercise["end_date"])),
                    'fk_ajl_id'        => $this->accountConfig["fk_ajl_id_od"],
                    'amo_valid'        => now()->toDateString(),
                ];

                $linesData = [];
                // Création des lignes de mouvement
                foreach ($moveLines as $line) {
                    $linesData[] = [
                        'fk_acc_id'       => $line['fk_acc_id'],
                        'aml_credit'      => $line['aml_credit'],
                        'aml_debit'       => $line['aml_debit'],
                        'aml_label_entry' => $line['aml_label_entry'],
                    ];
                }

                AccountMoveModel::saveWithValidation(
                    moveData: $moveData,
                    linesData: $linesData,
                    moveId: null // null = création
                );
            }
            // Clôture de l'exercice
            // Marquer l'exercice comme clos
            AccountExerciseModel::where('aex_id', $exercise['id'])
                ->update([
                    'aex_closing_date' => now(),
                    'fk_usr_id_closer' => Auth::id(),
                ]);

            return ['success' => true, 'message' => 'Exercice clôturé'];
        } catch (\Exception $e) {
            throw new \Exception('Exception closeExercise : ' . $e->getMessage());
        }
    }

    /**
     * Calcul des soldes pour les comptes de charges (6) et produits (7)
     */
    private function calculateClosingBalances(int $curExerciseId)
    {
        $subQuery6 = DB::table('account_account_acc as acc')
            ->join('account_move_line_aml as aml', 'aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'amo.amo_id', '=', 'aml.fk_amo_id')
            ->where('amo.fk_aex_id', $curExerciseId)
            ->where('acc.acc_code', 'like', '6%')
            ->groupBy('acc.acc_id', 'acc.acc_code')
            ->selectRaw("
            acc.acc_id,
            acc.acc_code,
            CASE
                WHEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)) < 0
                THEN ABS(SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)))
                ELSE 0
            END AS debit,
            CASE
                WHEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)) > 0
                THEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0))
                ELSE 0
            END AS credit
        ")
            ->havingRaw('debit > 0 OR credit > 0');

        $subQuery7 = DB::table('account_account_acc as acc')
            ->join('account_move_line_aml as aml', 'aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'amo.amo_id', '=', 'aml.fk_amo_id')
            ->where('amo.fk_aex_id', $curExerciseId)
            ->where('acc.acc_code', 'like', '7%')
            ->groupBy('acc.acc_id', 'acc.acc_code')
            ->selectRaw("
            acc.acc_id,
            acc.acc_code,
            CASE
                WHEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)) < 0
                THEN ABS(SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)))
                ELSE 0
            END AS debit,
            CASE
                WHEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0)) > 0
                THEN SUM(COALESCE(aml.aml_debit,0) - COALESCE(aml.aml_credit,0))
                ELSE 0
            END AS credit
        ")
            ->havingRaw('debit > 0 OR credit > 0');

        $balances = DB::query()
            ->fromSub($subQuery6->unionAll($subQuery7), 'result')
            ->orderBy('acc_code')
            ->get();

        return $balances;
    }
    /**
     * Ouvre un nouvel exercice
     */
    public function openNewExercise(): array
    {
        try {

            //  DB::beginTransaction();
            $oldExercise = $this->accountingService->getCurrentExercise();

            if ($oldExercise && ($oldExercise["is_closed"] === false)) {
                throw new \Exception("L'exercice précédent n'est pas clos");
            }

            // Récupérer l'exercice suivant
            $nextExercise = AccountExerciseModel::where('aex_is_next_exercise', true)->first()?->toArray();;
            if (!$nextExercise) {
                throw new \Exception("Aucun exercice suivant configuré");
            };

            // Ajoute le nouvel exercice 
            $this->accountingService->addNewExercise();

            // Recupere les données du nouvelle exercies
            $curExercise =  $this->accountingService->getCurrentExercise();

            if ($curExercise && $curExercise["is_closed"] === true) {
                throw new \Exception("Le nouvelle exercice ce c'est pas ouvert");
            }

            $balances = $this->calculateOpeningBalances($oldExercise["id"], $nextExercise["aex_id"], $nextExercise["aex_start_date"]);

            $moveLines = [];
            $defaultLabelEntry = "A-Nouveaux au " . date("d/m/Y", strtotime($curExercise["start_date"]));

            foreach ($balances as $balance) {
                $labelEntry = (!empty($balance->label) && str_contains($balance->label, 'A-Nouveaux'))  || empty($balance->label) ?  $defaultLabelEntry :  $balance->label;
                $moveLines[] = [
                    "fk_acc_id"         =>  $balance->acc_id,
                    "aml_credit"        =>  $balance->credit,
                    "aml_debit"         =>  $balance->debit,
                    "aml_label_entry"   => $labelEntry,
                    "aml_lettering_code" => !empty($balance->aml_lettering_code) ?  $balance->aml_lettering_code : NULL,
                    "aml_lettering_date" => !empty($balance->aml_lettering_date) ?  $balance->aml_lettering_date : NULL,
                    "aml_abr_code"     => !empty($balance->aml_abr_code) ?  $balance->aml_abr_code : NULL,
                    "aml_abr_date"     => !empty($balance->aml_abr_date) ?  $balance->aml_abr_date : NULL,
                ];
            }
            $move = [
                'fk_usr_id_author' => Auth::id(),
                'amo_date'     => $curExercise["start_date"],
                'amo_label'    => $defaultLabelEntry,
                'fk_ajl_id'    => $this->accountConfig["fk_ajl_id_an"],
                'amo_ref'      =>  "",
            ];

            // Générer les écritures d'à-nouveau
            $accountMove = AccountMoveModel::saveWithValidation(
                moveData: $move,
                linesData: $moveLines,
                moveId: null // null = création
            );
            //  DB::rollBack();
            return ['success' => true, 'message' => 'Nouvel exercice ouvert'];
        } catch (\Exception $e) {
            throw new \Exception('Exception openNewExercise : ' . $e->getMessage());
        }
    }


    private function calculateOpeningBalances(int $oldExerciseId, int $curExerciseId, string $curExerciseStartDate): Collection
    {
        return DB::table(DB::raw('(
        -- Classe 1, 2, 3 et 4 non Lettrable
        SELECT
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) > 0
                THEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0))
                ELSE 0
            END  AS debit,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) < 0
                THEN ABS(SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)))
                ELSE 0
            END  AS credit,
            \'\' as label,
            NULL as aml_lettering_code,
            NULL as aml_lettering_date,
            NULL as aml_abr_code,
            NULL as aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND (
                acc.acc_code LIKE \'1%\' OR
                acc.acc_code LIKE \'2%\' OR
                acc.acc_code LIKE \'3%\' OR
                (acc.acc_code LIKE \'4%\' AND (acc.acc_is_letterable = 0 OR acc.acc_is_letterable IS NULL))
            )
            AND (aml.aml_lettering_code IS NULL OR aml.aml_lettering_code = \'\')
        GROUP BY aml.fk_acc_id, acc.acc_code
        HAVING ABS(debit - credit) > 0

        UNION ALL

        -- TVA Classe 445% Lettrable
        SELECT 
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) > 0
                THEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0))
                ELSE 0
            END  AS debit,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) < 0
                THEN ABS(SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)))
                ELSE 0
            END  AS credit,
            \'\' as label,
            NULL as aml_lettering_code,
            NULL as aml_lettering_date,
            NULL as aml_abr_code,
            NULL as aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND acc.acc_code LIKE \'445%\'
            AND acc.acc_is_letterable = 1
            AND (
                aml.aml_lettering_code IS NULL 
                OR aml.aml_lettering_code = \'\'
                OR EXISTS (
                    SELECT 1 
                    FROM account_move_amo amoNext
                    INNER JOIN account_move_line_aml amlNext ON amlNext.fk_amo_id = amoNext.amo_id
                    WHERE 
                        amoNext.fk_aex_id = ?
                        AND amlNext.aml_lettering_code = aml.aml_lettering_code
                        AND amlNext.fk_acc_id = aml.fk_acc_id
                    LIMIT 1
                )
            )
        GROUP BY aml.fk_acc_id, acc.acc_code

        UNION ALL

        -- Classe 4 Lettrable
        SELECT 
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             COALESCE(aml.aml_debit, 0)  AS debit,
             COALESCE(aml.aml_credit, 0)  AS credit,
            aml.aml_label_entry as label,
            aml.aml_lettering_code,
            aml.aml_lettering_date,
            aml.aml_abr_code,
            aml.aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND acc.acc_code LIKE \'4%\'
            AND acc.acc_code NOT LIKE \'445%\'
            AND acc.acc_is_letterable = 1
            AND (
                aml.aml_lettering_code IS NULL 
                OR aml.aml_lettering_code = \'\'
                OR EXISTS (
                    SELECT 1 
                    FROM account_move_amo amoNext
                    INNER JOIN account_move_line_aml amlNext ON amlNext.fk_amo_id = amoNext.amo_id
                    WHERE 
                        amoNext.fk_aex_id = ?
                        AND amlNext.aml_lettering_code = aml.aml_lettering_code
                        AND amlNext.fk_acc_id = aml.fk_acc_id
                    LIMIT 1
                )
            )

        UNION ALL

        -- On ventille les 512 déjà pointé
        SELECT 
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             COALESCE(aml.aml_debit, 0)  AS debit,
             COALESCE(aml.aml_credit, 0)  AS credit,
            aml.aml_label_entry as label,
            aml.aml_lettering_code,
            aml.aml_lettering_date,
            aml.aml_abr_code,
            aml.aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND acc.acc_code LIKE \'512%\'
            AND (aml.aml_abr_date >= ? OR aml.aml_abr_code IS NULL OR aml.aml_abr_code = \'\')

        UNION ALL

        -- On calcule le soldes 512%
        SELECT 
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             CASE 
                WHEN (SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) - 
                    SUM(CASE 
                        WHEN (aml.aml_abr_date >= ? OR aml.aml_abr_code IS NULL OR aml.aml_abr_code = \'\') 
                        THEN COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)
                        ELSE 0
                    END)) > 0 
                THEN (SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) - 
                    SUM(CASE 
                        WHEN (aml.aml_abr_date >= ? OR aml.aml_abr_code IS NULL OR aml.aml_abr_code = \'\') 
                        THEN COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)
                        ELSE 0
                    END))
                ELSE 0
            END  AS debit,
             CASE 
                WHEN (SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) - 
                    SUM(CASE 
                        WHEN (aml.aml_abr_date >= ? OR aml.aml_abr_code IS NULL OR aml.aml_abr_code = \'\') 
                        THEN COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)
                        ELSE 0
                    END)) < 0 
                THEN ABS(SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) - 
                    SUM(CASE 
                        WHEN (aml.aml_abr_date >= ? OR aml.aml_abr_code IS NULL OR aml.aml_abr_code = \'\') 
                        THEN COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)
                        ELSE 0
                    END))
                ELSE 0
            END  AS credit,
            \'\' as label,
            NULL as aml_lettering_code,
            NULL as aml_lettering_date,
            NULL as aml_abr_code,
            NULL as aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND acc.acc_code LIKE \'512%\'
            AND (aml.aml_abr_date < ? OR aml.aml_abr_code IS NOT NULL)
        GROUP BY aml.fk_acc_id, acc.acc_code

        UNION ALL

        -- On groupe le reste des classe 5% en exluant les 512%
        SELECT 
            aml.fk_acc_id as acc_id,
            acc.acc_code,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) > 0
                THEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0))
                ELSE 0
            END  AS debit,
             CASE
                WHEN SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)) < 0
                THEN ABS(SUM(COALESCE(aml.aml_debit, 0) - COALESCE(aml.aml_credit, 0)))
                ELSE 0
            END  AS credit,
            \'\' as label,
            NULL as aml_lettering_code,
            NULL as aml_lettering_date,
            NULL as aml_abr_code,
            NULL as aml_abr_date
        FROM account_move_line_aml aml
        INNER JOIN account_move_amo amo ON aml.fk_amo_id = amo.amo_id
        INNER JOIN account_account_acc acc ON aml.fk_acc_id = acc.acc_id
        WHERE amo.fk_aex_id = ?
            AND acc.acc_code LIKE \'5%\'
            AND acc.acc_code NOT LIKE \'512%\'
        GROUP BY aml.fk_acc_id, acc.acc_code
    ) AS result'))
            ->select('acc_id', 'acc_code', 'debit', 'credit', 'label', 'aml_lettering_code', 'aml_lettering_date', 'aml_abr_code', 'aml_abr_date')
            ->setBindings([
                $oldExerciseId,           // 1ère requête UNION
                $oldExerciseId,           // 2ème requête UNION (TVA 445%)
                $curExerciseId,           // EXISTS dans TVA 445%
                $oldExerciseId,           // 3ème requête UNION (Classe 4)
                $curExerciseId,           // EXISTS dans Classe 4
                $oldExerciseId,           // 4ème requête UNION (512 pointé)
                $curExerciseStartDate,    // 512 pointé condition
                $curExerciseStartDate,    // 5ème requête UNION (soldes 512) - 1er
                $curExerciseStartDate,    // 5ème requête UNION (soldes 512) - 2ème
                $curExerciseStartDate,    // 5ème requête UNION (soldes 512) - 3ème
                $curExerciseStartDate,    // 5ème requête UNION (soldes 512) - 4ème
                $oldExerciseId,           // WHERE soldes 512
                $curExerciseStartDate,    // condition soldes 512
                $oldExerciseId,           // 6ème requête UNION (reste classe 5%)
            ])
            ->orderBy('acc_code')
            ->get();
    }
}
