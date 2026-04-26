<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountImportExportModel;
use App\Services\AccountingImportService;
use App\Services\AccountingExportService;
use App\Services\AccountingService;
use App\Services\DocumentService;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;


/**
 * Contrôleur unifié pour les imports et exports comptables FEC/CIEL
 */
class ApiAccountingImportExportController extends Controller
{
    protected AccountingImportService $importService;
    protected AccountingExportService $exportService;

    public function __construct(
        AccountingImportService $importService,
        AccountingExportService $exportService
    ) {
        $this->importService = $importService;
        $this->exportService = $exportService;
    }

    // ==================== IMPORTS ====================

    /**
     * Liste des imports
     * GET /api/accounting-imports
     */
    public function indexImports(Request $request): JsonResponse
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', 50);
        $sortBy = $request->input('sort_by', 'aie_id');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id' => 'aie_id',
            'aie_created' => 'aie_created',
            'aie_type' => 'aie_type',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'aie_id';

        $query = AccountImportExportModel::select(
            'aie_id as id',
            'aie_type',           
            'aie_moves_number',
            'aie_created',
            'fk_usr_id_author'
        )
            ->where('aie_sens', 1) // Import uniquement
            ->with('author:usr_id,usr_firstname,usr_lastname');

        $total = $query->count();

        $imports = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get()
            ->map(function ($import) {
                return [
                    'id' => $import->id,
                    'aie_type' => $import->aie_type,                
                    'aie_moves_number' => $import->aie_moves_number,
                    'aie_created' => $import->aie_created,
                    'author' => $import->author
                        ? trim($import->author->usr_firstname . ' ' . $import->author->usr_lastname)
                        : 'Inconnu',
                ];
            });

