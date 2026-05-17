<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiHistoryController extends Controller
{
    private const ALLOWED_TYPES = [
        'contract', 'invoice', 'sale_order', 'purchase_order', 'partner', 'contact',
        'product', 'charge',
    ];

    public function index(Request $request, string $entityType, int $entityId): JsonResponse
    {
        if (!in_array($entityType, self::ALLOWED_TYPES, true)) {
            return response()->json(['message' => 'Type d\'entité invalide.'], 422);
        }

        $perPage = min((int) $request->get('per_page', 50), 200);

        $logs = DB::table('logs_log as l')
            ->leftJoin('user_usr as u', 'l.fk_usr_id', '=', 'u.usr_id')
            ->where('l.log_entity_type', $entityType)
            ->where('l.log_entity_id', $entityId)
            ->orderBy('l.log_created', 'desc')
            ->select([
                'l.log_id',
                'l.log_created',
                'l.log_action',
                'l.log_details',
                'l.fk_usr_id',
                DB::raw("TRIM(CONCAT_WS(' ', u.usr_firstname, u.usr_lastname)) as user_name"),
            ])
            ->paginate($perPage);

        $logs->getCollection()->transform(function ($log) {
            $log->log_details = $log->log_details ? json_decode($log->log_details, true) : null;
            return $log;
        });

        return response()->json($logs);
    }
}
