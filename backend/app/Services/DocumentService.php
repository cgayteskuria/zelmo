<?php

namespace App\Services;

use App\Models\DocumentModel;
use App\Events\DocumentUploaded;
use App\Events\DocumentDeleted;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Collection;

class DocumentService
{
    /**
     * Mapping des modules vers leurs clés de foreign key
     */
    public const MODULE_MAPPING = [
        'sale-orders' => 'fk_ord_id',
        'purchase-orders' => 'fk_por_id',
        'invoices' => 'fk_inv_id',
        'contracts' => 'fk_con_id',
        'delivery-notes' => 'fk_dln_id',
        'customer-delivery-notes' => 'fk_dln_id',
        'supplier-reception-notes' => 'fk_dln_id',
        'partners' => 'fk_ptr_id',
        'charges' => 'fk_che_id',
        'account-bank-reconciliations' => 'fk_abr_id',
        'accounting-backups' => 'fk_aba_id',
        'accounting-imports' => 'fk_aie_id',
        'accounting-exports' => 'fk_aie_id',
        'accounting-exercises' => 'fk_aex_id',
        'expenses' => 'fk_exp_id',
        'vehicles' => 'fk_vhc_id',
        'opportunities' => 'fk_opp_id',
        'ticket-articles' => 'fk_tka_id',
    ];

    /**
     * Mapping des modules vers leurs dossiers de stockage
     */
    private const MODULE_FOLDER_MAPPING = [
        'sale-orders' => 'saleorder',
        'purchase-orders' => 'purchaseorder',
        'invoices' => 'invoice',
        'contracts' => 'contract',
        'delivery-notes' => 'deliverynote',
        'customer-delivery-notes' => 'deliverynote',
        'supplier-reception-notes' => 'deliverynote',
        'partners' => 'partner',
        'charges' => 'charge',
        'account-bank-reconciliations' => 'accountbankreconciliation',
        'accounting-backups' => 'accountingbackup',
        'accounting-imports' => 'accountimport',
        'accounting-exports' => 'accountexport',
        'accounting-exercises' => 'accountexercice',
        'expenses' => 'expensereport',
        'vehicles' => 'vehicle',
        'opportunities' => 'opportunity',
        'ticket-articles' => 'ticket-article',
    ];

    /**
     * Upload multiple files for a specific module record
     *
     * @param array $files Array of UploadedFile instances
     * @param string $module Module name (e.g., 'sale-orders')
     * @param int $recordId ID of the parent record
     * @param int $userId User ID performing the upload
     * @return Collection Collection of created document models
     * @throws \Exception
     */
    public function uploadFiles(array $files, string $module, int $recordId, int $userId, ?string $storageSubPath  = null): Collection
    {
        $foreignKey = $this->getForeignKeyColumn($module);
        $uploadedDocuments = collect();

        DB::beginTransaction();

        try {
            foreach ($files as $file) {
                $document = $this->uploadSingleFile($file, $module, $recordId, $foreignKey, $userId, $storageSubPath);
                $uploadedDocuments->push($document);
            }

            DB::commit();

            // Dispatch events after successful commit
            foreach ($uploadedDocuments as $document) {
                event(new DocumentUploaded($document, $userId));
            }

            return $uploadedDocuments;
        } catch (\Exception $e) {
            DB::rollBack();

            // Clean up any files that were stored before the error
            foreach ($uploadedDocuments as $document) {
                $this->deletePhysicalFile($document);
            }

            throw $e;
        }
    }

    /**
     * Upload a single file
     *
     * @param UploadedFile $file
     * @param string $module
     * @param int $recordId
     * @param string $foreignKey
     * @param int $userId
     * @return DocumentModel
     */
    private function uploadSingleFile(UploadedFile $file, string $module, int $recordId, string $foreignKey, int $userId, ?string $storageSubPath  = null): DocumentModel
    {
        // Generate secure filename
        $originalName = $file->getClientOriginalName();
        $secureFileName = $this->generateSecureFileName($originalName);

        // Storage path: {module}/{recordId}/
        $moduleFolder = $this->getModuleFolder($module);
        $storagePath = $storageSubPath
            ? trim($moduleFolder . '/' . trim($storageSubPath, '/'), '/')
            : $moduleFolder . '/' . $recordId;

        //   $storagePath = "{$moduleFolder}/{$recordId}";

        // Store file on private disk
        $file->storeAs($storagePath, $secureFileName, 'private');

        // Create database record
        $document = DocumentModel::create([
            'doc_filename' => $originalName,
            'doc_securefilename' => $secureFileName,
            'doc_filepath' => $storagePath,
            'doc_filetype' => $file->getMimeType(),
            'doc_filesize' => $file->getSize(),
            $foreignKey => $recordId,
            'fk_usr_id_author' => $userId,
            'fk_usr_id_updater' => $userId,
        ]);

        return $document;
    }

