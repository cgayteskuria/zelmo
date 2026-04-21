<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use App\Models\DocumentModel;

class CleanOrphanedDocuments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'documents:clean-orphaned {--force : Actually delete orphaned files}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean orphaned document files that no longer have database records';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $isDryRun = !$this->option('force');

        if ($isDryRun) {
            $this->warn('🔍 DRY-RUN MODE - No files will be deleted. Use --force to actually delete files.');
            $this->line('');
        }

        $this->info('Scanning for orphaned document files...');

        $disk = Storage::disk('private');
        $documentsPath = 'documents';

        if (!$disk->exists($documentsPath)) {
            $this->error("Documents directory not found: {$documentsPath}");
            return 1;
        }

        $stats = [
            'scanned' => 0,
            'orphaned' => 0,
            'deleted' => 0,
            'errors' => 0,
            'size_freed' => 0,
        ];

        $orphanedFiles = [];

        // Parcourir tous les fichiers
        $allFiles = $disk->allFiles($documentsPath);

        $progressBar = $this->output->createProgressBar(count($allFiles));
        $progressBar->start();

        foreach ($allFiles as $filePath) {
            $stats['scanned']++;

            // Extraire le nom sécurisé du fichier
            $secureFilename = basename($filePath);

            // Vérifier si le fichier existe en base
            $exists = DocumentModel::where('doc_securefilename', $secureFilename)->exists();

            if (!$exists) {
                $stats['orphaned']++;
                $fileSize = $disk->size($filePath);
                $stats['size_freed'] += $fileSize;

                $orphanedFiles[] = [
                    'path' => $filePath,
                    'size' => $fileSize,
                ];

                if (!$isDryRun) {
                    try {
                        $disk->delete($filePath);
                        $stats['deleted']++;
                    } catch (\Exception $e) {
                        $stats['errors']++;
                        $this->newLine();
                        $this->error("✗ Error deleting {$filePath}: {$e->getMessage()}");
                    }
                }
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        // Afficher les résultats
        $this->info('═══════════════════════════════════════');
        $this->info('           SCAN RESULTS                ');
        $this->info('═══════════════════════════════════════');
        $this->line("Files scanned:     {$stats['scanned']}");
        $this->line("Orphaned files:    {$stats['orphaned']}");

        if (!$isDryRun) {
            $this->line("Files deleted:     {$stats['deleted']}");
            if ($stats['errors'] > 0) {
                $this->error("Errors:            {$stats['errors']}");
            }
        }

        $sizeMB = round($stats['size_freed'] / 1024 / 1024, 2);
        $sizeKB = round($stats['size_freed'] / 1024, 2);

        if ($sizeMB >= 1) {
            $this->line("Space freed:       {$sizeMB} MB");
        } else {
            $this->line("Space freed:       {$sizeKB} KB");
        }

        $this->info('═══════════════════════════════════════');

        if ($isDryRun && $stats['orphaned'] > 0) {
            $this->newLine();
            $this->warn("⚠️  {$stats['orphaned']} orphaned file(s) found. Run with --force to delete them.");

            if ($this->option('verbose') && count($orphanedFiles) <= 20) {
                $this->newLine();
                $this->info('Orphaned files:');
                foreach ($orphanedFiles as $file) {
                    $sizeKB = round($file['size'] / 1024, 2);
                    $this->line("  - {$file['path']} ({$sizeKB} KB)");
                }
            } elseif (count($orphanedFiles) > 20) {
                $this->newLine();
                $this->comment('Too many orphaned files to display. Use --force to delete them all.');
            }
        }

        if (!$isDryRun && $stats['deleted'] > 0) {
            $this->newLine();
            $this->info("✓ Successfully cleaned {$stats['deleted']} orphaned file(s).");
        }

        return 0;
    }
}
