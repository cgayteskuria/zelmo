<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\DocumentUploadRequest;
use App\Models\DocumentModel;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class ApiDocumentController extends Controller
{
    /**
     * Document service instance
     */
    protected DocumentService $documentService;

    /**
     * Constructor with dependency injection
     */
    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }

    /**
     * Get all documents for a specific module record
     *
     * @param string $module Module name (e.g., 'sale-orders')
     * @param int $recordId Parent record ID
     * @return JsonResponse
     */
    public function index(string $module, int $recordId): JsonResponse
    {
        try {
            // Get current user ID
            $userId = $this->getCurrentUserId();         
                      
            // Authorization check
            if (Gate::denies('viewAny', [DocumentModel::class, $module, $recordId])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à consulter ces documents.',
                ], 403);
            }

            // Get documents via service
            $documents = $this->documentService->getDocuments($module, $recordId);

            return response()->json([
                'success' => true,
                'data' => $documents,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des documents: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload one or multiple files
     *
     * @param DocumentUploadRequest $request Validated request
     * @param string $module Module name
     * @param int $recordId Parent record ID
     * @return JsonResponse
     */
    public function upload(DocumentUploadRequest $request, string $module, int $recordId): JsonResponse
    {
        try {
            // Get current user ID
            $userId = $this->getCurrentUserId();

            // Authorization check
            if (Gate::denies('create', [DocumentModel::class, $module, $recordId])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à uploader des documents.',
                ], 403);
            }

            // Get validated files
            $files = $request->file('files');
            if (!is_array($files)) {
                $files = [$files];
            }

            // Upload via service (includes transaction and events)
            $uploadedDocuments = $this->documentService->uploadFiles($files, $module, $recordId, $userId);

            // Format response
            $data = $uploadedDocuments->map(function ($document) {
                return [
                    'id' => $document->doc_id,
                    'fileName' => $document->doc_filename,
                    'fileType' => $document->doc_filetype,
                    'fileSize' => $document->doc_filesize,
                    'createdAt' => $document->doc_created,
                ];
            });

            $message = count($uploadedDocuments) === 1
                ? 'Fichier téléversé avec succès'
                : count($uploadedDocuments) . ' fichiers téléversés avec succès';

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du téléversement: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download a file
     *
     * @param int $documentId
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
     */
    public function download(int $documentId)
    {
        try {
            // Get document
            $document = $this->documentService->getDocument($documentId);

            // Authorization check
            if (Gate::denies('download', $document)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à télécharger ce document.',
                ], 403);
            }

            // Check if file exists
            if (!$this->documentService->fileExists($document)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Fichier non trouvé sur le serveur.',
                ], 404);
            }

            // Get file path
            $filePath = $this->documentService->getFilePath($document);

            // Vider les buffers PHP et sauvegarder la session AVANT l'envoi du fichier.
            // response()->download() (BinaryFileResponse) envoie Connection: close + Content-Length,
            // ce qui cause "Parse Error: Data after Connection: close" dans le proxy Vite/Node.js
            // si un middleware (Debugbar, etc.) ajoute du contenu après.
            // streamDownload() utilise StreamedResponse (chunked, pas de Content-Length fixe)
            // et est compatible avec http-proxy.
            session()->save();
            while (ob_get_level() > 0) {
                ob_end_clean();
            }

            $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';

            return response()->streamDownload(function () use ($filePath) {
                readfile($filePath);
            }, $document->doc_filename, [
                'Content-Type' => $mimeType,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Document non trouvé.',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Action non autorisée.',
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du téléchargement: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a document
     *
     * @param int $documentId
     * @return JsonResponse
     */
    public function delete(int $documentId): JsonResponse
    {
        try {
            // Get current user ID
            $userId = $this->getCurrentUserId();

            // Get document
            $document = $this->documentService->getDocument($documentId);

            // Authorization check
            if (Gate::denies('delete', $document)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à supprimer ce document.',
                ], 403);
            }

            // Delete via service (includes transaction and events)
            $this->documentService->deleteDocument($document, $userId);

            return response()->json([
                'success' => true,
                'message' => 'Document supprimé avec succès.',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Document non trouvé.',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a signed URL for secure download
     *
     * @param int $documentId
     * @return JsonResponse
     */
    public function getSignedUrl(int $documentId): JsonResponse
    {
        try {
            // Get document
            $document = $this->documentService->getDocument($documentId);

            // Authorization check
            if (Gate::denies('download', $document)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à accéder à ce document.',
                ], 403);
            }

            // Generate signed URL (valid for 60 minutes)
            $signedUrl = $this->documentService->generateSignedUrl($document, 60);

            return response()->json([
                'success' => true,
                'data' => [
                    'url' => $signedUrl,
                    'expiresIn' => 60, // minutes
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Document non trouvé.',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération de l\'URL: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get statistics about documents for a module record
     *
     * @param string $module
     * @param int $recordId
     * @return JsonResponse
     */
    public function stats(string $module, int $recordId): JsonResponse
    {
        try {
            // Authorization check
            if (Gate::denies('viewAny', [DocumentModel::class, $module, $recordId])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non autorisé à consulter ces documents.',
                ], 403);
            }

            $totalSize = $this->documentService->getTotalSize($module, $recordId);
            $count = $this->documentService->getDocumentCount($module, $recordId);

            return response()->json([
                'success' => true,
                'data' => [
                    'count' => $count,
                    'totalSize' => $totalSize,
                    'totalSizeMB' => round($totalSize / (1024 * 1024), 2),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des statistiques: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get the current authenticated user ID
     * Fallback to first user if auth not configured
     *
     * @return int
     * @throws \Exception
     */
    private function getCurrentUserId(): int
    {
        // Try to get authenticated user
        $user = Auth::user();

        if (!$user || !$user->usr_id) {
            throw new \Illuminate\Auth\AuthenticationException(
                'Utilisateur non authentifié.'
            );
        }

        return $user->usr_id;
    }
}
