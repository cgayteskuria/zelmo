<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountTransferModel;
use App\Services\AccountTransferService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ApiAccountTransferController extends Controller
{
    protected AccountTransferService $transferService;

    public function __construct(AccountTransferService $transferService)
    {
        $this->transferService = $transferService;
    }

    /**
     * Liste des transferts comptables effectués
     *
     * GET /api/account-transfers
     */
    public function index(Request $request): JsonResponse
    {
        $offset = (int) $request->input('offset', 0);
        $limit = (int) $request->input('limit', 50);
        $sortBy = $request->input('sort_by', 'id');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC'));

        $sortColumnMap = [
            'id' => 'atr.atr_id',
            'atr_created' => 'atr.atr_created',
            'atr_moves_number' => 'atr.atr_moves_number',
            'atr_transfer_start' => 'atr.atr_transfer_start',
            'atr_transfer_end' => 'atr.atr_transfer_end',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'atr.atr_created';

        $query = AccountTransferModel::from('account_transfer_atr as atr')
            ->leftJoin('user_usr as usr', 'atr.fk_usr_id_author', '=', 'usr.usr_id')
            ->select([
                'atr.atr_id as id',
                'atr.atr_created',
                DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as author"),
                'atr.atr_transfer_start',
                'atr.atr_transfer_end',
                'atr.atr_moves_number',
            ]);

        $total = $query->count();

        $data = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get();

        return response()->json([
            'data' => $data,
            'total' => $total,
        ]);
    }

    /**
     * Détail d'un transfert comptable
     *
     * GET /api/account-transfers/{id}
     */
    public function show($id): JsonResponse
    {
        $transfer = AccountTransferModel::with('author')->findOrFail($id);

        return response()->json([
            'data' => $transfer
        ]);
    }

    /**
     * Preview des mouvements à transférer
     *
     * POST /api/account-transfers/preview
     * Body: { start_date: "2024-01-01", end_date: "2024-01-31", include_accounted: false }
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'include_accounted' => 'boolean',
        ]);

        try {
            $includeAccounted = $request->input('include_accounted', false);

            $result = $this->transferService->extractMovesToTransfer(
                $request->start_date,
                $request->end_date,
                $includeAccounted
            );

            return response()->json([
                'success' => true,
                'movements' => $result['movements'],
                'errors' => $result['errors'],
                'count' => $result['count'],
                'errorsCount' => $result['errorsCount'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validation et transfert comptable
     *
     * POST /api/account-transfers
     * Body: { movements: [...] }
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'movements' => 'required|array|min:1',
            'startDate' => 'required|string',
            'endDate' => 'required|string',
        ]);

        try {
            $userId = $request->user()->usr_id;

            $transfer = $this->transferService->processTransfer(
                $request->movements,
                $request->startDate,
                $request->endDate,
                $userId
            );

            return response()->json([
                'success' => true,
                'message' => sprintf(
                    'Transfert comptable réalisé avec succès : %d mouvements transférés',
                    $transfer->atr_moves_number
                ),
                'data' => $transfer,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du transfert comptable: ' . $e->getMessage(),
            ], 500);
        }
    }
}
