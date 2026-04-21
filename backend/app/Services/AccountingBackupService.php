<?php

namespace App\Services;

use App\Models\AccountingBackupModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AccountingBackupService
{
    protected DocumentService $documentService;

    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }
    /**
     * Tables à sauvegarder
     */
    private const ACCOUNTING_TABLES = [
        'account_account_acc',
        'account_exercise_aex',
        'account_bank_reconciliation_abr',
        'account_journal_ajl',
        'account_move_amo',
        'account_move_line_aml',
        'account_config_aco',
    ];

    /**
     * Crée une sauvegarde complète
     */
    public function createBackup(int $userId, ?string $label = null): array
    {
        $timestamp = now()->format('Ymd_His');
        $zipFilename = "accounting_backup_{$timestamp}.zip";

        // Créer le répertoire temporaire      
        $tempDir = Storage::disk('private')->path("/temp/backup_" . $timestamp);
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            // Générer les fichiers JSON pour chaque table
            $metadata = $this->generateJsonBackupFiles($tempDir);

            // Créer l'archive ZIP
            $zipPath = $this->createZipArchive($tempDir, $timestamp);

            // Lire le contenu du ZIP
            $zipContent = file_get_contents($zipPath);
            $rowsCount = $metadata['total_rows'];

            // Créer l'enregistrement de sauvegarde d'abord (pour avoir l'ID)
            $backup = AccountingBackupModel::create([
                'aba_label' => $label ?? "Sauvegarde automatique du " . now()->format('d/m/Y H:i'),
                'aba_size' => strlen($zipContent),
                'aba_tables_count' => count(self::ACCOUNTING_TABLES),
                'aba_rows_count' => $rowsCount,
                'fk_usr_id_author' => $userId,
            ]);

            // Utiliser DocumentService pour stocker le fichier
            $this->documentService->storeFileFromContent(
                $zipContent,
                $zipFilename,
                'application/zip',
                'accounting-backups',
                $backup->aba_id,
                $userId,
                false // Pas de nom sécurisé, on garde le nom original
            );

            // Nettoyer les fichiers temporaires
            $this->cleanupTempFiles($tempDir);
            @unlink($zipPath);

            return [
                'id' => $backup->aba_id,
                'filename' => $zipFilename,
                'size' => strlen($zipContent),
                'tables_count' => count(self::ACCOUNTING_TABLES),
                'rows_count' => $rowsCount,
            ];
        } catch (\Exception $e) {
            // Nettoyer en cas d'erreur
            if (is_dir($tempDir)) {
                $this->cleanupTempFiles($tempDir);
            }
            throw $e;
        }
    }

    /**
     * Génère les fichiers JSON pour chaque table
     */
    private function generateJsonBackupFiles(string $tempDir): array
    {
        $totalRows = 0;

        foreach (self::ACCOUNTING_TABLES as $table) {
            // Récupérer toutes les données de la table
            $data = DB::table($table)->get();

            $rowCount = $data->count();
            $totalRows += $rowCount;

            // Convertir en tableau simple
            $dataArray = $data->map(function ($row) {
                return (array) $row;
            })->toArray();

            // Créer le fichier JSON pour cette table
            $tableData = [
                'table_name' => $table,
                'export_timestamp' => now()->toDateTimeString(),
                'row_count' => $rowCount,
                'data' => $dataArray,
            ];

            $jsonContent = json_encode($tableData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            if ($jsonContent === false) {
                throw new \Exception("Erreur lors de l'encodage JSON pour la table {$table}: " . json_last_error_msg());
            }

            file_put_contents($tempDir . '/' . $table . '.json', $jsonContent);
        }

        // Créer le fichier de métadonnées
        $metadata = [
            'version' => '2.0',
            'date' => now()->toDateTimeString(),
            'database_type' => 'MySQL',
            'tables' => self::ACCOUNTING_TABLES,
            'total_tables' => count(self::ACCOUNTING_TABLES),
            'total_rows' => $totalRows,
        ];

        $metadataJson = json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($tempDir . '/backup_metadata.json', $metadataJson);

        return $metadata;
    }

    /**
     * Crée une archive ZIP à partir des fichiers JSON
     */
    private function createZipArchive(string $tempDir, string $timestamp): string
    {
        $zipPath = Storage::disk('private')->path("/temp/accounting_backup_" . $timestamp . '.zip');

        //  $zipPath = storage_path('app/temp/accounting_backup_' . $timestamp . '.zip');

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \Exception("Impossible de créer l'archive ZIP");
        }

        // Ajouter tous les fichiers JSON
        $files = glob($tempDir . '/*.json');
        foreach ($files as $file) {
            $zip->addFile($file, basename($file));
        }

        $zip->close();

        return $zipPath;
    }

    /**
     * Nettoie les fichiers temporaires
     */
    private function cleanupTempFiles(string $tempDir): void
    {
        if (is_dir($tempDir)) {
            $files = glob($tempDir . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    @unlink($file);
                }
            }
            @rmdir($tempDir);
        }
    }

    /**
     * Restaure une sauvegarde
     */
    public function restoreBackup(int $backupId): array
    {
        // Récupérer les documents associés via DocumentService
        $documents = $this->documentService->getDocuments('accounting-backups', $backupId);

        if ($documents->isEmpty()) {
            throw new \Exception("Fichier de sauvegarde introuvable");
        }

        // Prendre le premier document (il ne devrait y en avoir qu'un)
        $document = $this->documentService->getDocument($documents->first()->id);

        // Obtenir le chemin du fichier
        $zipPath = $this->documentService->getFilePath($document);

        if (!file_exists($zipPath)) {
            throw new \Exception("Fichier de sauvegarde physique introuvable");
        }

        // Créer un répertoire temporaire pour l'extraction
        $tempDir = Storage::disk('private')->path("/temp/restore_" . time());
        //  $tempDir = storage_path('app/temp/restore_' . time());
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            // Extraire le ZIP
            $zip = new \ZipArchive();

            if ($zip->open($zipPath) !== true) {
                throw new \Exception("Impossible d'ouvrir l'archive ZIP");
            }

            $zip->extractTo($tempDir);
            $zip->close();

            DB::beginTransaction();

            // Désactiver les contraintes FK
            DB::statement('SET FOREIGN_KEY_CHECKS=0');


            // Vider les tables avec DELETE au lieu de TRUNCATE
            // DELETE est transactionnel et peut être rollback
            foreach (self::ACCOUNTING_TABLES as $table) {
                DB::table($table)->delete(); // Au lieu de truncate()
            }

            // Restaurer les données de chaque table
            foreach (self::ACCOUNTING_TABLES as $table) {
                $jsonFile = $tempDir . '/' . $table . '.json';

                if (file_exists($jsonFile)) {
                    $jsonContent = file_get_contents($jsonFile);
                    $tableData = json_decode($jsonContent, true);

                    if ($tableData === null) {
                        throw new \Exception("Erreur lors du décodage JSON pour la table {$table}: " . json_last_error_msg());
                    }

                    // Nettoyer les données avant insertion (Respect du mode Strict)
                    $cleanedData = array_map(function ($row) {
                        return array_map(function ($value) {
                            // Convertir les dates invalides en NULL
                            if ($value === '0000-00-00' || $value === '0000-00-00 00:00:00') {
                                return null;
                            }
                            return $value;
                        }, $row);
                    }, $tableData['data']);
                    // Insérer les données par lots de 100
                    $chunks = array_chunk($cleanedData, 100);

                    foreach ($chunks as $chunk) {
                        DB::table($table)->insert($chunk);
                    }
                }
            }

            // Réactiver les contraintes FK
            DB::statement('SET FOREIGN_KEY_CHECKS=1');

             DB::commit();

            // Nettoyer les fichiers temporaires
            $this->cleanupTempFiles($tempDir);

            return [
                'success' => true,
                'message' => 'Restauration effectuée avec succès',
                'backup_id' => $backupId,
                'restored_at' => now()->toDateTimeString(),
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
             $this->cleanupTempFiles($tempDir);
            throw $e;
        }
    }
}
