<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use App\Models\TimeProjectModel;
use App\Traits\HasGridFilters;

class ApiTimeProjectController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'time-projects';

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

        // Sous-requête : heures consommées par projet
        $consumedSub = DB::table('time_entry_ten')
            ->select('fk_tpr_id', DB::raw('ROUND(SUM(ten_duration) / 60, 2) as hours_consumed'))
            ->groupBy('fk_tpr_id');

        $query = TimeProjectModel::from('time_project_tpr as tpr')
            ->leftJoin('partner_ptr as ptr', 'tpr.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoinSub($consumedSub, 'cons', fn($j) => $j->on('tpr.tpr_id', '=', 'cons.fk_tpr_id'))
            ->select([
                'tpr.tpr_id',
                'tpr.tpr_lib',
                'tpr.tpr_status',
                'tpr.tpr_color',
                'tpr.tpr_budget_hours',
                'tpr.tpr_deadline',
                'tpr.tpr_hourly_rate',
                'tpr.fk_ptr_id',
                'ptr.ptr_name',
                DB::raw('COALESCE(cons.hours_consumed, 0) as hours_consumed'),
                DB::raw('CASE WHEN tpr.tpr_budget_hours IS NULL THEN NULL ELSE tpr.tpr_budget_hours - COALESCE(cons.hours_consumed, 0) END as hours_remaining'),
            ]);

        $this->applyGridFilters($query, $request, [
            'tpr_lib'  => 'tpr.tpr_lib',
            'ptr_name' => 'ptr.ptr_name',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'tpr_lib'  => 'tpr.tpr_lib',
            'ptr_name' => 'ptr.ptr_name',
            'tpr_status' => 'tpr.tpr_status',
            'tpr_deadline' => 'tpr.tpr_deadline',
        ], 'tpr_lib', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tpr_lib'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    public function options(Request $request)
    {
        $query = TimeProjectModel::from('time_project_tpr as tpr')
            ->leftJoin('partner_ptr as ptr', 'tpr.fk_ptr_id', '=', 'ptr.ptr_id')
            ->where('tpr.tpr_status', TimeProjectModel::STATUS_ACTIVE)
            ->select([
                'tpr.tpr_id as id',
                'tpr.tpr_lib as label',
                'tpr.tpr_color',
                'tpr.tpr_hourly_rate',
                'tpr.tpr_budget_hours',
                'tpr.fk_ptr_id',
                'ptr.ptr_name',
            ]);

        if ($request->filled('fk_ptr_id')) {
            $query->where('tpr.fk_ptr_id', (int) $request->input('fk_ptr_id'));
        }

        if ($request->filled('search')) {
            $query->where('tpr.tpr_lib', 'LIKE', '%' . $request->input('search') . '%');
        }

        return response()->json(['data' => $query->orderBy('tpr.tpr_lib')->get()]);
    }

    public function show($id)
    {
        $consumed = DB::table('time_entry_ten')
            ->where('fk_tpr_id', $id)
            ->value(DB::raw('ROUND(SUM(ten_duration) / 60, 2)')) ?? 0;

        $project = TimeProjectModel::with('partner:ptr_id,ptr_name')
            ->findOrFail($id);

        $hoursRemaining = $project->tpr_budget_hours !== null
            ? round($project->tpr_budget_hours - $consumed, 2)
            : null;

        return response()->json([
            'status'          => true,
            'data'            => $project,
            'hours_consumed'  => (float) $consumed,
            'hours_remaining' => $hoursRemaining,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tpr_lib'          => 'required|string|max:255',
            'tpr_description'  => 'nullable|string',
            'tpr_status'       => 'nullable|integer|in:0,1',
            'tpr_color'        => 'nullable|string|max:7',
            'tpr_budget_hours' => 'nullable|numeric|min:0',
            'tpr_deadline'     => 'nullable|date',
            'tpr_hourly_rate'  => 'nullable|numeric|min:0',
            'fk_ptr_id'        => 'required|integer|exists:partner_ptr,ptr_id',
            'fk_ord_id'        => 'nullable|integer|exists:sale_order_ord,ord_id',
        ]);

        if (!empty($validated['tpr_deadline'])) {
            $validated['tpr_deadline'] = Carbon::parse($validated['tpr_deadline'])->toDateString();
        }

        $project = TimeProjectModel::create($validated);

        return response()->json(['status' => true, 'data' => $project], 201);
    }

    public function update(Request $request, $id)
    {
        $project = TimeProjectModel::findOrFail($id);

        $validated = $request->validate([
            'tpr_lib'          => 'sometimes|required|string|max:255',
            'tpr_description'  => 'nullable|string',
            'tpr_status'       => 'nullable|integer|in:0,1',
            'tpr_color'        => 'nullable|string|max:7',
            'tpr_budget_hours' => 'nullable|numeric|min:0',
            'tpr_deadline'     => 'nullable|date',
            'tpr_hourly_rate'  => 'nullable|numeric|min:0',
            'fk_ptr_id'        => 'required|integer|exists:partner_ptr,ptr_id',
            'fk_ord_id'        => 'nullable|integer|exists:sale_order_ord,ord_id',
        ]);

        if (!empty($validated['tpr_deadline'])) {
            $validated['tpr_deadline'] = Carbon::parse($validated['tpr_deadline'])->toDateString();
        }

        $project->update($validated);

        return response()->json(['status' => true, 'data' => $project]);
    }

    public function destroy($id)
    {
        $project = TimeProjectModel::findOrFail($id);

        $hasEntries = DB::table('time_entry_ten')
            ->where('fk_tpr_id', $id)
            ->exists();

        if ($hasEntries) {
            return response()->json([
                'status'  => false,
                'message' => 'Impossible de supprimer ce projet : des saisies de temps y sont associées.',
            ], 422);
        }

        $project->delete();

        return response()->json(['status' => true]);
    }
}
