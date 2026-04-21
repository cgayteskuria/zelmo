<?php
namespace App\Http\Controllers\Api;

use App\Models\ProspectSourceModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiProspectSourceController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'prospect-sources';

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

        $query = ProspectSourceModel::query()
            ->select([
                'pso_id as id',
                'pso_label',
                'pso_is_active',
                'pso_is_default',
            ]);

        $filterColumnMap = [
            'pso_label' => 'pso_label',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        $sortColumnMap = [
            'id' => 'pso_id',
            'pso_label' => 'pso_label',
            'pso_is_default' => 'pso_is_default',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'pso_label', 'ASC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'pso_label'),
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
        $item = ProspectSourceModel::where('pso_id', $id)->firstOrFail();
        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pso_label'      => 'required|string|max:100|unique:prospect_source_pso,pso_label',
            'pso_is_active'  => 'sometimes|boolean',
            'pso_is_default' => 'sometimes|boolean',
        ]);

        DB::transaction(function () use (&$item, $validated) {
            if (!empty($validated['pso_is_default'])) {
                ProspectSourceModel::clearDefault();
            } else {
                $validated['pso_is_default'] = null;
            }

            $item = ProspectSourceModel::create($validated);
        });

        return response()->json(['message' => 'Source créée', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = ProspectSourceModel::findOrFail($id);

        $validated = $request->validate([
            'pso_label'      => 'required|string|max:100|unique:prospect_source_pso,pso_label,' . $id . ',pso_id',
            'pso_is_active'  => 'sometimes|boolean',
            'pso_is_default' => 'sometimes|boolean',
        ]);

        DB::transaction(function () use ($item, $validated) {
            if (!empty($validated['pso_is_default'])) {
                ProspectSourceModel::clearDefault(exceptId: $item->pso_id);
            } else {
                $validated['pso_is_default'] = null;
            }

            $item->update($validated);
        });

        return response()->json(['message' => 'Source mise à jour', 'data' => $item->fresh()]);
    }

    public function destroy($id)
    {
        $item = ProspectSourceModel::findOrFail($id);
        $item->delete();
        return response()->json(['message' => 'Source supprimée']);
    }

    public function options(Request $request)
    {
        $query = ProspectSourceModel::where('pso_is_active', 1);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('pso_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('pso_label', 'asc')
            ->get()
            ->map(fn($item) => [
                'id'      => $item->pso_id,
                'label'   => $item->pso_label,
                'default' => (bool) $item->pso_is_default,
            ]);

        return response()->json(['data' => $data]);
    }
}