    /**
     * Get all documents for a specific module record
     *
     * @param string $module
     * @param int $recordId
     * @return Collection
     */
    public function getDocuments(string $module, int $recordId): Collection
    {
        $foreignKey = $this->getForeignKeyColumn($module);

        return DocumentModel::where($foreignKey, $recordId)
            ->orderBy('doc_created', 'desc')
            ->get([
                'doc_id as id',
                'doc_filename as fileName',
                'doc_filetype as fileType',
                'doc_filesize as fileSize',
                'doc_created as createdAt',
            ]);
    }

    /**
     * Get a document by ID with authorization check
     *
     * @param int $documentId
     * @return DocumentModel
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function getDocument(int $documentId): DocumentModel
    {
        return DocumentModel::findOrFail($documentId);
    }

    /**
     * Delete a document (both file and database record)
     *
     * @param DocumentModel $document
     * @param int $userId User performing the deletion
     * @return bool
     */
    public function deleteDocument(DocumentModel $document, int $userId): bool
    {
        DB::beginTransaction();

        try {
            // Delete physical file
            $this->deletePhysicalFile($document);

            // Delete database record
            $document->delete();

            DB::commit();

            // Dispatch event
            event(new DocumentDeleted($document, $userId));

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generate a signed URL for secure file download
     *
     * @param DocumentModel $document
     * @param int $expirationMinutes
     * @return string
     */
    public function generateSignedUrl(DocumentModel $document, int $expirationMinutes = 60): string
    {
        return URL::temporarySignedRoute(
            'documents.download',
            now()->addMinutes($expirationMinutes),
            ['documentId' => $document->doc_id]
        );
    }

    /**
     * Get file path for download
     *
     * @param DocumentModel $document
     * @return string
     */
    public function getFilePath(DocumentModel $document): string
    {
        $relativePath = $document->doc_filepath . '/' . $document->doc_securefilename;

        // Check private disk first (new location)
        if (Storage::disk('private')->exists($relativePath)) {
            $path = Storage::disk('private')->path($relativePath);
            // Normalize path separators for Windows
            return str_replace('/', DIRECTORY_SEPARATOR, $path);
        }

        // Default to private path (will fail if file doesn't exist, but that's expected)
        $path = Storage::disk('private')->path($relativePath);
        return str_replace('/', DIRECTORY_SEPARATOR, $path);
    }

    /**
     * Check if physical file exists
     *
     * @param DocumentModel $document
     * @return bool
     */
    public function fileExists(DocumentModel $document): bool
    {
        $filePath = $document->doc_filepath . '/' . $document->doc_securefilename;

        // Check both private and public disks
        return Storage::disk('private')->exists($filePath)
            || Storage::disk('public')->exists($filePath);
    }

    /**
     * Delete physical file from storage
     *
     * @param DocumentModel $document
     * @return bool
     */
    public function deletePhysicalFile(DocumentModel $document): bool
    {
        $filePath = $document->doc_filepath . '/' . $document->doc_securefilename;
        $directoryPath = $document->doc_filepath;
        $deleted = false;

        // Try to delete from private disk first
        if (Storage::disk('private')->exists($filePath)) {
            $deleted = Storage::disk('private')->delete($filePath);

            // Check if directory is empty and delete it
            if ($deleted && Storage::disk('private')->exists($directoryPath)) {
                $files = Storage::disk('private')->files($directoryPath);
                $directories = Storage::disk('private')->directories($directoryPath);

                // If no files and no subdirectories, delete the directory
                if (empty($files) && empty($directories)) {
                    Storage::disk('private')->deleteDirectory($directoryPath);
                }
            }

            return $deleted;
        }

        return true;
    }

    /**
     * Generate a secure filename
     *
     * @param string $fileName
     * @return string
     */
    private function generateSecureFileName(string $fileName): string
    {
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);

        // Clean the base name - remove special characters
        $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $baseName);

        // Limit length to avoid filesystem issues
        $cleanName = substr($cleanName, 0, 100);

        // Format: uniqid_timestamp_name.ext
        return uniqid() . '_' . time() . '_' . $cleanName . '.' . $extension;
    }

    /**
     * Get the foreign key column for a module
     *
     * @param string $module
     * @return string
     * @throws \Exception
     */
    private function getForeignKeyColumn(string $module): string
    {
        if (!isset(self::MODULE_MAPPING[$module])) {
            throw new \Exception("Module non supporté: $module");
        }

        return self::MODULE_MAPPING[$module];
    }

