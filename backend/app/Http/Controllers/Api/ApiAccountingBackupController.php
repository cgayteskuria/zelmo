<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountingBackupModel;
use App\Services\AccountingBackupService;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApiAccountingBackupController extends Controller
{
    protected AccountingBackupService $backupService;
    protected DocumentService $documentService;

    public function __construct(AccountingBackupService $backupService, DocumentService $documentService)
    {
        $this->backupService = $backupService;
        $this->documentService = $documentService;
    }

    /**
     * Liste des sauvegardes
     *
     * GET /api/accounting-backups
     */
    public function index(Request $request): JsonResponse
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', 50);
        $sortBy = $request->input('sort_by', 'aba_id');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'DESC' ? 'DESC' : 'ASC';

        $sortColumnMap = [
            'id' => 'aba_id',
            'aba_created' => 'aba_created',
            'aba_size' => 'aba_size',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'aba_id';

        $query = AccountingBackupModel::select(
            'aba_id as id',
            'aba_label',
            'aba_size',
            'aba_tables_count',

            'aba_created',
            'fk_usr_id_author'
        )->with('author:usr_id,usr_firstname,usr_lastname');

        $total = $query->count();

        $backups = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get()
            ->map(function ($backup) {
                return [
                    'id' => $backup->id,
                    'aba_label' => $backup->aba_label,
                    'aba_size' => $backup->aba_size,
                    'aba_size_human' => $this->formatBytes($backup->aba_size),
                    'aba_tables_count' => $backup->aba_tables_count,

                    'aba_created' => $backup->aba_created,
                    'author' => $backup->author ? trim($backup->author->usr_firstname . ' ' . $backup->author->usr_lastname) : 'Inconnu',
                ];
            });

        return response()->json([
            'data' => $backups,
            'total' => $total
        ]);
    }

    /**
     * Détails d'une sauvegarde
     *
     * GET /api/accounting-backups/{id}
     */
    public function show($id): JsonResponse
    {
        $backup = AccountingBackupModel::with('author')->findOrFail($id);

        return response()->json([
            'data' => [
                'aba_id' => $backup->aba_id,
                'aba_label' => $backup->aba_label,
                'aba_size' => $backup->aba_size,
                'aba_size_human' => $this->formatBytes($backup->aba_size),
                'aba_tables_count' => $backup->aba_tables_count,
                'aba_created' => $backup->aba_created,
                'author' => $backup->author ? trim($backup->author->usr_firstname . ' ' . $backup->author->usr_lastname) : 'Inconnu',
            ]
        ]);
    }

    /**
     * Créer une nouvelle sauvegarde
     *
     * POST /api/accounting-backups
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'aba_label' => 'nullable|string|max:255',
        ]);

        try {
            $userId = Auth::id();
            $result = $this->backupService->createBackup($userId, $request->input('aba_label'));

            return response()->json([
                'success' => true,
                'message' => 'Sauvegarde créée avec succès',
                'data' => $result
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création de la sauvegarde: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer une sauvegarde
     *
     * DELETE /api/accounting-backups/{id}
     */
    public function destroy($id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $backup = AccountingBackupModel::findOrFail($id);

            // La suppression des fichiers est gérée automatiquement par le trait DeletesRelatedDocuments
            $backup->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Sauvegarde supprimée avec succès'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression de la sauvegarde',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Télécharger le fichier de sauvegarde
     *
     * GET /api/accounting-backups/{id}/download
     */
    public function download($id)
    {
        try {
            // Récupérer les documents associés via DocumentService
            $documents = $this->documentService->getDocuments('accounting-backups', $id);

            if ($documents->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Fichier de sauvegarde introuvable'
                ], 404);
            }

            // Prendre le premier document (il ne devrait y en avoir qu'un)
            $document = $this->documentService->getDocument($documents->first()->id);

            // Vérifier si le fichier existe
            if (!$this->documentService->fileExists($document)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Fichier non trouvé sur le serveur.'
                ], 404);
            }

            // Obtenir le chemin du fichier et lancer le téléchargement
            $filePath = $this->documentService->getFilePath($document);

            return response()->download($filePath, $document->doc_filename);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du téléchargement: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restaurer une sauvegarde
     *
     * POST /api/accounting-backups/{id}/restore
     */
    public function restore($id): JsonResponse
    {
        try {
            $userId = Auth::id();
            $result = $this->backupService->restoreBackup($id);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la restauration: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Formate les octets en format lisible
     */
    private function formatBytes($bytes, $precision = 2)
    {
        if ($bytes === null || $bytes === 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
