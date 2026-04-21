<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApiTimeReportController extends Controller
{
    public function report(Request $request)
    {
        $from    = $request->input('from');
        $to      = $request->input('to');
        $ptrId   = $request->input('fk_ptr_id');
        $usrId   = $request->input('fk_usr_id');

        $base = DB::table('time_entry_ten as ten')
            ->leftJoin('time_project_tpr as tpr', 'ten.fk_tpr_id', '=', 'tpr.tpr_id')
            ->leftJoin('partner_ptr as ptr', 'ten.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoin('user_usr as usr', 'ten.fk_usr_id', '=', 'usr.usr_id');

        if (!Auth::user()->can('time.view.all')) {
            $base->where('ten.fk_usr_id', Auth::id());
        }
        if ($from) $base->where('ten.ten_date', '>=', $from);
        if ($to)   $base->where('ten.ten_date', '<=', $to);
        if ($ptrId) $base->where('ten.fk_ptr_id', $ptrId);
        if ($usrId) $base->where('ten.fk_usr_id', $usrId);

        // ── KPIs ────────────────────────────────────────────────────────────
        $kpis = (clone $base)
            ->selectRaw("
                COALESCE(SUM(ten.ten_duration), 0)                                                       AS total_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_status = 2 OR ten.ten_status = 3 THEN ten.ten_duration ELSE 0 END), 0) AS approved_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_is_billable = 1 AND (ten.ten_status = 2 OR ten.ten_status = 3)
                    THEN (ten.ten_duration / 60.0) * COALESCE(ten.ten_hourly_rate, tpr.tpr_hourly_rate, 0)
                    ELSE 0 END), 0)                                                                       AS billable_amount,
                COUNT(DISTINCT ten.fk_usr_id)                                                            AS user_count,
                COALESCE(SUM(CASE WHEN ten.ten_status = 1 THEN ten.ten_duration ELSE 0 END), 0)          AS pending_minutes,
                COUNT(CASE WHEN ten.ten_status = 1 THEN 1 END)                                           AS pending_count
            ")
            ->first();

        $avgPerUser = ($kpis->user_count > 0)
            ? round($kpis->approved_minutes / $kpis->user_count / 60, 2)
            : 0;

        // ── Par collaborateur ────────────────────────────────────────────────
        $byUser = (clone $base)
            ->selectRaw("
                CONCAT(COALESCE(usr.usr_firstname, ''), ' ', COALESCE(usr.usr_lastname, '')) AS label,
                COALESCE(SUM(ten.ten_duration), 0)                                            AS total_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_status = 2 OR ten.ten_status = 3 THEN ten.ten_duration ELSE 0 END), 0) AS approved_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_is_billable = 1 AND (ten.ten_status = 2 OR ten.ten_status = 3)
                    THEN (ten.ten_duration / 60.0) * COALESCE(ten.ten_hourly_rate, tpr.tpr_hourly_rate, 0)
                    ELSE 0 END), 0)                                                           AS billable_amount
            ")
            ->groupBy('ten.fk_usr_id', 'usr.usr_firstname', 'usr.usr_lastname')
            ->orderByDesc('total_minutes')
            ->get();

        // ── Par projet ───────────────────────────────────────────────────────
        $byProject = (clone $base)
            ->selectRaw("
                COALESCE(tpr.tpr_lib, '(Sans projet)')   AS label,
                COALESCE(tpr.tpr_color, '#94a3b8')        AS color,
                COALESCE(SUM(ten.ten_duration), 0)        AS total_minutes
            ")
            ->groupBy('ten.fk_tpr_id', 'tpr.tpr_lib', 'tpr.tpr_color')
            ->orderByDesc('total_minutes')
            ->get();

        // ── Par semaine (pour stacked bar) ───────────────────────────────────
        $byWeek = (clone $base)
            ->selectRaw("
                YEARWEEK(ten.ten_date, 1)                 AS week_key,
                MIN(ten.ten_date)                         AS week_start,
                COALESCE(SUM(CASE WHEN ten.ten_status IN (2,3) THEN ten.ten_duration ELSE 0 END), 0) AS approved_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_status = 1 THEN ten.ten_duration ELSE 0 END), 0)      AS pending_minutes,
                COALESCE(SUM(CASE WHEN ten.ten_status = 0 THEN ten.ten_duration ELSE 0 END), 0)      AS draft_minutes
            ")
            ->groupBy('week_key')
            ->orderBy('week_key')
            ->get();

        // ── Par jour (heatmap) ───────────────────────────────────────────────
        $byDay = (clone $base)
            ->selectRaw("
                ten.ten_date                             AS day,
                COALESCE(SUM(ten.ten_duration), 0)       AS total_minutes
            ")
            ->groupBy('ten.ten_date')
            ->orderBy('ten.ten_date')
            ->get();

        return response()->json([
            'kpis' => [
                'total_hours'     => round($kpis->total_minutes / 60, 2),
                'approved_hours'  => round($kpis->approved_minutes / 60, 2),
                'billable_amount' => round($kpis->billable_amount, 2),
                'avg_per_user'    => $avgPerUser,
                'pending_minutes' => (int) $kpis->pending_minutes,
                'pending_count'   => (int) $kpis->pending_count,
            ],
            'by_user'    => $byUser,
            'by_project' => $byProject,
            'by_week'    => $byWeek,
            'by_day'     => $byDay,
        ]);
    }
}