    /**
     * Get the storage folder name for a module
     *
     * @param string $module
     * @return string
     * @throws \Exception
     */
    private function getModuleFolder(string $module): string
    {
        if (!isset(self::MODULE_FOLDER_MAPPING[$module])) {
            throw new \Exception("Module non supporté: $module");
        }

        return self::MODULE_FOLDER_MAPPING[$module];
    }

    /**
     * Get disk usage for a specific module record
     *
     * @param string $module
     * @param int $recordId
     * @return int Total size in bytes
     */
    public function getTotalSize(string $module, int $recordId): int
    {
        $foreignKey = $this->getForeignKeyColumn($module);

        return DocumentModel::where($foreignKey, $recordId)
            ->sum('doc_filesize');
    }

    /**
     * Get document count for a specific module record
     *
     * @param string $module
     * @param int $recordId
     * @return int
     */
    public function getDocumentCount(string $module, int $recordId): int
    {
        $foreignKey = $this->getForeignKeyColumn($module);

        return DocumentModel::where($foreignKey, $recordId)->count();
    }

    /**
     * Store a file from content (not an uploaded file)
     *
     * @param string $content File content
     * @param string $filename Original filename
     * @param string $mimeType MIME type of the file
     * @param string $module Module name (e.g., 'accounting-backups')
     * @param int $recordId ID of the parent record
     * @param int $userId User ID performing the upload
     * @param bool $useSecureFilename Whether to generate a secure filename (default: true)
     * @return DocumentModel
     */
    public function storeFileFromContent(
        string $content,
        string $filename,
        string $mimeType,
        string $module,
        int $recordId,
        int $userId,
        bool $useSecureFilename = true
    ): DocumentModel {
        $foreignKey = $this->getForeignKeyColumn($module);

        // Generate secure filename if requested
        $secureFileName = $useSecureFilename ? $this->generateSecureFileName($filename) : $filename;

        // Storage path: {module}/{recordId}/
        $moduleFolder = $this->getModuleFolder($module);
        $storagePath = "{$moduleFolder}/{$recordId}";

        // Store file on private disk
        Storage::disk('private')->put("{$storagePath}/{$secureFileName}", $content);

        // Create database record
        $document = DocumentModel::create([
            'doc_filename' => $filename,
            'doc_securefilename' => $secureFileName,
            'doc_filepath' => $storagePath,
            'doc_filetype' => $mimeType,
            'doc_filesize' => strlen($content),
            $foreignKey => $recordId,
            'fk_usr_id_author' => $userId,
            'fk_usr_id_updater' => $userId,
        ]);

        return $document;
    }


    /**
     * Upload a logo file (for company logos not linked to a specific module)
     *
     * @param UploadedFile $file
     * @param string $logoType Logo type (large, square, printable)
     * @param int $userId User ID performing the upload
     * @return DocumentModel
     */
    public function uploadLogoFile(
        UploadedFile $file,
        string $logoType,
        int $userId
    ): DocumentModel {
        // Generate secure filename
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $secureFileName = time() . '_' . $logoType . '.' . $extension;

        // Storage path: company/logos/
        $storagePath = 'company/logos';

        // Store file on private disk
        $file->storeAs($storagePath, $secureFileName, 'private');

        // Create database record
        $document = DocumentModel::create([
            'doc_filename' => $originalName,
            'doc_securefilename' => $secureFileName,
            'doc_filepath' => $storagePath,
            'doc_filetype' => $file->getMimeType(),
            'doc_filesize' => $file->getSize(),
            'fk_usr_id_author' => $userId,
            'fk_usr_id_updater' => $userId,
        ]);

        return $document;
    }

    /**
     * Get picture as base64 encoded string
     *
     * @param int $docId Document ID
     * @return array|null Array with base64 data or null if document not found
     */
    public static function getOnBase64($docId): ?array
    {
        // Retrieve document
        $document = DocumentModel::where('doc_id', $docId)->first();

        if (!$document) {
            return null;
        }

        try {
            // Create service instance to use instance methods
            $service = new self();

            // Get full file path
            $filePath = $service->getFilePath($document);

            // Check if file exists
            if (!file_exists($filePath)) {
                return null;
            }

            // Read file content
            $content = file_get_contents($filePath);

            if ($content === false) {
                return null;
            }

            // Get mime type
            $mimeType = $document->doc_filetype ?? mime_content_type($filePath);

            // Create base64 data URL
            $base64 = 'data:' . $mimeType . ';base64,' . base64_encode($content);

            return [
                'doc_id' => $document->doc_id,
                'filename' => $document->doc_filename,
                'mime_type' => $mimeType,
                'base64' => $base64
            ];
        } catch (\Exception $e) {
            throw $e;
        }
    }
}
