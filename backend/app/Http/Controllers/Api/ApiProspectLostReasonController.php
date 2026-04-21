<?php

namespace App\Http\Controllers\Api;

use App\Models\ProspectLostReasonModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiProspectLostReasonController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'prospect-lost-reasons';

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

        $query = ProspectLostReasonModel::query()
            ->select([
                'plr_id as id',
                'plr_label',
                'plr_is_active',
            ]);

        $filterColumnMap = [
            'plr_label' => 'plr_label',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        $sortColumnMap = [
            'id' => 'plr_id',
            'plr_label' => 'plr_label',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'plr_label', 'ASC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'plr_label'),
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

    public function show($id)
    {
        $item = ProspectLostReasonModel::where('plr_id', $id)->firstOrFail();
        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'plr_label' => 'required|string|max:100|unique:prospect_lost_reason_plr,plr_label',
            'plr_is_active' => 'sometimes|boolean',
        ]);

        $item = ProspectLostReasonModel::create($validated);
        return response()->json(['message' => 'Raison créée', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = ProspectLostReasonModel::findOrFail($id);

        $validated = $request->validate([
            'plr_label' => 'required|string|max:100|unique:prospect_lost_reason_plr,plr_label,' . $id . ',plr_id',
            'plr_is_active' => 'sometimes|boolean',
        ]);

        $item->update($validated);
        return response()->json(['message' => 'Raison mise à jour', 'data' => $item]);
    }

    public function destroy($id)
    {
        $item = ProspectLostReasonModel::findOrFail($id);
        $item->delete();
        return response()->json(['message' => 'Raison supprimée']);
    }

    public function options(Request $request)
    {
        $query = ProspectLostReasonModel::where('plr_is_active', 1);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('plr_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('plr_label', 'asc')
            ->get()
            ->map(fn($item) => [
                'id' => $item->plr_id,
                'label' => $item->plr_label,
            ]);

        return response()->json(['data' => $data]);
    }
}
