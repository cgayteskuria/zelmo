<?php

namespace App\Http\Controllers\Api;


use Illuminate\Support\Facades\Log;
use App\Services\AccountingClosureService;
use App\Services\AccountingService;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use App\Models\AccountExerciseModel;
use Illuminate\Support\Facades\DB;

class ApiAccountingClosureController extends Controller
{
    use HasGridFilters;

    protected AccountingClosureService $closureService;

    public function __construct(AccountingClosureService $closureService)
    {
        $this->closureService = $closureService;
    }

    public function index(Request $request): JsonResponse
    {
        $gridKey = 'accounting-closures';

        // --- Gestion des grid settings ---
        if (!$request->has('sort_by')) {
            $saved = $this->loadGridSettings($gridKey);
            if ($saved) {
                $merge = [];
                if (!empty($saved['sort_by']))    $merge['sort_by']    = $saved['sort_by'];
                if (!empty($saved['sort_order'])) $merge['sort_order'] = $saved['sort_order'];
                if (!empty($saved['filters']))    $merge['filters']    = $saved['filters'];
                if (!empty($saved['page_size']))  $merge['limit']      = $saved['page_size'];
                $request->merge($merge);
            }
        }

        try {
            $query = AccountExerciseModel::query()
                ->join('user_usr as usr', 'account_exercise_aex.fk_usr_id_closer', '=', 'usr.usr_id')
                ->whereNotNull('account_exercise_aex.aex_closing_date')
                ->select([
                    'account_exercise_aex.aex_id as id',
                    'account_exercise_aex.aex_closing_date',
                    DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as author"),
                    DB::raw("
                        CONCAT(
                            DATE_FORMAT(account_exercise_aex.aex_start_date, '%d/%m/%Y'),
                            ' au ',
                            DATE_FORMAT(account_exercise_aex.aex_end_date, '%d/%m/%Y')
                        ) as exercise_period
                    "),
                ]);

            $total = $query->count();

            $this->applyGridSort($query, $request, [
                'id'               => 'account_exercise_aex.aex_id',
                'aex_closing_date' => 'account_exercise_aex.aex_closing_date',
            ], 'aex_closing_date', 'DESC');

            $this->applyGridPagination($query, $request, 15);

            $currentSettings = [
                'sort_by'    => $request->input('sort_by', 'aex_closing_date'),
                'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
                'filters'    => $request->input('filters', []),
                'page_size'  => (int) $request->input('limit', 15),
            ];

            $this->saveGridSettings($gridKey, $currentSettings);

            return response()->json([
                'data'         => $query->get(),
                'total'        => $total,
                'gridSettings' => $currentSettings,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des clôtures: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Détails d'une clôture
     */
    public function show($id): JsonResponse
    {
        try {
            $exercise = AccountExerciseModel::with(['closer', 'author'])
                ->whereNotNull('aex_closing_date')
                ->find($id);

            if (!$exercise) {
                return response()->json([
                    'success' => false,
                    'message' => 'Clôture non trouvée'
                ], 404);
            }

            // Récupérer les documents liés (archive ZIP)
            $documents = DB::table('document_doc')
                ->where('fk_aex_id', $id)
                ->get();

            $closure = [
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

            return response()->json([
                'success' => true,
                'data' => $closure
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération de la clôture: ' . $e->getMessage()
            ], 500);
        }
    }


    /**
     * Démarrer le processus de clôture
     */
    public function startClosure(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'open_exercise' => 'boolean'
            ]);

            $result = $this->closureService->initiateClosure(
                $validated['open_exercise'] ?? false
            );

            return response()->json([
                'success' => true,
                'process_id' => $result['process_id'],
                'message' => 'Processus de clôture démarré'
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),              
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du démarrage: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Vérifier le statut du processus
     */
    public function pollStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'process_id' => 'required|string'
        ]);

        try {
            $status = $this->closureService->getProcessStatus(
                $validated['process_id']
            );

            if (!$status) {
                return response()->json([
                    'success' => false,
                    'message' => 'Processus non trouvé'
                ], 404);
            }

            return response()->json($status);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupère l'exercice comptable en cours
     */
    public function getCurrentExercise(): JsonResponse
    {
        try {
            $accountingService = new AccountingService();
            $exercise = $accountingService->getCurrentExercise();

            if (!$exercise) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucun exercice en cours'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $exercise
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Vérifie que le worker de queue est opérationnel
     * Permet au frontend de désactiver le bouton de clôture si le worker n'est pas disponible
     */
    public function workerStatus(): JsonResponse
    {
        try {
            $result = $this->closureService->checkWorkerStatus();

            return response()->json([
                'success' => true,
                'available' => $result['available'],
                'message' => $result['message']
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'available' => false,
                'message' => 'Erreur lors de la vérification du worker: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Télécharger l'archive ZIP de clôture
     */
    public function downloadArchive(int $id)
    {
        try {

            $export = AccountExerciseModel::where('aex_id', $id)->firstOrFail();
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
                'success' => false,
                'message' => 'Erreur lors du téléchargement de l\'archive: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer une clôture (admin only)
     */
    public function destroy($id): JsonResponse
    {
        try {
            $this->closureService->deleteClosure($id);

            return response()->json([
                'success' => true,
                'message' => 'Clôture supprimée'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