        return response()->json([
            'data' => $imports,
            'total' => $total
        ]);
    }

    /**
     * Détails d'un import
     * GET /api/accounting-imports/{id}
     */
    public function showImport($id): JsonResponse
    {
        $import = AccountImportExportModel::with('author:usr_id,usr_firstname,usr_lastname')
            ->where('aie_id', $id)
            ->where('aie_sens', 1)
            ->first();

        if (!$import) {
            return response()->json(['error' => 'Import non trouvé'], 404);
        }

        return response()->json([
            'id' => $import->aie_id,
            'aie_type' => $import->aie_type,
            'aie_filename' => $import->aie_filename,
            'aie_secure_filename' => $import->aie_secure_filename,
            'aie_moves_number' => $import->aie_moves_number,
            'aie_transfer_start' => $import->aie_transfer_start,
            'aie_transfer_end' => $import->aie_transfer_end,
            'aie_created' => $import->aie_created,
            'aie_moves' => $import->aie_moves, // Données JSON des écritures importées
            'author' => $import->author
                ? trim($import->author->usr_firstname . ' ' . $import->author->usr_lastname)
                : 'Inconnu',
        ]);
    }

    /**
     * Upload fichier pour prévisualisation
     * POST /api/accounting-imports/upload
     */
    public function uploadForPreview(Request $request): JsonResponse
    {
        try {
            $result = $this->importService->previewFile(
                $request->file('file'),
                $request->input('format')
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'errors' => [$e->getMessage()]
            ], 400);
        }
    }

    /**
     * Import final depuis données validées
     * POST /api/accounting-imports/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'data' => 'required|array'
        ]);

        DB::beginTransaction();

        try {
            $result = $this->importService->importFromData(
                $request->input('data'),
                Auth::id()
            );

            DB::commit();

            return response()->json($result);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Suppression d'un import
     * DELETE /api/accounting-imports/{id}
     */
    public function destroyImport($id): JsonResponse
    {
        try {
            $import = AccountImportExportModel::where('aie_id', $id)
                ->where('aie_sens', 1)
                ->firstOrFail();

            // Suppression enregistrement (trait DeletesRelatedDocuments supprime automatiquement les documents liés)
            $import->delete();

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    // ==================== EXPORTS ====================

    /**
     * Liste des exports
     * GET /api/accounting-exports
     */
    public function indexExports(Request $request): JsonResponse
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', 50);
        $sortBy = $request->input('sort_by', 'aie_id');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id' => 'aie_id',
            'aie_created' => 'aie_created',
            'aie_transfer_start' => 'aie_transfer_start',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'aie_id';

        $query = AccountImportExportModel::select(
            'aie_id as id',
            'aie_type',
            'aie_transfer_start',
            'aie_transfer_end',
            'aie_created',
            'fk_usr_id_author'
        )
            ->where('aie_sens', -1) // Export uniquement
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'documents:doc_id,doc_filename,doc_filesize,fk_aie_id'
            ]);

        $total = $query->count();

        $exports = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get()
            ->map(function ($export) {
                $document = $export->documents->first();
                return [
                    'id' => $export->id,
                    'aie_type' => $export->aie_type,
                    'aie_filename' => $document ? $document->doc_filename : '',
                    'aie_filesize' => $document ? $document->doc_filesize : 0,
                    'aie_size_human' => $document ? $this->formatBytes($document->doc_filesize) : '0 B',
                    'aie_transfer_start' => $export->aie_transfer_start,
                    'aie_transfer_end' => $export->aie_transfer_end,
                    'aie_created' => $export->aie_created,
                    'author' => $export->author
                        ? trim($export->author->usr_firstname . ' ' . $export->author->usr_lastname)
                        : 'Inconnu',
                ];
            });

        return response()->json([
            'data' => $exports,
            'total' => $total
        ]);
    }

    /**
     * Détails d'un export
     * GET /api/accounting-exports/{id}
     */
    public function showExport($id): JsonResponse
    {
        $export = AccountImportExportModel::with([
                'author:usr_id,usr_firstname,usr_lastname',
                'documents:doc_id,doc_filename,doc_filesize,fk_aie_id'
            ])
            ->where('aie_id', $id)
            ->where('aie_sens', -1)
            ->first();

        if (!$export) {
            return response()->json(['error' => 'Export non trouvé'], 404);
        }

        $document = $export->documents->first();

        return response()->json([
            'id' => $export->aie_id,
            'aie_type' => $export->aie_type,
            'aie_filename' => $document ? $document->doc_filename : '',
            'aie_filesize' => $document ? $document->doc_filesize : 0,
            'aie_size_human' => $document ? $this->formatBytes($document->doc_filesize) : '0 B',
            'aie_transfer_start' => $export->aie_transfer_start,
            'aie_transfer_end' => $export->aie_transfer_end,
            'aie_created' => $export->aie_created,
            'author' => $export->author
                ? trim($export->author->usr_firstname . ' ' . $export->author->usr_lastname)
                : 'Inconnu',
        ]);
    }

    /**
     * Création d'un export FEC ou CSV
     * POST /api/accounting-exports
     */
    public function export(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'format'         => 'required|in:FEC,CSV',
            'start_date'     => 'required|date',
            'end_date'       => 'required|date',
            'account_from_id' => 'nullable|integer',
            'account_to_id'  => 'nullable|integer',
            'ajl_id'         => 'nullable|integer',
        ]);

        $accountingService = new AccountingService();
        $accountingService->validateWritingPeriod($filters);

        DB::beginTransaction();

        try {
            $result = $filters['format'] === 'CSV'
                ? $this->exportService->exportCsv($filters, Auth::id())
                : $this->exportService->exportFec($filters, Auth::id());

            DB::commit();

            return response()->json([
                'success'  => true,
                'aie_id'   => $result['aie_id'],
                'filename' => $result['filename'],
                'size'     => $result['size'],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Téléchargement fichier export
     * GET /api/accounting-exports/{id}/download
     */
    public function downloadExport($id)
    {
        try {
            $export = AccountImportExportModel::where('aie_id', $id)
                ->where('aie_sens', -1)
                ->firstOrFail();

            $document = $export->documents()->first();

            if (!$document) {
                return response()->json(['error' => 'Fichier non trouvé'], 404);
            }

            // Chemin complet du fichier
            $path = Storage::disk('private')->path("{$document->doc_filepath}/{$document->doc_securefilename}");

            if (!file_exists($path)) {
                return response()->json(['error' => 'Fichier non trouvé'], 404);
            }

            return response()->download($path, $document->doc_filename);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Suppression d'un export
     * DELETE /api/accounting-exports/{id}
     */
    public function destroyExport($id): JsonResponse
    {
        try {
            $export = AccountImportExportModel::where('aie_id', $id)
                ->where('aie_sens', -1)
                ->firstOrFail();

            // Suppression enregistrement (trait DeletesRelatedDocuments supprime automatiquement les documents liés)
            $export->delete();

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    // ==================== HELPERS ====================

    /**
     * Formatage taille fichier
     */
    private function formatBytes(?int $bytes): string
    {
        if (!$bytes || $bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $exp = floor(log($bytes) / log(1024));
        $exp = min($exp, count($units) - 1);

        return round($bytes / pow(1024, $exp), 2) . ' ' . $units[$exp];
    }
}
